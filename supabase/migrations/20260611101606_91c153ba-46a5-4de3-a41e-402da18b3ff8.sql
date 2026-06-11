CREATE TABLE public.product_tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tax_rate_id uuid NOT NULL REFERENCES public.pos_tax_rates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, tax_rate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_tax_rates TO authenticated;
GRANT ALL ON public.product_tax_rates TO service_role;

ALTER TABLE public.product_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access product_tax_rates via product company"
ON public.product_tax_rates FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_tax_rates.product_id
    AND user_has_company_access(auth.uid(), p.company_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_tax_rates.product_id
    AND user_has_company_access(auth.uid(), p.company_id)
));

CREATE INDEX idx_product_tax_rates_product ON public.product_tax_rates(product_id);
CREATE INDEX idx_product_tax_rates_tax ON public.product_tax_rates(tax_rate_id);