-- Add down payment columns to sales_orders
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS dp_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS dp_paid numeric DEFAULT 0;

-- Add down payment columns to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS dp_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS dp_paid numeric DEFAULT 0;

-- Create down_payments table to track DP transactions
CREATE TABLE IF NOT EXISTS public.down_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  payment_type text NOT NULL CHECK (payment_type IN ('sales', 'purchase')),
  sales_order_id uuid REFERENCES public.sales_orders(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  cash_account_id uuid REFERENCES public.chart_of_accounts(id),
  dp_number text NOT NULL,
  dp_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.down_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for down_payments
CREATE POLICY "Users can view down payments for their companies"
ON public.down_payments
FOR SELECT
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage down payments for their companies"
ON public.down_payments
FOR ALL
USING (user_has_company_access(auth.uid(), company_id));