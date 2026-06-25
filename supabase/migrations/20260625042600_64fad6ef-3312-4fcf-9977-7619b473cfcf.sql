-- 1. Extend document_sequences with custom format (e.g. "{PREFIX}/{YYYY}/{MM}/{NUM}")
ALTER TABLE public.document_sequences
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT '{PREFIX}-{YYYY}{MM}-{NUM4}',
  ADD COLUMN IF NOT EXISTS pad_length INTEGER NOT NULL DEFAULT 4;

-- 2. Add source linkage to journal_entries if not present
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_je_source ON public.journal_entries (source_type, source_id);

-- 3. Upgraded numbering function honoring format/pad_length
CREATE OR REPLACE FUNCTION public.generate_document_number(p_company_id uuid, p_document_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT; v_num INTEGER; v_reset TEXT; v_last DATE;
  v_format TEXT; v_pad INTEGER; v_now DATE := CURRENT_DATE; v_result TEXT;
BEGIN
  INSERT INTO document_sequences (company_id, document_type, prefix, current_number, reset_period, last_reset_date)
  VALUES (p_company_id, p_document_type, p_document_type, 0, 'monthly', v_now)
  ON CONFLICT (company_id, document_type) DO NOTHING;

  SELECT prefix, current_number, reset_period, last_reset_date, format, pad_length
    INTO v_prefix, v_num, v_reset, v_last, v_format, v_pad
  FROM document_sequences
  WHERE company_id = p_company_id AND document_type = p_document_type
  FOR UPDATE;

  IF v_reset = 'monthly' AND (EXTRACT(MONTH FROM v_now) != EXTRACT(MONTH FROM v_last) OR EXTRACT(YEAR FROM v_now) != EXTRACT(YEAR FROM v_last)) THEN
    v_num := 0;
  ELSIF v_reset = 'yearly' AND EXTRACT(YEAR FROM v_now) != EXTRACT(YEAR FROM v_last) THEN
    v_num := 0;
  END IF;

  v_num := v_num + 1;

  UPDATE document_sequences SET current_number = v_num, last_reset_date = v_now, updated_at = now()
    WHERE company_id = p_company_id AND document_type = p_document_type;

  v_result := COALESCE(v_format, '{PREFIX}-{YYYY}{MM}-{NUM4}');
  v_result := REPLACE(v_result, '{PREFIX}', v_prefix);
  v_result := REPLACE(v_result, '{YYYY}', TO_CHAR(v_now, 'YYYY'));
  v_result := REPLACE(v_result, '{YY}',   TO_CHAR(v_now, 'YY'));
  v_result := REPLACE(v_result, '{MM}',   TO_CHAR(v_now, 'MM'));
  v_result := REPLACE(v_result, '{DD}',   TO_CHAR(v_now, 'DD'));
  v_result := REPLACE(v_result, '{NUM4}', LPAD(v_num::TEXT, 4, '0'));
  v_result := REPLACE(v_result, '{NUM5}', LPAD(v_num::TEXT, 5, '0'));
  v_result := REPLACE(v_result, '{NUM6}', LPAD(v_num::TEXT, 6, '0'));
  v_result := REPLACE(v_result, '{NUM}',  LPAD(v_num::TEXT, COALESCE(v_pad,4), '0'));

  RETURN v_result;
END $$;

-- 4. Helper: find a fallback account by type / name pattern
CREATE OR REPLACE FUNCTION public.find_account(p_company_id uuid, p_type text, p_name_like text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.chart_of_accounts
   WHERE company_id = p_company_id
     AND is_active = TRUE
     AND account_type::text = p_type
     AND (p_name_like IS NULL OR name ILIKE '%'||p_name_like||'%')
   ORDER BY (p_name_like IS NOT NULL AND name ILIKE '%'||p_name_like||'%') DESC, code
   LIMIT 1
$$;

-- 5. Auto-post Invoice → Journal Entry
CREATE OR REPLACE FUNCTION public.auto_post_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_je UUID; v_num TEXT;
  v_ar UUID; v_tax UUID;
  rec RECORD;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type='invoice' AND source_id=NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT receivable_account_id INTO v_ar FROM public.customers WHERE id = NEW.customer_id;
  v_ar := COALESCE(v_ar, public.find_account(NEW.company_id, 'asset', 'piutang'), public.find_account(NEW.company_id,'asset','receivable'));
  v_tax := public.find_account(NEW.company_id, 'liability', 'pajak');

  IF v_ar IS NULL THEN RETURN NEW; END IF;

  v_num := public.generate_document_number(NEW.company_id, 'JE');
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, created_by, source_type, source_id)
  VALUES (NEW.company_id, v_num, NEW.invoice_date, 'Auto: Invoice '||NEW.invoice_number, 'posted', NEW.created_by, 'invoice', NEW.id)
  RETURNING id INTO v_je;

  -- Dr Piutang (total)
  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je, v_ar, NEW.total_amount, 0, 'Piutang dari customer');

  -- Cr Pendapatan per akun (group by product.revenue_account_id)
  FOR rec IN
    SELECT COALESCE(p.revenue_account_id, public.find_account(NEW.company_id,'revenue','penjualan')) AS acct,
           SUM(ii.total) AS amt
    FROM public.invoice_items ii
    LEFT JOIN public.products p ON p.id = ii.product_id
    WHERE ii.invoice_id = NEW.id
    GROUP BY 1
  LOOP
    IF rec.acct IS NOT NULL AND rec.amt > 0 THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
      VALUES (v_je, rec.acct, 0, rec.amt, 'Pendapatan');
    END IF;
  END LOOP;

  IF NEW.tax_amount > 0 AND v_tax IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_tax, 0, NEW.tax_amount, 'PPN Keluaran');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_post_invoice ON public.invoices;
