
-- Create pos_payment_methods table for configuring payment types and their accounts
CREATE TABLE public.pos_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  account_id UUID REFERENCES public.chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pos_cash_sessions table for shift management
CREATE TABLE public.pos_cash_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opened_by UUID,
  closed_by UUID,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC,
  expected_balance NUMERIC,
  difference NUMERIC,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- Create pos_transaction_payments table for multi-payment support
CREATE TABLE public.pos_transaction_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pos_transaction_id UUID NOT NULL REFERENCES public.pos_transactions(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.pos_payment_methods(id),
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to pos_transactions
ALTER TABLE public.pos_transactions 
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'held', 'cancelled')),
ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.pos_cash_sessions(id),
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS change_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Add discount and tax to pos_transaction_items
ALTER TABLE public.pos_transaction_items
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

-- Add cashier role to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cashier' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'cashier';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.pos_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transaction_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_payment_methods
CREATE POLICY "Users can view payment methods for their companies" ON public.pos_payment_methods
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage payment methods for their companies" ON public.pos_payment_methods
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- RLS Policies for pos_cash_sessions
CREATE POLICY "Users can view cash sessions for their companies" ON public.pos_cash_sessions
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage cash sessions for their companies" ON public.pos_cash_sessions
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- RLS Policies for pos_transaction_payments
CREATE POLICY "Users can view transaction payments" ON public.pos_transaction_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pos_transactions pt 
      WHERE pt.id = pos_transaction_id 
      AND public.user_has_company_access(auth.uid(), pt.company_id)
    )
  );

CREATE POLICY "Users can manage transaction payments" ON public.pos_transaction_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pos_transactions pt 
      WHERE pt.id = pos_transaction_id 
      AND public.user_has_company_access(auth.uid(), pt.company_id)
    )
  );
