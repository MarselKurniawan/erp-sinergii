
-- ========== 1. Add partial tracking columns ==========
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS received_quantity numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoiced_quantity numeric(15,2) DEFAULT 0;

ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS invoiced_quantity numeric(15,2) DEFAULT 0;

ALTER TABLE public.goods_receipts
  ADD COLUMN IF NOT EXISTS warehouse_id uuid;

ALTER TABLE public.goods_receipt_items
  ADD COLUMN IF NOT EXISTS warehouse_id uuid,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed_quantity numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_order_item_id uuid;

-- ========== 2. inventory_movements (Kartu Stok / Stock Ledger) ==========
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  warehouse_id uuid,
  movement_type text NOT NULL CHECK (movement_type IN ('in','out','transfer_in','transfer_out','adjustment','opening')),
  quantity numeric(15,2) NOT NULL,
  unit_cost numeric(15,2) DEFAULT 0,
  balance_after numeric(15,2),
  reference_type text,
  reference_id uuid,
  reference_number text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage inventory movements"
  ON public.inventory_movements FOR ALL
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_inv_mov_product_date ON public.inventory_movements(product_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_company ON public.inventory_movements(company_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ref ON public.inventory_movements(reference_type, reference_id);

-- Audit trigger
CREATE TRIGGER trg_audit_inventory_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ========== 3. RPC: create_invoice_from_sales_order ==========
CREATE OR REPLACE FUNCTION public.create_invoice_from_sales_order(
  p_sales_order_id uuid,
  p_quantities jsonb DEFAULT NULL,
  p_invoice_date date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      RAISE EXCEPTION 'Quantity invoice (%) melebihi sisa (%) untuk item %', v_qty, v_remaining, v_item.product_id;
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
    RAISE EXCEPTION 'Tidak ada item untuk diinvoice (semua sudah ter-invoice atau quantity 0)';
  END IF;

  UPDATE public.invoices
    SET subtotal = v_subtotal, tax_amount = v_tax_total,
        total_amount = v_total, outstanding_amount = v_total
    WHERE id = v_invoice_id;

  -- Update SO status if all items fully invoiced
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

-- ========== 4. RPC: create_bill_from_goods_receipt ==========
CREATE OR REPLACE FUNCTION public.create_bill_from_goods_receipt(
  p_gr_id uuid,
  p_bill_date date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gr RECORD;
  v_po RECORD;
  v_bill_id uuid;
  v_bill_number text;
  v_item RECORD;
  v_qty numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total numeric := 0;
BEGIN
  SELECT * INTO v_gr FROM public.goods_receipts WHERE id = p_gr_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Goods Receipt tidak ditemukan'; END IF;
  IF NOT user_has_company_access(auth.uid(), v_gr.company_id) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_gr.purchase_order_id;

  v_bill_number := public.generate_document_number(v_gr.company_id, 'BILL');

  INSERT INTO public.bills(
    company_id, bill_number, purchase_order_id, supplier_id,
    bill_date, due_date, status, subtotal, tax_amount, total_amount,
    outstanding_amount, paid_amount, created_by, notes
  ) VALUES (
    v_gr.company_id, v_bill_number, v_po.id, v_po.supplier_id,
    p_bill_date, COALESCE(p_due_date, p_bill_date + 30), 'pending',
    0, 0, 0, 0, 0, auth.uid(),
    'Auto-generated dari GR ' || v_gr.receipt_number
  ) RETURNING id INTO v_bill_id;

  FOR v_item IN
    SELECT gri.*, poi.unit_price as po_unit_price, poi.discount_percent as po_disc, poi.tax_percent as po_tax
    FROM public.goods_receipt_items gri
    LEFT JOIN public.purchase_order_items poi
      ON poi.id = gri.purchase_order_item_id
      OR (poi.purchase_order_id = v_gr.purchase_order_id AND poi.product_id = gri.product_id)
    WHERE gri.receipt_id = p_gr_id
  LOOP
    v_qty := COALESCE(v_item.quantity_received,0) - COALESCE(v_item.billed_quantity,0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    v_unit_price := COALESCE(v_item.unit_cost, v_item.po_unit_price, 0);
    v_line_total := v_qty * v_unit_price * (1 - COALESCE(v_item.po_disc,0)/100);

    INSERT INTO public.bill_items(
      bill_id, product_id, quantity, unit_price, discount_percent, tax_percent, total
    ) VALUES (
      v_bill_id, v_item.product_id, v_qty, v_unit_price,
      COALESCE(v_item.po_disc,0), COALESCE(v_item.po_tax,0), v_line_total
    );

    v_subtotal := v_subtotal + v_line_total;
    v_tax_total := v_tax_total + v_line_total * COALESCE(v_item.po_tax,0)/100;

    UPDATE public.goods_receipt_items
      SET billed_quantity = COALESCE(billed_quantity,0) + v_qty
      WHERE id = v_item.id;
  END LOOP;

  v_total := v_subtotal + v_tax_total;

  IF v_total = 0 THEN
    DELETE FROM public.bills WHERE id = v_bill_id;
    RAISE EXCEPTION 'Tidak ada item untuk di-bill (semua sudah ter-bill)';
  END IF;

  UPDATE public.bills
    SET subtotal = v_subtotal, tax_amount = v_tax_total,
        total_amount = v_total, outstanding_amount = v_total
    WHERE id = v_bill_id;

  RETURN v_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invoice_from_sales_order(uuid, jsonb, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bill_from_goods_receipt(uuid, date, date) TO authenticated;
