-- Batch 14: Approval workflow for PO, Bill, and Payment

-- Approval status columns on existing documents
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Backfill previous data as approved to avoid blocking existing historical documents
UPDATE public.purchase_orders SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at) WHERE approval_status = 'pending' AND created_at < now() - interval '2 minutes';
UPDATE public.bills SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at) WHERE approval_status = 'pending' AND created_at < now() - interval '2 minutes';
UPDATE public.payments SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at) WHERE approval_status = 'pending' AND created_at < now() - interval '2 minutes';

-- Approval request list
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('purchase_order', 'bill', 'payment')),
  entity_id uuid NOT NULL,
  document_number text NOT NULL,
  requested_by uuid,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_by uuid,
  rejected_at timestamp with time zone,
  rejection_reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view approval requests for their companies"
ON public.approval_requests
FOR SELECT
TO authenticated
USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can create approval requests for their companies"
ON public.approval_requests
FOR INSERT
TO authenticated
WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Admins can manage approval requests"
ON public.approval_requests
FOR UPDATE
TO authenticated
USING (public.user_has_company_access(auth.uid(), company_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')))
WITH CHECK (public.user_has_company_access(auth.uid(), company_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')));
CREATE POLICY "Admins can delete approval requests"
ON public.approval_requests
FOR DELETE
TO authenticated
USING (public.user_has_company_access(auth.uid(), company_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')));

-- Email notification queue for approval reminders/digests
CREATE TABLE IF NOT EXISTS public.approval_email_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  approval_request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  recipient_email text,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  sent_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_email_queue TO authenticated;
GRANT ALL ON public.approval_email_queue TO service_role;
ALTER TABLE public.approval_email_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their approval emails"
ON public.approval_email_queue
FOR SELECT
TO authenticated
USING (recipient_user_id = auth.uid() OR (public.user_has_company_access(auth.uid(), company_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))));
CREATE POLICY "Admins can manage approval email queue"
ON public.approval_email_queue
FOR ALL
TO authenticated
USING (public.user_has_company_access(auth.uid(), company_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')))
WITH CHECK (public.user_has_company_access(auth.uid(), company_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')));

CREATE INDEX IF NOT EXISTS idx_approval_requests_company_status ON public.approval_requests(company_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON public.approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_email_queue_recipient ON public.approval_email_queue(recipient_user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER update_approval_requests_updated_at
BEFORE UPDATE ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_approval_email_queue_updated_at ON public.approval_email_queue;
CREATE TRIGGER update_approval_email_queue_updated_at
BEFORE UPDATE ON public.approval_email_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.approval_document_link(_entity_type text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT CASE _entity_type
    WHEN 'purchase_order' THEN '/purchases/orders'
    WHEN 'bill' THEN '/purchases/bills'
    WHEN 'payment' THEN '/purchases/payments'
    ELSE '/approvals'
  END
$$;

CREATE OR REPLACE FUNCTION public.notify_approval_approvers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  r record;
  v_title text;
  v_message text;
  v_link text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  v_title := 'Approval dibutuhkan: ' || NEW.document_number;
  v_message := NEW.entity_type || ' senilai ' || NEW.amount::text || ' menunggu approval.';
  v_link := public.approval_document_link(NEW.entity_type);

  FOR r IN
    SELECT DISTINCT p.id AS user_id, p.email
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role IN ('admin','superadmin')
    LEFT JOIN public.user_companies uc ON uc.user_id = p.id AND uc.company_id = NEW.company_id
    WHERE uc.company_id IS NOT NULL OR ur.role IN ('admin','superadmin')
  LOOP
    INSERT INTO public.notifications(user_id, company_id, type, title, message, link)
    VALUES (r.user_id, NEW.company_id, 'approval_required', v_title, v_message, v_link);

    INSERT INTO public.approval_email_queue(company_id, approval_request_id, recipient_user_id, recipient_email, subject, body)
    VALUES (NEW.company_id, NEW.id, r.user_id, r.email, v_title, v_message || E'\nBuka: ' || v_link)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_approval_approvers ON public.approval_requests;
CREATE TRIGGER trg_notify_approval_approvers
AFTER INSERT ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_approval_approvers();

CREATE OR REPLACE FUNCTION public.create_approval_request_for_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_entity_type text;
  v_document_number text;
  v_amount numeric;
BEGIN
  IF TG_TABLE_NAME = 'purchase_orders' THEN
    v_entity_type := 'purchase_order';
    v_document_number := NEW.order_number;
    v_amount := COALESCE(NEW.total_amount, 0);
  ELSIF TG_TABLE_NAME = 'bills' THEN
    v_entity_type := 'bill';
    v_document_number := NEW.bill_number;
    v_amount := COALESCE(NEW.total_amount, 0);
  ELSIF TG_TABLE_NAME = 'payments' THEN
    v_entity_type := 'payment';
    v_document_number := NEW.payment_number;
    v_amount := COALESCE(NEW.amount, 0);
  ELSE
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.approval_status, 'pending') = 'pending' THEN
    INSERT INTO public.approval_requests(company_id, entity_type, entity_id, document_number, requested_by, amount, notes)
    VALUES (NEW.company_id, v_entity_type, NEW.id, v_document_number, NEW.created_by, v_amount, NEW.notes)
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      amount = EXCLUDED.amount,
      document_number = EXCLUDED.document_number,
      notes = EXCLUDED.notes,
      status = CASE WHEN public.approval_requests.status = 'cancelled' THEN 'pending' ELSE public.approval_requests.status END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_approval_po ON public.purchase_orders;
CREATE TRIGGER trg_create_approval_po
AFTER INSERT ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.create_approval_request_for_document();

DROP TRIGGER IF EXISTS trg_create_approval_bill ON public.bills;
CREATE TRIGGER trg_create_approval_bill
AFTER INSERT ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.create_approval_request_for_document();

DROP TRIGGER IF EXISTS trg_create_approval_payment ON public.payments;
CREATE TRIGGER trg_create_approval_payment
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.create_approval_request_for_document();

CREATE OR REPLACE FUNCTION public.guard_approval_required()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'purchase_orders' THEN
    IF NEW.status IN ('confirmed','received','invoiced','paid') AND COALESCE(NEW.approval_status, 'pending') <> 'approved' THEN
      RAISE EXCEPTION 'Purchase Order harus disetujui sebelum diproses.';
    END IF;
  ELSIF TG_TABLE_NAME = 'bills' THEN
    IF NEW.status IN ('sent','partial','paid') AND COALESCE(NEW.approval_status, 'pending') <> 'approved' THEN
      RAISE EXCEPTION 'Bill harus disetujui sebelum diproses.';
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF TG_OP = 'UPDATE' AND OLD.approval_status <> 'approved' AND COALESCE(NEW.approval_status, 'pending') = 'approved' THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' AND COALESCE(NEW.approval_status, 'pending') <> 'approved' THEN
      RETURN NEW;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_approval_po ON public.purchase_orders;
CREATE TRIGGER trg_guard_approval_po
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_approval_required();

DROP TRIGGER IF EXISTS trg_guard_approval_bill ON public.bills;
CREATE TRIGGER trg_guard_approval_bill
BEFORE UPDATE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.guard_approval_required();

DROP TRIGGER IF EXISTS trg_guard_approval_payment ON public.payments;
CREATE TRIGGER trg_guard_approval_payment
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_approval_required();

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
    UPDATE public.bills SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now() WHERE id = v_req.entity_id;
  ELSIF v_req.entity_type = 'payment' THEN
    UPDATE public.payments SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now() WHERE id = v_req.entity_id;
  END IF;

  INSERT INTO public.notifications(user_id, company_id, type, title, message, link)
  VALUES (COALESCE(v_req.requested_by, auth.uid()), v_req.company_id, 'approval_approved', 'Dokumen disetujui: ' || v_req.document_number, 'Dokumen sudah disetujui dan bisa dilanjutkan.', public.approval_document_link(v_req.entity_type));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_request(_request_id uuid, _reason text DEFAULT NULL)
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
  SET status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = _reason, updated_at = now()
  WHERE id = _request_id;

  IF v_req.entity_type = 'purchase_order' THEN
    UPDATE public.purchase_orders SET approval_status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = _reason, updated_at = now() WHERE id = v_req.entity_id;
  ELSIF v_req.entity_type = 'bill' THEN
    UPDATE public.bills SET approval_status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = _reason, updated_at = now() WHERE id = v_req.entity_id;
  ELSIF v_req.entity_type = 'payment' THEN
    UPDATE public.payments SET approval_status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = _reason WHERE id = v_req.entity_id;
  END IF;

  INSERT INTO public.notifications(user_id, company_id, type, title, message, link)
  VALUES (COALESCE(v_req.requested_by, auth.uid()), v_req.company_id, 'approval_rejected', 'Dokumen ditolak: ' || v_req.document_number, COALESCE(_reason, 'Dokumen ditolak oleh approver.'), public.approval_document_link(v_req.entity_type));
END;
$$;