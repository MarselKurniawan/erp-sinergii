-- Add business_type column to companies table
ALTER TABLE public.companies 
ADD COLUMN business_type text DEFAULT 'trading' CHECK (business_type IN ('trading', 'service', 'manufacturing'));

-- Add comment for clarity
COMMENT ON COLUMN public.companies.business_type IS 'Type of business: trading (dagang), service (jasa), manufacturing (manufaktur)';