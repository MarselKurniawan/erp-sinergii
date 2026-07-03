
-- ===== FASE 2: BANK RECONCILIATION =====
CREATE TABLE public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  statement_number TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reconciling','finalized')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bank_statements TO authenticated;
GRANT ALL ON public.bank_statements TO service_role;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_access" ON public.bank_statements FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_bs_updated BEFORE UPDATE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  description TEXT,
  ref_number TEXT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  matched_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  matched_je_line_id UUID REFERENCES public.journal_entry_lines(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','matched','manual','ignored')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bank_statement_lines TO authenticated;
GRANT ALL ON public.bank_statement_lines TO service_role;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsl_access" ON public.bank_statement_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bank_statements s WHERE s.id = statement_id AND user_has_company_access(auth.uid(), s.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bank_statements s WHERE s.id = statement_id AND user_has_company_access(auth.uid(), s.company_id)));

CREATE OR REPLACE FUNCTION public.auto_match_bank_lines(p_statement_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stmt RECORD; v_line RECORD; v_match UUID; v_count INTEGER := 0; v_amount NUMERIC;
BEGIN
  SELECT * INTO v_stmt FROM public.bank_statements WHERE id = p_statement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Statement tidak ditemukan'; END IF;
  IF NOT user_has_company_access(auth.uid(), v_stmt.company_id) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;

  FOR v_line IN SELECT * FROM public.bank_statement_lines
    WHERE statement_id = p_statement_id AND match_status = 'unmatched'
  LOOP
    v_amount := COALESCE(v_line.debit,0) + COALESCE(v_line.credit,0);
    SELECT p.id INTO v_match FROM public.payments p
    WHERE p.company_id = v_stmt.company_id
      AND ABS(p.amount - v_amount) < 0.01
      AND p.payment_date BETWEEN v_line.txn_date - 3 AND v_line.txn_date + 3
      AND NOT EXISTS (SELECT 1 FROM public.bank_statement_lines x WHERE x.matched_payment_id = p.id)
    ORDER BY ABS(p.payment_date - v_line.txn_date) LIMIT 1;
    IF v_match IS NOT NULL THEN
      UPDATE public.bank_statement_lines
        SET matched_payment_id = v_match, match_status = 'matched'
        WHERE id = v_line.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  UPDATE public.bank_statements SET status = 'reconciling' WHERE id = p_statement_id;
  RETURN v_count;
END $$;

CREATE TRIGGER audit_trg_bs AFTER INSERT OR UPDATE OR DELETE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ===== FASE 3: PRODUCTION ORDER =====
CREATE TABLE public.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  recipe_id UUID REFERENCES public.recipes(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  planned_qty NUMERIC NOT NULL,
  produced_qty NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  finish_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','cancelled')),
  total_material_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_orders TO authenticated;
GRANT ALL ON public.production_orders TO service_role;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_access" ON public.production_orders FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_trg_po AFTER INSERT OR UPDATE OR DELETE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TABLE public.production_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.products(id),
  planned_qty NUMERIC NOT NULL,
  consumed_qty NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_order_materials TO authenticated;
GRANT ALL ON public.production_order_materials TO service_role;
ALTER TABLE public.production_order_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pom_access" ON public.production_order_materials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_orders p WHERE p.id = production_order_id AND user_has_company_access(auth.uid(), p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders p WHERE p.id = production_order_id AND user_has_company_access(auth.uid(), p.company_id)));

CREATE OR REPLACE FUNCTION public.start_production(p_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po RECORD; v_mat RECORD; v_cogs NUMERIC; v_total NUMERIC := 0;
BEGIN
  SELECT * INTO v_po FROM public.production_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production order tidak ditemukan'; END IF;
  IF NOT user_has_company_access(auth.uid(), v_po.company_id) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF v_po.status <> 'draft' THEN RAISE EXCEPTION 'Hanya production order draft yang bisa dimulai'; END IF;

  FOR v_mat IN SELECT * FROM public.production_order_materials WHERE production_order_id = p_order_id
  LOOP
    v_cogs := public.compute_cogs(v_po.company_id, v_mat.material_id, v_po.warehouse_id, v_mat.planned_qty);
    PERFORM public._record_inventory_movement(
      v_po.company_id, v_mat.material_id, v_po.warehouse_id,
      'out', v_mat.planned_qty, CASE WHEN v_mat.planned_qty>0 THEN v_cogs/v_mat.planned_qty ELSE 0 END,
      'production_order', v_po.id, v_po.order_number, COALESCE(v_po.start_date, CURRENT_DATE), true
    );
    UPDATE public.production_order_materials
      SET consumed_qty = v_mat.planned_qty, unit_cost = CASE WHEN v_mat.planned_qty>0 THEN v_cogs/v_mat.planned_qty ELSE 0 END,
          total_cost = v_cogs
      WHERE id = v_mat.id;
    v_total := v_total + v_cogs;
  END LOOP;

  UPDATE public.production_orders
    SET status = 'in_progress', start_date = COALESCE(start_date, CURRENT_DATE),
        total_material_cost = v_total
    WHERE id = p_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_production(p_order_id UUID, p_actual_qty NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po RECORD; v_unit_cost NUMERIC;
BEGIN
  SELECT * INTO v_po FROM public.production_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production order tidak ditemukan'; END IF;
  IF NOT user_has_company_access(auth.uid(), v_po.company_id) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF v_po.status <> 'in_progress' THEN RAISE EXCEPTION 'Hanya production order yang sedang berjalan yang bisa diselesaikan'; END IF;
  IF p_actual_qty <= 0 THEN RAISE EXCEPTION 'Quantity hasil produksi harus > 0'; END IF;

  v_unit_cost := v_po.total_material_cost / p_actual_qty;

  PERFORM public._record_inventory_movement(
    v_po.company_id, v_po.product_id, v_po.warehouse_id,
    'in', p_actual_qty, v_unit_cost,
    'production_order', v_po.id, v_po.order_number, CURRENT_DATE, true
  );

  UPDATE public.production_orders
    SET status = 'completed', produced_qty = p_actual_qty, finish_date = CURRENT_DATE
    WHERE id = p_order_id;
END $$;

-- ===== FASE 4a: SOFT DELETE / VOID =====
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['invoices','bills','payments','journal_entries','pos_transactions','sales_orders','purchase_orders']) LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS voided_by UUID', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS void_reason TEXT', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.void_transaction(
  p_entity_type TEXT, p_entity_id UUID, p_reason TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id UUID; v_je RECORD; v_line RECORD; v_new_je UUID; v_num TEXT;
BEGIN
  IF p_entity_type NOT IN ('invoices','bills','payments','journal_entries','pos_transactions','sales_orders','purchase_orders') THEN
    RAISE EXCEPTION 'Entity type tidak didukung';
  END IF;

  EXECUTE format('SELECT company_id FROM public.%I WHERE id = $1', p_entity_type) INTO v_company_id USING p_entity_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Data tidak ditemukan'; END IF;
  IF NOT user_has_company_access(auth.uid(), v_company_id) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;

  EXECUTE format('UPDATE public.%I SET voided_at = now(), voided_by = auth.uid(), void_reason = $1 WHERE id = $2', p_entity_type)
    USING p_reason, p_entity_id;

  -- create reversing JE for journal_entries
  IF p_entity_type = 'journal_entries' THEN
    SELECT * INTO v_je FROM public.journal_entries WHERE id = p_entity_id;
    v_num := public.generate_document_number(v_company_id, 'JE');
    INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, created_by, status)
      VALUES (v_company_id, v_num, CURRENT_DATE, 'VOID/Reversal: '||v_je.entry_number||' - '||COALESCE(p_reason,''), auth.uid(), 'posted')
      RETURNING id INTO v_new_je;
    FOR v_line IN SELECT * FROM public.journal_entry_lines WHERE journal_entry_id = p_entity_id LOOP
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
        VALUES (v_new_je, v_line.account_id, v_line.credit, v_line.debit, 'Reversal');
    END LOOP;
  END IF;
END $$;

-- ===== FASE 4b: ATTACHMENTS =====
CREATE TABLE public.transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.transaction_attachments TO authenticated;
GRANT ALL ON public.transaction_attachments TO service_role;
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_access" ON public.transaction_attachments FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE INDEX idx_att_entity ON public.transaction_attachments(entity_type, entity_id);

-- ===== FASE 4c: NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_self" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_notif_user_unread ON public.notifications(user_id, read_at);

CREATE OR REPLACE FUNCTION public.generate_notifications()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER := 0; r RECORD;
BEGIN
  -- Invoices due in <=7 days
  FOR r IN
    SELECT i.id, i.invoice_number, i.due_date, i.outstanding_amount, i.company_id, uc.user_id
    FROM public.invoices i
    JOIN public.user_companies uc ON uc.company_id = i.company_id
    WHERE i.outstanding_amount > 0
      AND i.voided_at IS NULL
      AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = uc.user_id AND n.type='invoice_due'
          AND n.title LIKE '%'||i.invoice_number||'%'
          AND n.created_at > now() - interval '1 day'
      )
  LOOP
    INSERT INTO public.notifications(user_id, company_id, type, title, message, link)
    VALUES (r.user_id, r.company_id, 'invoice_due',
            'Invoice '||r.invoice_number||' jatuh tempo '||r.due_date,
            'Outstanding: '||r.outstanding_amount, '/sales/invoices');
    v_count := v_count + 1;
  END LOOP;

  -- Bills due
  FOR r IN
    SELECT b.id, b.bill_number, b.due_date, b.outstanding_amount, b.company_id, uc.user_id
    FROM public.bills b
    JOIN public.user_companies uc ON uc.company_id = b.company_id
    WHERE b.outstanding_amount > 0
      AND b.voided_at IS NULL
      AND b.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = uc.user_id AND n.type='bill_due'
          AND n.title LIKE '%'||b.bill_number||'%'
          AND n.created_at > now() - interval '1 day'
      )
  LOOP
    INSERT INTO public.notifications(user_id, company_id, type, title, message, link)
    VALUES (r.user_id, r.company_id, 'bill_due',
            'Bill '||r.bill_number||' jatuh tempo '||r.due_date,
            'Outstanding: '||r.outstanding_amount, '/purchases/bills');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

-- audit triggers for new tables
CREATE TRIGGER audit_trg_pord AFTER INSERT OR UPDATE OR DELETE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
