
-- ============ EXPENSE CATEGORIES ============
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  expense_account_id UUID REFERENCES public.chart_of_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company access expense_categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER expense_categories_uat BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_category_id UUID REFERENCES public.expense_categories(id);

-- ============ RECURRING TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.recurring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('invoice', 'bill')),
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  next_run DATE NOT NULL,
  end_date DATE,
  due_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_generated_id UUID,
  total_generated INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_templates TO authenticated;
GRANT ALL ON public.recurring_templates TO service_role;
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company access recurring_templates" ON public.recurring_templates
  FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER recurring_templates_uat BEFORE UPDATE ON public.recurring_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: advance next_run based on frequency
CREATE OR REPLACE FUNCTION public._advance_next_run(p_date DATE, p_freq TEXT, p_interval INT)
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_freq
    WHEN 'daily'   THEN p_date + (p_interval || ' day')::interval
    WHEN 'weekly'  THEN p_date + (p_interval || ' week')::interval
    WHEN 'monthly' THEN p_date + (p_interval || ' month')::interval
    WHEN 'yearly'  THEN p_date + (p_interval || ' year')::interval
  END::date
$$;

-- Generator RPC
CREATE OR REPLACE FUNCTION public.generate_recurring_documents(p_company_id UUID DEFAULT NULL, p_as_of DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t RECORD; item JSONB; v_new_id UUID; v_num TEXT;
  v_subtotal NUMERIC; v_tax_total NUMERIC; v_total NUMERIC;
  v_line_total NUMERIC; v_count INT := 0;
BEGIN
  FOR t IN
    SELECT * FROM public.recurring_templates
    WHERE is_active = TRUE
      AND next_run <= p_as_of
      AND (end_date IS NULL OR next_run <= end_date)
      AND (p_company_id IS NULL OR company_id = p_company_id)
      AND user_has_company_access(auth.uid(), company_id)
  LOOP
    v_subtotal := 0; v_tax_total := 0;

    IF t.doc_type = 'invoice' THEN
      v_num := public.generate_document_number(t.company_id, 'INV');
      INSERT INTO public.invoices(company_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, outstanding_amount, paid_amount, created_by, notes)
      VALUES (t.company_id, v_num, t.customer_id, t.next_run, t.next_run + t.due_days, 'pending', 0, 0, 0, 0, 0, t.created_by, COALESCE(t.notes,'') || ' (Recurring: ' || t.name || ')')
      RETURNING id INTO v_new_id;

      FOR item IN SELECT * FROM jsonb_array_elements(t.items) LOOP
        v_line_total := (item->>'quantity')::numeric * (item->>'unit_price')::numeric
                        * (1 - COALESCE((item->>'discount_percent')::numeric,0)/100);
        INSERT INTO public.invoice_items(invoice_id, product_id, quantity, unit_price, discount_percent, tax_percent, total)
        VALUES (v_new_id, NULLIF(item->>'product_id','')::uuid,
                (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
                COALESCE((item->>'discount_percent')::numeric,0),
                COALESCE((item->>'tax_percent')::numeric,0), v_line_total);
        v_subtotal := v_subtotal + v_line_total;
        v_tax_total := v_tax_total + v_line_total * COALESCE((item->>'tax_percent')::numeric,0)/100;
      END LOOP;

      v_total := v_subtotal + v_tax_total;
      UPDATE public.invoices SET subtotal = v_subtotal, tax_amount = v_tax_total,
        total_amount = v_total, outstanding_amount = v_total WHERE id = v_new_id;

    ELSE -- bill
      v_num := public.generate_document_number(t.company_id, 'BILL');
      INSERT INTO public.bills(company_id, bill_number, supplier_id, bill_date, due_date, status, subtotal, tax_amount, total_amount, outstanding_amount, paid_amount, created_by, notes)
      VALUES (t.company_id, v_num, t.supplier_id, t.next_run, t.next_run + t.due_days, 'pending', 0, 0, 0, 0, 0, t.created_by, COALESCE(t.notes,'') || ' (Recurring: ' || t.name || ')')
      RETURNING id INTO v_new_id;

      FOR item IN SELECT * FROM jsonb_array_elements(t.items) LOOP
        v_line_total := (item->>'quantity')::numeric * (item->>'unit_price')::numeric
                        * (1 - COALESCE((item->>'discount_percent')::numeric,0)/100);
        INSERT INTO public.bill_items(bill_id, product_id, quantity, unit_price, discount_percent, tax_percent, total)
        VALUES (v_new_id, NULLIF(item->>'product_id','')::uuid,
                (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
                COALESCE((item->>'discount_percent')::numeric,0),
                COALESCE((item->>'tax_percent')::numeric,0), v_line_total);
        v_subtotal := v_subtotal + v_line_total;
        v_tax_total := v_tax_total + v_line_total * COALESCE((item->>'tax_percent')::numeric,0)/100;
      END LOOP;

      v_total := v_subtotal + v_tax_total;
      UPDATE public.bills SET subtotal = v_subtotal, tax_amount = v_tax_total,
        total_amount = v_total, outstanding_amount = v_total WHERE id = v_new_id;
    END IF;

    UPDATE public.recurring_templates
      SET next_run = public._advance_next_run(next_run, frequency, interval_count),
          last_run_at = now(),
          last_generated_id = v_new_id,
          total_generated = total_generated + 1,
          is_active = CASE WHEN end_date IS NOT NULL
                           AND public._advance_next_run(next_run, frequency, interval_count) > end_date
                           THEN FALSE ELSE is_active END
      WHERE id = t.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
