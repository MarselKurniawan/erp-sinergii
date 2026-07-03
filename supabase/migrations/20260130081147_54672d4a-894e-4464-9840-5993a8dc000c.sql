-- Add category column to pos_tax_rates table
ALTER TABLE public.pos_tax_rates 
ADD COLUMN category text NOT NULL DEFAULT 'tax' 
CHECK (category IN ('tax', 'service'));