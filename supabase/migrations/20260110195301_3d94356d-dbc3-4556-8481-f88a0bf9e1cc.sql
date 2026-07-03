-- Create pos_tax_rates table for customizable tax rates
CREATE TABLE public.pos_tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pos_tax_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view tax rates for their companies"
ON public.pos_tax_rates
FOR SELECT
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage tax rates for their companies"
ON public.pos_tax_rates
FOR ALL
USING (user_has_company_access(auth.uid(), company_id));