CREATE TRIGGER trg_auto_post_invoice
  AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_invoice();

-- 6. Auto-post Bill → JE
CREATE OR REPLACE FUNCTION public.auto_post_bill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_je UUID; v_num TEXT;
  v_ap UUID; v_tax UUID;
  rec RECORD;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type='bill' AND source_id=NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT payable_account_id INTO v_ap FROM public.suppliers WHERE id = NEW.supplier_id;
  v_ap := COALESCE(v_ap, public.find_account(NEW.company_id, 'liability', 'hutang'), public.find_account(NEW.company_id,'liability','payable'));
  v_tax := public.find_account(NEW.company_id, 'asset', 'pajak');

  IF v_ap IS NULL THEN RETURN NEW; END IF;

  v_num := public.generate_document_number(NEW.company_id, 'JE');
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, created_by, source_type, source_id)
  VALUES (NEW.company_id, v_num, NEW.bill_date, 'Auto: Bill '||NEW.bill_number, 'posted', NEW.created_by, 'bill', NEW.id)
  RETURNING id INTO v_je;

  FOR rec IN
    SELECT COALESCE(p.cogs_account_id, public.find_account(NEW.company_id,'expense','pembelian'), public.find_account(NEW.company_id,'asset','persediaan')) AS acct,
           SUM(bi.total) AS amt
    FROM public.bill_items bi
    LEFT JOIN public.products p ON p.id = bi.product_id
    WHERE bi.bill_id = NEW.id
    GROUP BY 1
  LOOP
    IF rec.acct IS NOT NULL AND rec.amt > 0 THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
      VALUES (v_je, rec.acct, rec.amt, 0, 'Pembelian/Persediaan');
    END IF;
  END LOOP;

  IF NEW.tax_amount > 0 AND v_tax IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_tax, NEW.tax_amount, 0, 'PPN Masukan');
  END IF;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je, v_ap, 0, NEW.total_amount, 'Hutang ke supplier');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_post_bill ON public.bills;
CREATE TRIGGER trg_auto_post_bill
  AFTER INSERT ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_bill();

-- 7. Auto-post Payment → JE
CREATE OR REPLACE FUNCTION public.auto_post_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_je UUID; v_num TEXT;
  v_cash UUID; v_contra UUID;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type='payment' AND source_id=NEW.id) THEN
    RETURN NEW;
  END IF;

  v_cash := NEW.cash_account_id;
  IF v_cash IS NULL THEN
    v_cash := public.find_account(NEW.company_id, 'cash_bank', NULL);
  END IF;
  IF v_cash IS NULL THEN RETURN NEW; END IF;

  IF NEW.payment_type = 'incoming' THEN
    SELECT receivable_account_id INTO v_contra FROM public.customers WHERE id = NEW.customer_id;
    v_contra := COALESCE(v_contra, public.find_account(NEW.company_id, 'asset', 'piutang'));
  ELSE
    SELECT payable_account_id INTO v_contra FROM public.suppliers WHERE id = NEW.supplier_id;
    v_contra := COALESCE(v_contra, public.find_account(NEW.company_id, 'liability', 'hutang'));
  END IF;
  IF v_contra IS NULL THEN RETURN NEW; END IF;

  v_num := public.generate_document_number(NEW.company_id, 'JE');
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, created_by, source_type, source_id)
  VALUES (NEW.company_id, v_num, NEW.payment_date, 'Auto: Payment '||NEW.payment_number, 'posted', NEW.created_by, 'payment', NEW.id)
  RETURNING id INTO v_je;

  IF NEW.payment_type = 'incoming' THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_cash, NEW.amount, 0, 'Penerimaan kas');
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_contra, 0, NEW.amount, 'Pelunasan piutang');
  ELSE
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_contra, NEW.amount, 0, 'Pelunasan hutang');
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_cash, 0, NEW.amount, 'Pengeluaran kas');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_post_payment ON public.payments;
CREATE TRIGGER trg_auto_post_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_payment();

-- 8. Void cascade: when a doc is voided, also void its JE
CREATE OR REPLACE FUNCTION public.cascade_void_je()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_src TEXT := TG_ARGV[0];
BEGIN
  IF NEW.voided_at IS NOT NULL AND (OLD.voided_at IS NULL) THEN
    UPDATE public.journal_entries
       SET voided_at = NEW.voided_at, voided_by = NEW.voided_by, void_reason = NEW.void_reason
     WHERE source_type = v_src AND source_id = NEW.id AND voided_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cascade_void_invoice ON public.invoices;
CREATE TRIGGER trg_cascade_void_invoice AFTER UPDATE OF voided_at ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.cascade_void_je('invoice');

DROP TRIGGER IF EXISTS trg_cascade_void_bill ON public.bills;
CREATE TRIGGER trg_cascade_void_bill AFTER UPDATE OF voided_at ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.cascade_void_je('bill');

DROP TRIGGER IF EXISTS trg_cascade_void_payment ON public.payments;
CREATE TRIGGER trg_cascade_void_payment AFTER UPDATE OF voided_at ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.cascade_void_je('payment');