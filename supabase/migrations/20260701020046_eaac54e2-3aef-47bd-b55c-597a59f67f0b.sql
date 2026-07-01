
-- 1. Fix swapped user_has_company_access arguments in policies
-- journal_entry_tags
DROP POLICY IF EXISTS "Users can create journal entry tags" ON public.journal_entry_tags;
DROP POLICY IF EXISTS "Users can delete journal entry tags" ON public.journal_entry_tags;
DROP POLICY IF EXISTS "Users can view journal entry tags" ON public.journal_entry_tags;
CREATE POLICY "Users can create journal entry tags" ON public.journal_entry_tags
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_tags.journal_entry_id AND public.user_has_company_access(auth.uid(), je.company_id)));
CREATE POLICY "Users can delete journal entry tags" ON public.journal_entry_tags
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_tags.journal_entry_id AND public.user_has_company_access(auth.uid(), je.company_id)));
CREATE POLICY "Users can view journal entry tags" ON public.journal_entry_tags
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_tags.journal_entry_id AND public.user_has_company_access(auth.uid(), je.company_id)));

-- goods_receipts
DROP POLICY IF EXISTS "Users can create goods receipts for their companies" ON public.goods_receipts;
DROP POLICY IF EXISTS "Users can delete goods receipts of their companies" ON public.goods_receipts;
DROP POLICY IF EXISTS "Users can update goods receipts of their companies" ON public.goods_receipts;
DROP POLICY IF EXISTS "Users can view goods receipts of their companies" ON public.goods_receipts;
CREATE POLICY "Users can create goods receipts for their companies" ON public.goods_receipts
  FOR INSERT WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete goods receipts of their companies" ON public.goods_receipts
  FOR DELETE USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update goods receipts of their companies" ON public.goods_receipts
  FOR UPDATE USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can view goods receipts of their companies" ON public.goods_receipts
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));

-- goods_receipt_items
DROP POLICY IF EXISTS "Users can create goods receipt items via receipt" ON public.goods_receipt_items;
DROP POLICY IF EXISTS "Users can delete goods receipt items via receipt" ON public.goods_receipt_items;
DROP POLICY IF EXISTS "Users can update goods receipt items via receipt" ON public.goods_receipt_items;
DROP POLICY IF EXISTS "Users can view goods receipt items via receipt" ON public.goods_receipt_items;
CREATE POLICY "Users can create goods receipt items via receipt" ON public.goods_receipt_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_items.receipt_id AND public.user_has_company_access(auth.uid(), gr.company_id)));
CREATE POLICY "Users can delete goods receipt items via receipt" ON public.goods_receipt_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_items.receipt_id AND public.user_has_company_access(auth.uid(), gr.company_id)));
CREATE POLICY "Users can update goods receipt items via receipt" ON public.goods_receipt_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_items.receipt_id AND public.user_has_company_access(auth.uid(), gr.company_id)));
CREATE POLICY "Users can view goods receipt items via receipt" ON public.goods_receipt_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_items.receipt_id AND public.user_has_company_access(auth.uid(), gr.company_id)));

-- period_closings
DROP POLICY IF EXISTS "Users can create period closings for their companies" ON public.period_closings;
DROP POLICY IF EXISTS "Users can update period closings for their companies" ON public.period_closings;
DROP POLICY IF EXISTS "Users can view period closings for their companies" ON public.period_closings;
CREATE POLICY "Users can create period closings for their companies" ON public.period_closings
  FOR INSERT WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update period closings for their companies" ON public.period_closings
  FOR UPDATE USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can view period closings for their companies" ON public.period_closings
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));

-- opening_balances
DROP POLICY IF EXISTS "Users can create opening balances for their companies" ON public.opening_balances;
DROP POLICY IF EXISTS "Users can update opening balances for their companies" ON public.opening_balances;
DROP POLICY IF EXISTS "Users can view opening balances for their companies" ON public.opening_balances;
CREATE POLICY "Users can create opening balances for their companies" ON public.opening_balances
  FOR INSERT WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update opening balances for their companies" ON public.opening_balances
  FOR UPDATE USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can view opening balances for their companies" ON public.opening_balances
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));

-- transaction_tags
DROP POLICY IF EXISTS "Users can create tags for their companies" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can delete custom tags for their companies" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can update tags for their companies" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can view tags for their companies" ON public.transaction_tags;
CREATE POLICY "Users can create tags for their companies" ON public.transaction_tags
  FOR INSERT WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete custom tags for their companies" ON public.transaction_tags
  FOR DELETE USING (public.user_has_company_access(auth.uid(), company_id) AND is_system = false);
CREATE POLICY "Users can update tags for their companies" ON public.transaction_tags
  FOR UPDATE USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can view tags for their companies" ON public.transaction_tags
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));

-- 2. Set search_path on functions that are missing it
ALTER FUNCTION public._advance_next_run(date, text, integer) SET search_path = public;
ALTER FUNCTION public.approval_document_link(text) SET search_path = public;
ALTER FUNCTION public.guard_approval_required() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_bill() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_gr() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_inv() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_je() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_pay() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_po() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_pos() SET search_path = public;
ALTER FUNCTION public.trg_guard_period_so() SET search_path = public;

-- 3. Revoke EXECUTE from anon/authenticated on internal/trigger SECURITY DEFINER functions.
-- Trigger functions and internal helpers should NOT be callable via the API.
REVOKE EXECUTE ON FUNCTION public.audit_trigger_func() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_bill() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_invoice() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cascade_void_je() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_approval_request_for_document() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_approval_required() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_approval_approvers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_gri_inventory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_so_inventory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_st_inventory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_bill() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_gr() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_inv() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_je() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_pay() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_po() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_pos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_period_so() FROM PUBLIC, anon, authenticated;
-- Internal helpers
REVOKE EXECUTE ON FUNCTION public._advance_next_run(date, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._record_inventory_movement(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, date, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_payment_allocations_after_approval(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approval_document_link(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_period_closed(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_cogs(uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_account(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_notifications() FROM PUBLIC, anon, authenticated;

-- 4. Add UPDATE policy for transaction-attachments storage bucket
DROP POLICY IF EXISTS "Users can update transaction attachments in their companies" ON storage.objects;
CREATE POLICY "Users can update transaction attachments in their companies"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'transaction-attachments'
    AND public.user_has_company_access(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'transaction-attachments'
    AND public.user_has_company_access(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );
