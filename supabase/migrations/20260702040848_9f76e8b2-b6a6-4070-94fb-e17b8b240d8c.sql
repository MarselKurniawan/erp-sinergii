
-- 1. Add 'pending' to invoice_status enum
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'pending';

-- 2. Add status column to journal_entries (mirror of is_posted for code compat)
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'posted';
UPDATE public.journal_entries SET status = CASE WHEN is_posted THEN 'posted' ELSE 'draft' END WHERE status IS NULL;

-- 3. Restore EXECUTE on functions called from user-initiated triggers/RPC
GRANT EXECUTE ON FUNCTION public.check_period_closed(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_account(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_po() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_so() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_inv() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_bill() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_pay() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_je() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_gr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_period_pos() TO authenticated;

NOTIFY pgrst, 'reload schema';
