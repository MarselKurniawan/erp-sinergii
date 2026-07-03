
-- Receipts: standalone cash/bank receipts (non-invoice income)
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id),
  income_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  cash_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  reference_no TEXT,
  notes TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID,
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts_company_access" ON public.receipts FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_receipts_updated BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_receipts_audit AFTER INSERT OR UPDATE OR DELETE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Capital Transactions: owner equity injection/withdrawal
CREATE TABLE public.capital_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_number TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('injection','withdrawal')),
  owner_name TEXT,
  equity_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  cash_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID,
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capital_transactions TO authenticated;
GRANT ALL ON public.capital_transactions TO service_role;
ALTER TABLE public.capital_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capital_company_access" ON public.capital_transactions FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_capital_updated BEFORE UPDATE ON public.capital_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_capital_audit AFTER INSERT OR UPDATE OR DELETE ON public.capital_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
