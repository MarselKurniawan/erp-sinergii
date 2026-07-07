
CREATE TABLE IF NOT EXISTS public.currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimal_places SMALLINT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currencies TO authenticated, anon;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "currencies_read_all" ON public.currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "currencies_admin_write" ON public.currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

INSERT INTO public.currencies (code, name, symbol, decimal_places) VALUES
  ('IDR','Indonesian Rupiah','Rp',0),
  ('USD','US Dollar','$',2),
  ('EUR','Euro','€',2),
  ('SGD','Singapore Dollar','S$',2),
  ('MYR','Malaysian Ringgit','RM',2),
  ('JPY','Japanese Yen','¥',0),
  ('CNY','Chinese Yuan','¥',2),
  ('GBP','British Pound','£',2),
  ('AUD','Australian Dollar','A$',2),
  ('THB','Thai Baht','฿',2)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  rate_date DATE NOT NULL,
  rate_to_base NUMERIC(18,6) NOT NULL CHECK (rate_to_base > 0),
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, currency_code, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup ON public.exchange_rates (company_id, currency_code, rate_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchange_rates_read" ON public.exchange_rates FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "exchange_rates_write" ON public.exchange_rates FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'IDR' REFERENCES public.currencies(code);

DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY['invoices','bills','sales_orders','purchase_orders','payments','expenses','journal_entries','down_payments'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT ''IDR'' REFERENCES public.currencies(code)', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0)', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_latest_rate(
  p_company_id UUID, p_currency TEXT, p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rate_to_base FROM public.exchange_rates
      WHERE company_id = p_company_id AND currency_code = p_currency AND rate_date <= p_date
      ORDER BY rate_date DESC LIMIT 1),
    CASE WHEN p_currency = COALESCE((SELECT base_currency FROM public.companies WHERE id = p_company_id), 'IDR')
      THEN 1 ELSE NULL END
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_latest_rate(UUID, TEXT, DATE) TO authenticated;

INSERT INTO public.chart_of_accounts (company_id, code, name, account_type, is_active)
SELECT c.id, '7910', 'Selisih Kurs (Untung)', 'revenue', true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts a WHERE a.company_id = c.id AND a.code = '7910'
);

INSERT INTO public.chart_of_accounts (company_id, code, name, account_type, is_active)
SELECT c.id, '8910', 'Selisih Kurs (Rugi)', 'expense', true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts a WHERE a.company_id = c.id AND a.code = '8910'
);
