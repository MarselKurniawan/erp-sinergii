
-- ===== FASE 1: COSTING FIFO/AVERAGE =====

-- 1. costing_method per company
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS costing_method TEXT NOT NULL DEFAULT 'average'
  CHECK (costing_method IN ('fifo','average'));

-- 2. FIFO layer tracking di inventory_movements
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS remaining_qty NUMERIC NOT NULL DEFAULT 0;

-- 3. WAC running di inventory_stock
ALTER TABLE public.inventory_stock
  ADD COLUMN IF NOT EXISTS average_cost NUMERIC NOT NULL DEFAULT 0;

-- 4. RPC compute_cogs - calculate & consume cost layers
CREATE OR REPLACE FUNCTION public.compute_cogs(
  p_company_id UUID,
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method TEXT;
  v_total_cost NUMERIC := 0;
  v_remaining NUMERIC := p_quantity;
  v_avg NUMERIC := 0;
  layer RECORD;
  v_take NUMERIC;
BEGIN
  SELECT costing_method INTO v_method FROM public.companies WHERE id = p_company_id;
  v_method := COALESCE(v_method, 'average');

  IF v_method = 'average' THEN
    SELECT COALESCE(average_cost,0) INTO v_avg
    FROM public.inventory_stock
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    RETURN ROUND(p_quantity * v_avg, 2);
  END IF;

  -- FIFO: consume oldest layers
  FOR layer IN
    SELECT id, remaining_qty, unit_cost
    FROM public.inventory_movements
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND movement_type IN ('in','adjustment_in','transfer_in')
      AND remaining_qty > 0
    ORDER BY movement_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(layer.remaining_qty, v_remaining);
    v_total_cost := v_total_cost + v_take * COALESCE(layer.unit_cost,0);
    UPDATE public.inventory_movements
      SET remaining_qty = remaining_qty - v_take
      WHERE id = layer.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    -- fallback: pakai avg jika layer habis (negative stock case)
    SELECT COALESCE(average_cost,0) INTO v_avg
    FROM public.inventory_stock
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    v_total_cost := v_total_cost + v_remaining * v_avg;
  END IF;

  RETURN ROUND(v_total_cost, 2);
END;
$$;

-- 5. Update _record_inventory_movement to maintain WAC + FIFO layers
CREATE OR REPLACE FUNCTION public._record_inventory_movement(
  p_company_id uuid, p_product_id uuid, p_warehouse_id uuid,
  p_movement_type text, p_quantity numeric, p_unit_cost numeric,
  p_reference_type text, p_reference_id uuid, p_reference_number text,
  p_movement_date date DEFAULT CURRENT_DATE, p_update_stock boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current numeric := 0;
  v_current_avg numeric := 0;
  v_new numeric;
  v_delta numeric;
  v_new_avg numeric;
  v_remaining numeric := 0;
  v_method TEXT;
  v_cogs NUMERIC := 0;
BEGIN
  IF p_product_id IS NULL OR p_warehouse_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(costing_method,'average') INTO v_method FROM public.companies WHERE id = p_company_id;

  SELECT COALESCE(quantity,0), COALESCE(average_cost,0)
    INTO v_current, v_current_avg
  FROM public.inventory_stock
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

  v_delta := CASE
    WHEN p_movement_type IN ('in','adjustment_in','transfer_in') THEN p_quantity
    WHEN p_movement_type IN ('out','adjustment_out','transfer_out') THEN -p_quantity
    WHEN p_movement_type = 'adjustment' THEN p_quantity
    ELSE 0
  END;

  v_new := v_current + v_delta;

  -- WAC recompute on IN
  IF v_delta > 0 AND (v_current + v_delta) > 0 THEN
    v_new_avg := ROUND(((v_current * v_current_avg) + (v_delta * COALESCE(p_unit_cost,0))) / (v_current + v_delta), 4);
  ELSE
    v_new_avg := v_current_avg;
  END IF;

  -- FIFO: IN creates a layer with remaining_qty
  IF v_delta > 0 THEN
    v_remaining := p_quantity;
  END IF;

  -- FIFO: OUT consumes layers (only if not already consumed externally via compute_cogs)
  IF v_method = 'fifo' AND v_delta < 0 THEN
    v_cogs := public.compute_cogs(p_company_id, p_product_id, p_warehouse_id, p_quantity);
    -- override unit_cost with average of consumed
    IF p_quantity > 0 THEN
      p_unit_cost := ROUND(v_cogs / p_quantity, 4);
    END IF;
  END IF;

  INSERT INTO public.inventory_movements(
    company_id, product_id, warehouse_id, movement_type, quantity, unit_cost,
    balance_after, reference_type, reference_id, reference_number,
    movement_date, created_by, remaining_qty
  ) VALUES (
    p_company_id, p_product_id, p_warehouse_id, p_movement_type, p_quantity, COALESCE(p_unit_cost,0),
    v_new, p_reference_type, p_reference_id, p_reference_number,
    p_movement_date, auth.uid(), v_remaining
  );

  IF p_update_stock THEN
    INSERT INTO public.inventory_stock(product_id, warehouse_id, quantity, average_cost)
    VALUES (p_product_id, p_warehouse_id, v_new, v_new_avg)
    ON CONFLICT (product_id, warehouse_id) DO UPDATE
      SET quantity = v_new,
          average_cost = v_new_avg,
          updated_at = now();
  END IF;
END;
$$;

-- 6. Backfill remaining_qty untuk existing IN movements (assume not yet consumed - best effort)
UPDATE public.inventory_movements
  SET remaining_qty = quantity
  WHERE movement_type IN ('in','adjustment_in','transfer_in')
    AND remaining_qty = 0
    AND quantity > 0;

-- 7. Backfill average_cost dari movements terakhir
UPDATE public.inventory_stock s
  SET average_cost = COALESCE((
    SELECT unit_cost FROM public.inventory_movements m
    WHERE m.product_id = s.product_id AND m.warehouse_id = s.warehouse_id
      AND m.movement_type IN ('in','adjustment_in','transfer_in')
      AND m.unit_cost > 0
    ORDER BY m.movement_date DESC, m.created_at DESC LIMIT 1
  ), 0)
  WHERE s.average_cost = 0;
