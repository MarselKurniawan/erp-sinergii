
-- 1. Master tarif PPh per perusahaan
CREATE TABLE IF NOT EXISTS public.withholding_tax_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  liability_account_id UUID REFERENCES public.chart_of_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.withholding_tax_types TO authenticated;
GRANT ALL ON public.withholding_tax_types TO service_role;

ALTER TABLE public.withholding_tax_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wht_types_select" ON public.withholding_tax_types
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "wht_types_mutate" ON public.withholding_tax_types
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_wht_types_updated
  BEFORE UPDATE ON public.withholding_tax_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Kolom PPh di bills & payments
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS withholding_type_id UUID REFERENCES public.withholding_tax_types(id),
  ADD COLUMN IF NOT EXISTS withholding_rate NUMERIC(6,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholding_amount NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_payable NUMERIC(18,2);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS withholding_type_id UUID REFERENCES public.withholding_tax_types(id),
  ADD COLUMN IF NOT EXISTS withholding_amount NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholding_account_id UUID REFERENCES public.chart_of_accounts(id);

-- 3. Seed akun Hutang PPh + master tarif untuk perusahaan existing
DO $$
DECLARE
  c RECORD;
  v_pph23_acc UUID;
  v_pph22_acc UUID;
  v_pph4_acc UUID;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    -- akun COA
    SELECT id INTO v_pph23_acc FROM public.chart_of_accounts
      WHERE company_id = c.id AND code = '2150' LIMIT 1;
    IF v_pph23_acc IS NULL THEN
      INSERT INTO public.chart_of_accounts(company_id, code, name, account_type, is_active)
      VALUES (c.id, '2150', 'Hutang PPh 23', 'liability', TRUE)
      RETURNING id INTO v_pph23_acc;
    END IF;

    SELECT id INTO v_pph22_acc FROM public.chart_of_accounts
      WHERE company_id = c.id AND code = '2151' LIMIT 1;
    IF v_pph22_acc IS NULL THEN
      INSERT INTO public.chart_of_accounts(company_id, code, name, account_type, is_active)
      VALUES (c.id, '2151', 'Hutang PPh 22', 'liability', TRUE)
      RETURNING id INTO v_pph22_acc;
    END IF;

    SELECT id INTO v_pph4_acc FROM public.chart_of_accounts
      WHERE company_id = c.id AND code = '2152' LIMIT 1;
    IF v_pph4_acc IS NULL THEN
      INSERT INTO public.chart_of_accounts(company_id, code, name, account_type, is_active)
      VALUES (c.id, '2152', 'Hutang PPh Final', 'liability', TRUE)
      RETURNING id INTO v_pph4_acc;
    END IF;

    -- master tarif
    INSERT INTO public.withholding_tax_types(company_id, code, name, rate, liability_account_id, notes)
    VALUES
      (c.id, 'PPH23_JASA', 'PPh 23 - Jasa', 0.02, v_pph23_acc, 'Potongan 2% jasa manajemen/konsultan/dll'),
      (c.id, 'PPH23_SEWA', 'PPh 23 - Sewa', 0.02, v_pph23_acc, 'Sewa selain tanah/bangunan'),
      (c.id, 'PPH22_IMPOR', 'PPh 22 - Impor (API)', 0.025, v_pph22_acc, 'Impor dengan API 2.5%'),
      (c.id, 'PPH4_FINAL', 'PPh 4(2) - Final Sewa T/B', 0.10, v_pph4_acc, 'Sewa tanah/bangunan final 10%')
    ON CONFLICT (company_id, code) DO NOTHING;
  END LOOP;
END $$;

-- 4. Auto-post payment: kurangi kas dgn PPh & catat ke Hutang PPh
CREATE OR REPLACE FUNCTION public.auto_post_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_je UUID; v_num TEXT;
  v_cash UUID; v_contra UUID;
  v_base_currency TEXT;
  v_pay_rate NUMERIC := COALESCE(NEW.exchange_rate, 1);
  v_pay_ccy TEXT := COALESCE(NEW.currency_code, 'IDR');
  v_cash_base NUMERIC;
  v_contra_base NUMERIC := 0;
  v_fx_diff NUMERIC := 0;
  v_fx_gain UUID; v_fx_loss UUID;
  r RECORD;
  v_wht NUMERIC := COALESCE(NEW.withholding_amount, 0);
  v_wht_acc UUID := NEW.withholding_account_id;
  v_wht_base NUMERIC := 0;
  v_cash_net NUMERIC;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.approval_status, 'pending') <> 'approved' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type='payment' AND source_id=NEW.id) THEN
    RETURN NEW;
  END IF;

  v_cash := NEW.cash_account_id;
  IF v_cash IS NULL THEN
    v_cash := public.find_account(NEW.company_id, 'cash_bank', NULL);
  END IF;
  IF v_cash IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(base_currency,'IDR') INTO v_base_currency FROM public.companies WHERE id = NEW.company_id;

  IF NEW.payment_type = 'incoming' THEN
    SELECT receivable_account_id INTO v_contra FROM public.customers WHERE id = NEW.customer_id;
    v_contra := COALESCE(v_contra, public.find_account(NEW.company_id, 'asset', 'piutang'));
  ELSE
    SELECT payable_account_id INTO v_contra FROM public.suppliers WHERE id = NEW.supplier_id;
    v_contra := COALESCE(v_contra, public.find_account(NEW.company_id, 'liability', 'hutang'));
  END IF;
  IF v_contra IS NULL THEN RETURN NEW; END IF;

  v_cash_base := ROUND(NEW.amount * v_pay_rate, 2);

  -- Contra base at document rate (FX)
  IF NEW.payment_type = 'incoming' THEN
    FOR r IN
      SELECT pa.amount, COALESCE(i.exchange_rate, 1) AS doc_rate
      FROM public.payment_allocations pa
      JOIN public.invoices i ON i.id = pa.invoice_id
      WHERE pa.payment_id = NEW.id
    LOOP
      v_contra_base := v_contra_base + ROUND(r.amount * r.doc_rate, 2);
    END LOOP;
  ELSE
    FOR r IN
      SELECT pa.amount, COALESCE(b.exchange_rate, 1) AS doc_rate
      FROM public.payment_allocations pa
      JOIN public.bills b ON b.id = pa.bill_id
      WHERE pa.payment_id = NEW.id
    LOOP
      v_contra_base := v_contra_base + ROUND(r.amount * r.doc_rate, 2);
    END LOOP;
  END IF;

  IF v_contra_base = 0 THEN v_contra_base := v_cash_base; END IF;

  v_fx_diff := v_cash_base - v_contra_base;

  v_fx_gain := public.find_account(NEW.company_id, 'revenue', 'Selisih Kurs');
  v_fx_loss := public.find_account(NEW.company_id, 'expense', 'Selisih Kurs');

  v_wht_base := ROUND(v_wht * v_pay_rate, 2);
  -- Only outgoing supports WHT for now
  IF NEW.payment_type <> 'outgoing' THEN v_wht_base := 0; END IF;

  v_cash_net := v_cash_base - v_wht_base;

  v_num := public.generate_document_number(NEW.company_id, 'JE');
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, created_by, source_type, source_id)
  VALUES (NEW.company_id, v_num, NEW.payment_date,
          'Auto: Payment '||NEW.payment_number||CASE WHEN v_pay_ccy<>v_base_currency THEN ' ('||v_pay_ccy||' @ '||v_pay_rate||')' ELSE '' END,
          'posted', NEW.created_by, 'payment', NEW.id)
  RETURNING id INTO v_je;

  IF NEW.payment_type = 'incoming' THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_cash, v_cash_base, 0, 'Penerimaan kas');
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_contra, 0, v_contra_base, 'Pelunasan piutang');
    IF ABS(v_fx_diff) >= 0.01 THEN
      IF v_fx_diff > 0 AND v_fx_gain IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
        VALUES (v_je, v_fx_gain, 0, v_fx_diff, 'Laba selisih kurs');
      ELSIF v_fx_diff < 0 AND v_fx_loss IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
        VALUES (v_je, v_fx_loss, -v_fx_diff, 0, 'Rugi selisih kurs');
      END IF;
    END IF;
  ELSE
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_contra, v_contra_base, 0, 'Pelunasan hutang');
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_cash, 0, v_cash_net, 'Pengeluaran kas (bersih)');
    IF v_wht_base > 0 AND v_wht_acc IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
      VALUES (v_je, v_wht_acc, 0, v_wht_base, 'Potongan PPh (Hutang PPh)');
    END IF;
    IF ABS(v_fx_diff) >= 0.01 THEN
      IF v_fx_diff > 0 AND v_fx_loss IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
        VALUES (v_je, v_fx_loss, v_fx_diff, 0, 'Rugi selisih kurs');
      ELSIF v_fx_diff < 0 AND v_fx_gain IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
        VALUES (v_je, v_fx_gain, 0, -v_fx_diff, 'Laba selisih kurs');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $function$;
