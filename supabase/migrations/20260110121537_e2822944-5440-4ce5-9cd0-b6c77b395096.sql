-- Fix RLS policies for receipt_settings - parameter order is wrong
DROP POLICY IF EXISTS "Users can manage receipt settings for their companies" ON public.receipt_settings;
DROP POLICY IF EXISTS "Users can view receipt settings for their companies" ON public.receipt_settings;

CREATE POLICY "Users can manage receipt settings for their companies"
ON public.receipt_settings
FOR ALL
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can view receipt settings for their companies"
ON public.receipt_settings
FOR SELECT
USING (user_has_company_access(auth.uid(), company_id));

-- Fix RLS policies for receipt_split_rules - parameter order is wrong
DROP POLICY IF EXISTS "Users can manage receipt split rules for their companies" ON public.receipt_split_rules;
DROP POLICY IF EXISTS "Users can view receipt split rules for their companies" ON public.receipt_split_rules;

CREATE POLICY "Users can manage receipt split rules for their companies"
ON public.receipt_split_rules
FOR ALL
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can view receipt split rules for their companies"
ON public.receipt_split_rules
FOR SELECT
USING (user_has_company_access(auth.uid(), company_id));