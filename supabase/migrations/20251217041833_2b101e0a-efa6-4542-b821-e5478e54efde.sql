-- Drop the existing buggy policy
DROP POLICY IF EXISTS "Users can view assigned companies" ON public.companies;

-- Create the fixed policy - comparing company_id to companies.id correctly
CREATE POLICY "Users can view assigned companies" 
ON public.companies 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR EXISTS (
    SELECT 1 FROM user_companies 
    WHERE user_companies.user_id = auth.uid() 
    AND user_companies.company_id = companies.id
  )
);