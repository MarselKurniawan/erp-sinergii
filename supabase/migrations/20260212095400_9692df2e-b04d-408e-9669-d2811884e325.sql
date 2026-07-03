
-- =============================================
-- 1. AUDIT TRAIL / ACTIVITY LOG
-- =============================================
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  entity_type TEXT NOT NULL, -- 'sales_order', 'invoice', 'payment', etc.
  entity_id UUID,
  entity_number TEXT, -- e.g. SO-202502-0001
  description TEXT,
  changes JSONB, -- store old/new values for updates
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_company ON public.activity_logs(company_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity logs for their companies"
ON public.activity_logs FOR SELECT
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can create activity logs for their companies"
ON public.activity_logs FOR INSERT
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- =============================================
-- 2. AUTO-NUMBERING / DOCUMENT SEQUENCES
-- =============================================
CREATE TABLE public.document_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  document_type TEXT NOT NULL, -- 'SO', 'PO', 'INV', 'BILL', 'PAY', 'JE', 'GR', 'DP'
  prefix TEXT NOT NULL, -- e.g. 'SO', 'PO', 'INV'
  current_number INTEGER NOT NULL DEFAULT 0,
  reset_period TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly', 'never'
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, document_type)
);

ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage sequences for their companies"
ON public.document_sequences FOR ALL
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can view sequences for their companies"
ON public.document_sequences FOR SELECT
USING (user_has_company_access(auth.uid(), company_id));

-- Function to generate next document number
CREATE OR REPLACE FUNCTION public.generate_document_number(
  p_company_id UUID,
  p_document_type TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_current_number INTEGER;
  v_reset_period TEXT;
  v_last_reset DATE;
  v_year TEXT;
  v_month TEXT;
  v_result TEXT;
  v_now DATE := CURRENT_DATE;
BEGIN
  -- Get or create sequence
  INSERT INTO document_sequences (company_id, document_type, prefix, current_number, reset_period, last_reset_date)
  VALUES (p_company_id, p_document_type, p_document_type, 0, 'monthly', v_now)
  ON CONFLICT (company_id, document_type) DO NOTHING;

  -- Lock and get current value
  SELECT prefix, current_number, reset_period, last_reset_date
  INTO v_prefix, v_current_number, v_reset_period, v_last_reset
  FROM document_sequences
  WHERE company_id = p_company_id AND document_type = p_document_type
  FOR UPDATE;

  -- Check if reset is needed
  IF v_reset_period = 'monthly' AND (EXTRACT(MONTH FROM v_now) != EXTRACT(MONTH FROM v_last_reset) OR EXTRACT(YEAR FROM v_now) != EXTRACT(YEAR FROM v_last_reset)) THEN
    v_current_number := 0;
  ELSIF v_reset_period = 'yearly' AND EXTRACT(YEAR FROM v_now) != EXTRACT(YEAR FROM v_last_reset) THEN
    v_current_number := 0;
  END IF;

  -- Increment
  v_current_number := v_current_number + 1;

  -- Update sequence
  UPDATE document_sequences 
  SET current_number = v_current_number, last_reset_date = v_now, updated_at = now()
  WHERE company_id = p_company_id AND document_type = p_document_type;

  -- Format: PREFIX-YYYYMM-XXXX
  v_year := TO_CHAR(v_now, 'YYYY');
  v_month := TO_CHAR(v_now, 'MM');
  v_result := v_prefix || '-' || v_year || v_month || '-' || LPAD(v_current_number::TEXT, 4, '0');

  RETURN v_result;
END;
$$;
