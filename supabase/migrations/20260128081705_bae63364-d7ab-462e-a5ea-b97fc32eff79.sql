-- Add invoice_number to POS transactions
ALTER TABLE public.pos_transactions 
ADD COLUMN IF NOT EXISTS invoice_number text;

-- Create pos_open_tables table for open table feature
CREATE TABLE public.pos_open_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  table_name text NOT NULL,
  customer_name text,
  customer_phone text,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  created_by uuid,
  notes text,
  subtotal numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  total_cogs numeric DEFAULT 0
);

-- Create pos_open_table_items for items in open tables
CREATE TABLE public.pos_open_table_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  open_table_id uuid NOT NULL REFERENCES public.pos_open_tables(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  cost_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_percent numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total numeric NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  served_at timestamp with time zone
);

-- Create pos_deposits for deposit/DP management
CREATE TABLE public.pos_deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  deposit_number text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  event_name text NOT NULL,
  event_date date NOT NULL,
  deposit_amount numeric NOT NULL,
  total_estimated numeric DEFAULT 0,
  remaining_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  cash_account_id uuid REFERENCES public.chart_of_accounts(id),
  payment_method_id uuid REFERENCES public.pos_payment_methods(id),
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.pos_open_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_open_table_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_deposits ENABLE ROW LEVEL SECURITY;

-- RLS policies for pos_open_tables
CREATE POLICY "Users can view open tables for their companies" 
ON public.pos_open_tables 
FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage open tables for their companies" 
ON public.pos_open_tables 
FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

-- RLS policies for pos_open_table_items
CREATE POLICY "Users can view open table items" 
ON public.pos_open_table_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.pos_open_tables t 
  WHERE t.id = pos_open_table_items.open_table_id 
  AND user_has_company_access(auth.uid(), t.company_id)
));

CREATE POLICY "Users can manage open table items" 
ON public.pos_open_table_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.pos_open_tables t 
  WHERE t.id = pos_open_table_items.open_table_id 
  AND user_has_company_access(auth.uid(), t.company_id)
));

-- RLS policies for pos_deposits
CREATE POLICY "Users can view deposits for their companies" 
ON public.pos_deposits 
FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage deposits for their companies" 
ON public.pos_deposits 
FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));