-- Add company_name field to pos_deposits table
ALTER TABLE public.pos_deposits 
ADD COLUMN IF NOT EXISTS company_name text;