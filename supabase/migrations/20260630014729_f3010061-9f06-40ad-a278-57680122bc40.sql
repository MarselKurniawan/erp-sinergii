-- Batch 14 fix: post journals and allocations only after approval

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
  IF COALESCE(NEW.approval_status, 'pending') <> 'approved' THEN RETURN NEW; END IF;
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
  AFTER INSERT OR UPDATE OF approval_status ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_bill();

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
  IF COALESCE(NEW.approval_status, 'pending') <> 'approved' THEN RETURN NEW; END IF;
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
  AFTER INSERT OR UPDATE OF approval_status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_payment();

CREATE OR REPLACE FUNCTION public.apply_payment_allocations_after_approval(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  r record;
  v_paid numeric;
  v_total numeric;
BEGIN
  FOR r IN
    SELECT pa.bill_id, SUM(pa.amount) AS amount
    FROM public.payment_allocations pa
    WHERE pa.payment_id = _payment_id
    GROUP BY pa.bill_id
  LOOP
    SELECT COALESCE(paid_amount, 0), COALESCE(total_amount, 0)
    INTO v_paid, v_total
    FROM public.bills
    WHERE id = r.bill_id
    FOR UPDATE;

    v_paid := COALESCE(v_paid, 0) + COALESCE(r.amount, 0);

    UPDATE public.bills
    SET paid_amount = v_paid,
        outstanding_amount = GREATEST(v_total - v_paid, 0),
        status = CASE WHEN GREATEST(v_total - v_paid, 0) <= 0 THEN 'paid'::public.invoice_status ELSE 'partial'::public.invoice_status END,
        updated_at = now()
    WHERE id = r.bill_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_request(_request_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_req public.approval_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.approval_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request tidak ditemukan.';
  END IF;
  IF NOT (public.user_has_company_access(auth.uid(), v_req.company_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))) THEN
    RAISE EXCEPTION 'Anda tidak punya akses untuk approval ini.';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Approval request sudah diproses.';
  END IF;

  UPDATE public.approval_requests
  SET status = 'approved', approved_by = auth.uid(), approved_at = now(), notes = COALESCE(_notes, notes), updated_at = now()
  WHERE id = _request_id;

  IF v_req.entity_type = 'purchase_order' THEN
    UPDATE public.purchase_orders SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now() WHERE id = v_req.entity_id;
  ELSIF v_req.entity_type = 'bill' THEN
    UPDATE public.bills SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now(), status = CASE WHEN status = 'draft'::public.invoice_status THEN 'sent'::public.invoice_status ELSE status END, updated_at = now() WHERE id = v_req.entity_id;
  ELSIF v_req.entity_type = 'payment' THEN
    UPDATE public.payments SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now() WHERE id = v_req.entity_id;
    PERFORM public.apply_payment_allocations_after_approval(v_req.entity_id);
  END IF;

  INSERT INTO public.notifications(user_id, company_id, type, title, message, link)
  VALUES (COALESCE(v_req.requested_by, auth.uid()), v_req.company_id, 'approval_approved', 'Dokumen disetujui: ' || v_req.document_number, 'Dokumen sudah disetujui dan bisa dilanjutkan.', public.approval_document_link(v_req.entity_type));
END;
$$;

REVOKE ALL ON FUNCTION public.approve_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_payment_allocations_after_approval(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_request(uuid, text) TO authenticated;