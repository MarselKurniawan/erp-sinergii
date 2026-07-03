
-- Create enum for depreciation method
CREATE TYPE depreciation_method AS ENUM ('straight_line', 'declining_balance');

-- Create enum for asset status
CREATE TYPE asset_status AS ENUM ('active', 'disposed', 'fully_depreciated');

-- POS Transactions table
CREATE TABLE public.pos_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transaction_number TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  total_cogs NUMERIC DEFAULT 0,
  cash_account_id UUID REFERENCES chart_of_accounts(id),
  revenue_account_id UUID REFERENCES chart_of_accounts(id),
  cogs_account_id UUID REFERENCES chart_of_accounts(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- POS Transaction Items table
CREATE TABLE public.pos_transaction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pos_transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fixed Assets table
CREATE TABLE public.fixed_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  purchase_date DATE NOT NULL,
  purchase_price NUMERIC NOT NULL,
  useful_life_months INTEGER NOT NULL,
  salvage_value NUMERIC DEFAULT 0,
  depreciation_method depreciation_method NOT NULL DEFAULT 'straight_line',
  asset_account_id UUID REFERENCES chart_of_accounts(id),
  depreciation_expense_account_id UUID REFERENCES chart_of_accounts(id),
  accumulated_depreciation_account_id UUID REFERENCES chart_of_accounts(id),
  current_value NUMERIC,
  accumulated_depreciation NUMERIC DEFAULT 0,
  status asset_status NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Asset Depreciation Records table
CREATE TABLE public.asset_depreciations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  depreciation_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  accumulated_total NUMERIC NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for POS Transactions
CREATE POLICY "Users can view POS transactions for their companies"
  ON public.pos_transactions FOR SELECT
  USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage POS transactions for their companies"
  ON public.pos_transactions FOR ALL
  USING (user_has_company_access(auth.uid(), company_id));

-- RLS Policies for POS Transaction Items
CREATE POLICY "Users can view POS transaction items"
  ON public.pos_transaction_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pos_transactions pt
    WHERE pt.id = pos_transaction_items.pos_transaction_id
    AND user_has_company_access(auth.uid(), pt.company_id)
  ));

CREATE POLICY "Users can manage POS transaction items"
  ON public.pos_transaction_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM pos_transactions pt
    WHERE pt.id = pos_transaction_items.pos_transaction_id
    AND user_has_company_access(auth.uid(), pt.company_id)
  ));

-- RLS Policies for Fixed Assets
CREATE POLICY "Users can view fixed assets for their companies"
  ON public.fixed_assets FOR SELECT
  USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage fixed assets for their companies"
  ON public.fixed_assets FOR ALL
  USING (user_has_company_access(auth.uid(), company_id));

-- RLS Policies for Asset Depreciations
CREATE POLICY "Users can view asset depreciations"
  ON public.asset_depreciations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM fixed_assets fa
    WHERE fa.id = asset_depreciations.asset_id
    AND user_has_company_access(auth.uid(), fa.company_id)
  ));

CREATE POLICY "Users can manage asset depreciations"
  ON public.asset_depreciations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM fixed_assets fa
    WHERE fa.id = asset_depreciations.asset_id
    AND user_has_company_access(auth.uid(), fa.company_id)
  ));

-- Add updated_at trigger for fixed_assets
CREATE TRIGGER update_fixed_assets_updated_at
  BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
