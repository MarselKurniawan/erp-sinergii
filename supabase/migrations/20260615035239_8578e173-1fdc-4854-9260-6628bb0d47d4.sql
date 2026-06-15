-- ============================================================
-- 1. UPDATE create_invoice_from_sales_order — handle DP allocation
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invoice_from_sales_order(
  p_sales_order_id uuid,
  p_quantities jsonb DEFAULT NULL,
  p_invoice_date date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_so RECORD;
  v_invoice_id uuid;
  v_invoice_number text;
  v_item RECORD;
  v_qty numeric;
  v_remaining numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total numeric := 0;
  v_dp_available numeric := 0;
  v_dp_applied numeric := 0;
BEGIN
  SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sales order tidak ditemukan'; END IF;
  IF NOT user_has_company_access(auth.uid(), v_so.company_id) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  v_invoice_number := public.generate_document_number(v_so.company_id, 'INV');

  INSERT INTO public.invoices(
    company_id, invoice_number, sales_order_id, customer_id,
    invoice_date, due_date, status, subtotal, tax_amount, total_amount,
    outstanding_amount, paid_amount, created_by
  ) VALUES (
    v_so.company_id, v_invoice_number, v_so.id, v_so.customer_id,
    p_invoice_date, COALESCE(p_due_date, p_invoice_date + 30), 'pending',
    0, 0, 0, 0, 0, auth.uid()
  ) RETURNING id INTO v_invoice_id;

  FOR v_item IN
    SELECT * FROM public.sales_order_items WHERE sales_order_id = p_sales_order_id
  LOOP
    v_remaining := v_item.quantity - COALESCE(v_item.invoiced_quantity, 0);
    IF v_remaining <= 0 THEN CONTINUE; END IF;

    IF p_quantities IS NOT NULL AND p_quantities ? v_item.id::text THEN
      v_qty := (p_quantities->>v_item.id::text)::numeric;
    ELSE
      v_qty := v_remaining;
    END IF;

    IF v_qty <= 0 THEN CONTINUE; END IF;
    IF v_qty > v_remaining THEN
      RAISE EXCEPTION 'Quantity invoice (%) melebihi sisa (%)', v_qty, v_remaining;
    END IF;

    v_line_total := v_qty * v_item.unit_price * (1 - COALESCE(v_item.discount_percent,0)/100);

    INSERT INTO public.invoice_items(
      invoice_id, product_id, quantity, unit_price, discount_percent, tax_percent, total
    ) VALUES (
      v_invoice_id, v_item.product_id, v_qty, v_item.unit_price,
      COALESCE(v_item.discount_percent,0), COALESCE(v_item.tax_percent,0), v_line_total
    );

    v_subtotal := v_subtotal + v_line_total;
    v_tax_total := v_tax_total + v_line_total * COALESCE(v_item.tax_percent,0)/100;

    UPDATE public.sales_order_items
      SET invoiced_quantity = COALESCE(invoiced_quantity,0) + v_qty
      WHERE id = v_item.id;
  END LOOP;

  v_total := v_subtotal + v_tax_total;

  IF v_total = 0 THEN
    DELETE FROM public.invoices WHERE id = v_invoice_id;
    RAISE EXCEPTION 'Tidak ada item untuk diinvoice';
  END IF;

  -- DP allocation: how much DP is still unapplied
  v_dp_available := COALESCE(v_so.dp_paid, 0) - COALESCE((
    SELECT SUM(i.paid_amount) FROM public.invoices i
    WHERE i.sales_order_id = v_so.id AND i.id != v_invoice_id
  ), 0);

  IF v_dp_available > 0 THEN
    v_dp_applied := LEAST(v_dp_available, v_total);
  END IF;

  UPDATE public.invoices
    SET subtotal = v_subtotal,
        tax_amount = v_tax_total,
        total_amount = v_total,
        paid_amount = v_dp_applied,
        outstanding_amount = v_total - v_dp_applied,
        status = CASE WHEN v_dp_applied >= v_total THEN 'paid' ELSE 'pending' END,
        notes = CASE WHEN v_dp_applied > 0
                     THEN 'DP dialokasikan: ' || v_dp_applied::text
                     ELSE NULL END
    WHERE id = v_invoice_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.sales_order_items
    WHERE sales_order_id = p_sales_order_id
      AND quantity > COALESCE(invoiced_quantity,0)
  ) THEN
    UPDATE public.sales_orders SET status = 'invoiced' WHERE id = p_sales_order_id;
  END IF;

  RETURN v_invoice_id;
END;
$$;

-- ============================================================
-- 2. INVENTORY MOVEMENT triggers
-- ============================================================

