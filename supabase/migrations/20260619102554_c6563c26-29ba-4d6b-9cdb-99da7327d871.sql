
-- ============== EXPENSES ==============
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  expense_number TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  payment_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  reference_no TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  voided_at TIMESTAMPTZ, voided_by UUID, void_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_access" ON public.expenses FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_expenses_company_date ON public.expenses(company_id, expense_date);

-- ============== CASH/BANK TRANSFERS ==============
CREATE TABLE public.cash_bank_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  to_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_account_id UUID REFERENCES public.chart_of_accounts(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  voided_at TIMESTAMPTZ, voided_by UUID, void_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_bank_transfers TO authenticated;
GRANT ALL ON public.cash_bank_transfers TO service_role;
ALTER TABLE public.cash_bank_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_transfers_access" ON public.cash_bank_transfers FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_cbtransfers_updated BEFORE UPDATE ON public.cash_bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== PURCHASE RETURNS ==============
CREATE TABLE public.purchase_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  bill_id UUID REFERENCES public.bills(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  voided_at TIMESTAMPTZ, voided_by UUID, void_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_returns TO authenticated;
GRANT ALL ON public.purchase_returns TO service_role;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_access" ON public.purchase_returns FOR ALL TO authenticated
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_pr_updated BEFORE UPDATE ON public.purchase_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.purchase_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_return_items TO authenticated;
GRANT ALL ON public.purchase_return_items TO service_role;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pri_access" ON public.purchase_return_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_returns pr WHERE pr.id = return_id AND user_has_company_access(auth.uid(), pr.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_returns pr WHERE pr.id = return_id AND user_has_company_access(auth.uid(), pr.company_id)));
CREATE INDEX idx_pri_return ON public.purchase_return_items(return_id);
