-- Create transaction tags table with fixed categories + custom tags
CREATE TABLE public.transaction_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'custom', -- 'operasional', 'investasi', 'pendanaan', 'custom'
  color VARCHAR(20) DEFAULT '#6366f1',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Junction table for journal entries and tags (many-to-many)
CREATE TABLE public.journal_entry_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.transaction_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(journal_entry_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for transaction_tags
CREATE POLICY "Users can view tags for their companies"
ON public.transaction_tags FOR SELECT
USING (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can create tags for their companies"
ON public.transaction_tags FOR INSERT
WITH CHECK (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can update tags for their companies"
ON public.transaction_tags FOR UPDATE
USING (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can delete custom tags for their companies"
ON public.transaction_tags FOR DELETE
USING (public.user_has_company_access(company_id, auth.uid()) AND is_system = false);

-- RLS policies for journal_entry_tags
CREATE POLICY "Users can view journal entry tags"
ON public.journal_entry_tags FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.journal_entries je
  WHERE je.id = journal_entry_id AND public.user_has_company_access(je.company_id, auth.uid())
));

CREATE POLICY "Users can create journal entry tags"
ON public.journal_entry_tags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.journal_entries je
  WHERE je.id = journal_entry_id AND public.user_has_company_access(je.company_id, auth.uid())
));

CREATE POLICY "Users can delete journal entry tags"
ON public.journal_entry_tags FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.journal_entries je
  WHERE je.id = journal_entry_id AND public.user_has_company_access(je.company_id, auth.uid())
));

-- Create period closing table for manual pivot
CREATE TABLE public.period_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'closed', -- 'closed', 'reopened'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Opening balances table for storing pivoted balances
CREATE TABLE public.opening_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  period_closing_id UUID REFERENCES public.period_closings(id) ON DELETE CASCADE,
  balance_date DATE NOT NULL,
  debit_balance NUMERIC(15,2) DEFAULT 0,
  credit_balance NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, account_id, balance_date)
);

-- Enable RLS
ALTER TABLE public.period_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;

-- RLS policies for period_closings
CREATE POLICY "Users can view period closings for their companies"
ON public.period_closings FOR SELECT
USING (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can create period closings for their companies"
ON public.period_closings FOR INSERT
WITH CHECK (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can update period closings for their companies"
ON public.period_closings FOR UPDATE
USING (public.user_has_company_access(company_id, auth.uid()));

-- RLS policies for opening_balances
CREATE POLICY "Users can view opening balances for their companies"
ON public.opening_balances FOR SELECT
USING (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can create opening balances for their companies"
ON public.opening_balances FOR INSERT
WITH CHECK (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can update opening balances for their companies"
ON public.opening_balances FOR UPDATE
USING (public.user_has_company_access(company_id, auth.uid()));