-- Helper: record movement + update stock
CREATE OR REPLACE FUNCTION public._record_inventory_movement(
  p_company_id uuid, p_product_id uuid, p_warehouse_id uuid,
  p_movement_type text, p_quantity numeric, p_unit_cost numeric,
  p_reference_type text, p_reference_id uuid, p_reference_number text,
  p_movement_date date DEFAULT CURRENT_DATE,
  p_update_stock boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_current numeric := 0;
  v_new numeric;
  v_delta numeric;
BEGIN
  IF p_product_id IS NULL OR p_warehouse_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(quantity,0) INTO v_current
  FROM public.inventory_stock
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

  v_delta := CASE
    WHEN p_movement_type IN ('in','adjustment_in','transfer_in') THEN p_quantity
    WHEN p_movement_type IN ('out','adjustment_out','transfer_out') THEN -p_quantity
    WHEN p_movement_type = 'adjustment' THEN p_quantity -- signed
    ELSE 0
  END;

  v_new := v_current + v_delta;

  INSERT INTO public.inventory_movements(
    company_id, product_id, warehouse_id, movement_type, quantity, unit_cost,
    balance_after, reference_type, reference_id, reference_number,
    movement_date, created_by
  ) VALUES (
    p_company_id, p_product_id, p_warehouse_id, p_movement_type, p_quantity, p_unit_cost,
    v_new, p_reference_type, p_reference_id, p_reference_number,
    p_movement_date, auth.uid()
  );

  IF p_update_stock THEN
    INSERT INTO public.inventory_stock(product_id, warehouse_id, quantity)
    VALUES (p_product_id, p_warehouse_id, v_new)
    ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = v_new, updated_at = now();
  END IF;
END;
$$;

-- 2a. Goods Receipt Items → IN
CREATE OR REPLACE FUNCTION public.trg_gri_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_gr RECORD; v_wh uuid;
BEGIN
  SELECT * INTO v_gr FROM public.goods_receipts WHERE id = NEW.receipt_id;
  v_wh := COALESCE(NEW.warehouse_id, v_gr.warehouse_id);
  IF v_wh IS NULL THEN RETURN NEW; END IF;
  PERFORM public._record_inventory_movement(
    v_gr.company_id, NEW.product_id, v_wh,
    'in', COALESCE(NEW.quantity_received,0), COALESCE(NEW.unit_cost,0),
    'goods_receipt', v_gr.id, v_gr.receipt_number,
    v_gr.receipt_date, true
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gri_inv ON public.goods_receipt_items;
CREATE TRIGGER trg_gri_inv AFTER INSERT ON public.goods_receipt_items
FOR EACH ROW WHEN (NEW.quantity_received > 0) EXECUTE FUNCTION public.trg_gri_inventory();

-- 2b. Stock Transfer on status → completed
CREATE OR REPLACE FUNCTION public.trg_st_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    FOR r IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = NEW.id LOOP
      PERFORM public._record_inventory_movement(
        NEW.company_id, r.product_id, NEW.from_warehouse_id,
        'transfer_out', r.quantity, 0,
        'stock_transfer', NEW.id, NEW.transfer_number,
        NEW.transfer_date, false
      );
      PERFORM public._record_inventory_movement(
        NEW.company_id, r.product_id, NEW.to_warehouse_id,
        'transfer_in', r.quantity, 0,
        'stock_transfer', NEW.id, NEW.transfer_number,
        NEW.transfer_date, false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_st_inv ON public.stock_transfers;
CREATE TRIGGER trg_st_inv AFTER UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.trg_st_inventory();

-- 2c. Stock Opname on status → completed
CREATE OR REPLACE FUNCTION public.trg_so_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    FOR r IN SELECT * FROM public.stock_opname_items WHERE opname_id = NEW.id LOOP
      IF COALESCE(r.difference,0) <> 0 THEN
        PERFORM public._record_inventory_movement(
          NEW.company_id, r.product_id, NEW.warehouse_id,
          'adjustment', r.difference, 0,
          'stock_opname', NEW.id, NEW.opname_number,
          NEW.opname_date, false
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_so_inv ON public.stock_opname;
CREATE TRIGGER trg_so_inv AFTER UPDATE ON public.stock_opname
FOR EACH ROW EXECUTE FUNCTION public.trg_so_inventory();

-- ============================================================
-- 3. PERIOD CLOSING GUARD
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_period_closed(p_company_id uuid, p_date date)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max date;
BEGIN
  IF public.is_superadmin(auth.uid()) THEN RETURN; END IF;
  SELECT MAX(period_end) INTO v_max
  FROM public.period_closings
  WHERE company_id = p_company_id AND status = 'closed';
  IF v_max IS NOT NULL AND p_date <= v_max THEN
    RAISE EXCEPTION 'Periode hingga % sudah ditutup. Tidak bisa input/ubah transaksi tanggal %.', v_max, p_date
      USING ERRCODE = 'P0001';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_guard_period_je()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.entry_date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.journal_entries;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_je();

CREATE OR REPLACE FUNCTION public.trg_guard_period_inv()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.invoice_date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.invoices;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_inv();

CREATE OR REPLACE FUNCTION public.trg_guard_period_bill()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.bill_date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.bills;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_bill();

CREATE OR REPLACE FUNCTION public.trg_guard_period_pay()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.payment_date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.payments;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_pay();

CREATE OR REPLACE FUNCTION public.trg_guard_period_pos()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.transaction_date::date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.pos_transactions;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.pos_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_pos();

CREATE OR REPLACE FUNCTION public.trg_guard_period_so()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.order_date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.sales_orders;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_so();

CREATE OR REPLACE FUNCTION public.trg_guard_period_po()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.order_date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.purchase_orders;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_po();

CREATE OR REPLACE FUNCTION public.trg_guard_period_gr()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.check_period_closed(NEW.company_id, NEW.receipt_date); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_guard_period ON public.goods_receipts;
CREATE TRIGGER trg_guard_period BEFORE INSERT OR UPDATE ON public.goods_receipts
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_period_gr();