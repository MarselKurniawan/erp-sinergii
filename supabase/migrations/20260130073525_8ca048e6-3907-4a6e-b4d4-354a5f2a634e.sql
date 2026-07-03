-- Create promotions table with time-based validity
CREATE TABLE public.pos_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  promo_code TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed', 'buy_x_get_y')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_discount NUMERIC DEFAULT NULL,
  min_purchase NUMERIC DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'product')),
  applies_to_ids UUID[] DEFAULT NULL,
  usage_limit INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for promotions
ALTER TABLE public.pos_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage promotions for their companies" 
ON public.pos_promotions 
FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can view promotions for their companies" 
ON public.pos_promotions 
FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

-- Add open_table_id to pos_deposits for linking deposits to open tables
ALTER TABLE public.pos_deposits 
ADD COLUMN IF NOT EXISTS open_table_id UUID REFERENCES public.pos_open_tables(id) ON DELETE SET NULL;

-- Add folio/invoice tracking to deposits
ALTER TABLE public.pos_deposits 
ADD COLUMN IF NOT EXISTS folio_number TEXT;

-- Add customer lookup fields to deposits (existing customer relation)
ALTER TABLE public.pos_deposits 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Add pos_transaction_id to link deposits when converted to sales
ALTER TABLE public.pos_deposits 
ADD COLUMN IF NOT EXISTS pos_transaction_id UUID REFERENCES public.pos_transactions(id) ON DELETE SET NULL;

-- Add guest count to transactions for better reporting
ALTER TABLE public.pos_transactions
ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 1;

-- Add service charge amount to transactions
ALTER TABLE public.pos_transactions
ADD COLUMN IF NOT EXISTS service_amount NUMERIC DEFAULT 0;

-- Add rounding amount to transactions for accurate tracking
ALTER TABLE public.pos_transactions
ADD COLUMN IF NOT EXISTS rounding_amount NUMERIC DEFAULT 0;