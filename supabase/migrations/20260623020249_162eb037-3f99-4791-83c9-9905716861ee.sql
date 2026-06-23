
-- ESTIMATES (Quotations)
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  converted_to_so_id UUID REFERENCES public.sales_orders(id),
  converted_to_invoice_id UUID REFERENCES public.invoices(id),
  created_by UUID,
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimates TO authenticated;
GRANT ALL ON public.estimates TO service_role;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimates_access" ON public.estimates FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_estimates_updated BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_estimates_audit AFTER INSERT OR UPDATE OR DELETE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TABLE public.estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_items TO authenticated;
GRANT ALL ON public.estimate_items TO service_role;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimate_items_access" ON public.estimate_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id AND user_has_company_access(auth.uid(), e.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id AND user_has_company_access(auth.uid(), e.company_id)));

-- SALES RETURNS
CREATE TABLE public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  customer_id UUID REFERENCES public.customers(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  refund_account_id UUID REFERENCES public.chart_of_accounts(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  notes TEXT,
  created_by UUID,
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_returns TO authenticated;
GRANT ALL ON public.sales_returns TO service_role;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_returns_access" ON public.sales_returns FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_sr_updated BEFORE UPDATE ON public.sales_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sr_audit AFTER INSERT OR UPDATE OR DELETE ON public.sales_returns FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TABLE public.sales_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_return_items TO authenticated;
GRANT ALL ON public.sales_return_items TO service_role;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_return_items_access" ON public.sales_return_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_returns r WHERE r.id = return_id AND user_has_company_access(auth.uid(), r.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales_returns r WHERE r.id = return_id AND user_has_company_access(auth.uid(), r.company_id)));
