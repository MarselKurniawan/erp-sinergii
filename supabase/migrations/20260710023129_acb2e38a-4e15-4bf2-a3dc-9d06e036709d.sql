
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
  v_doc_rate NUMERIC;
  v_alloc_base NUMERIC;
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

  -- Cash side in base currency
  v_cash_base := ROUND(NEW.amount * v_pay_rate, 2);

  -- Contra side: sum allocations converted at DOCUMENT rate (original booked value)
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

  -- Fallback if no allocations: use payment rate on contra as well (no FX)
  IF v_contra_base = 0 THEN
    v_contra_base := v_cash_base;
  END IF;

  v_fx_diff := v_cash_base - v_contra_base;

  v_fx_gain := public.find_account(NEW.company_id, 'revenue', 'Selisih Kurs');
  v_fx_loss := public.find_account(NEW.company_id, 'expense', 'Selisih Kurs');

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
    -- Incoming: cash > contra ⇒ received more base ⇒ FX Gain (credit)
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
    VALUES (v_je, v_cash, 0, v_cash_base, 'Pengeluaran kas');
    -- Outgoing: cash > contra ⇒ paid more base ⇒ FX Loss (debit)
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
