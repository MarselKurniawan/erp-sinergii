
-- =========================================================
-- FASE 1: RBAC + UNIVERSAL AUDIT LOG
-- =========================================================

-- 1. Tambah role superadmin (pakai IF NOT EXISTS supaya idempotent)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';

-- 2. Tabel daftar fitur sistem
CREATE TABLE IF NOT EXISTS public.features (
  key TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.features TO authenticated;
GRANT ALL ON public.features TO service_role;

ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view features"
ON public.features FOR SELECT TO authenticated USING (true);

-- 3. Permission user × fitur × aksi
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL REFERENCES public.features(key) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- helper untuk cek superadmin via text supaya enum baru bisa dipakai di transaksi yg sama
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'superadmin') $$;

CREATE POLICY "Users can view own permissions"
ON public.user_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can manage permissions"
ON public.user_permissions FOR ALL TO authenticated
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER trg_user_permissions_updated
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Function permission check
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _feature_key TEXT, _action TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_has BOOLEAN;
BEGIN
  -- superadmin & admin lolos semua
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('superadmin','admin')) THEN
    RETURN TRUE;
  END IF;
  SELECT CASE _action
    WHEN 'view' THEN can_view
    WHEN 'create' THEN can_create
    WHEN 'edit' THEN can_edit
    WHEN 'delete' THEN can_delete
    ELSE FALSE
  END INTO v_has
  FROM public.user_permissions
  WHERE user_id = _user_id AND feature_key = _feature_key;
  RETURN COALESCE(v_has, FALSE);
END;
$$;

-- 5. Seed daftar fitur
INSERT INTO public.features (key, module, label, sort_order) VALUES
  ('dashboard', 'Dashboard', 'Dashboard Utama', 1),
  ('sales.dashboard', 'Sales', 'Sales Dashboard', 10),
  ('sales.orders', 'Sales', 'Sales Orders', 11),
  ('sales.invoices', 'Sales', 'Invoices', 12),
  ('sales.payments', 'Sales', 'Sales Payments', 13),
  ('sales.customers', 'Sales', 'Customers', 14),
  ('purchase.dashboard', 'Purchase', 'Purchase Dashboard', 20),
  ('purchase.orders', 'Purchase', 'Purchase Orders', 21),
  ('purchase.goods_receipts', 'Purchase', 'Goods Receipts', 22),
  ('purchase.bills', 'Purchase', 'Bills', 23),
  ('purchase.payments', 'Purchase', 'Purchase Payments', 24),
  ('purchase.suppliers', 'Purchase', 'Suppliers', 25),
  ('inventory.dashboard', 'Inventory', 'Inventory Dashboard', 30),
  ('inventory.products', 'Inventory', 'Products', 31),
  ('inventory.materials', 'Inventory', 'Materials', 32),
  ('inventory.warehouses', 'Inventory', 'Warehouses', 33),
  ('inventory.stock', 'Inventory', 'Stock', 34),
  ('inventory.transfers', 'Inventory', 'Stock Transfers', 35),
  ('inventory.opname', 'Inventory', 'Stock Opname', 36),
  ('inventory.recipes', 'Inventory', 'Recipes', 37),
  ('accounting.coa', 'Accounting', 'Chart of Accounts', 40),
  ('accounting.journal', 'Accounting', 'Journal Entries', 41),
  ('accounting.cashbank', 'Accounting', 'Cash & Bank', 42),
  ('accounting.cashflow', 'Accounting', 'Cashflow', 43),
  ('accounting.closing', 'Accounting', 'Period Closing', 44),
  ('accounting.tags', 'Accounting', 'Transaction Tags', 45),
  ('accounting.activity_log', 'Accounting', 'Audit Trail', 46),
  ('assets.fixed', 'Assets', 'Fixed Assets', 50),
  ('pos.dashboard', 'POS', 'POS Dashboard', 60),
  ('pos.transactions', 'POS', 'POS Transactions', 61),
  ('pos.open_tables', 'POS', 'Open Tables', 62),
  ('pos.deposits', 'POS', 'POS Deposits', 63),
  ('pos.cash_closing', 'POS', 'Tutup Kas', 64),
  ('pos.reports', 'POS', 'POS Reports', 65),
  ('pos.promotions', 'POS', 'Promotions', 66),
  ('pos.printer', 'POS', 'Printer Settings', 67),
  ('pos.receipt', 'POS', 'Receipt Settings', 68),
  ('pos.settings', 'POS', 'POS Settings', 69),
  ('reports.balance_sheet', 'Reports', 'Balance Sheet', 70),
  ('reports.profit_loss', 'Reports', 'Profit & Loss', 71),
  ('reports.trial_balance', 'Reports', 'Trial Balance', 72),
  ('reports.general_ledger', 'Reports', 'General Ledger', 73),
  ('reports.cashflow', 'Reports', 'Cashflow Report', 74),
  ('reports.sales', 'Reports', 'Sales Report', 75),
  ('reports.purchase', 'Reports', 'Purchase Report', 76),
  ('reports.inventory', 'Reports', 'Inventory Report', 77),
  ('reports.tax', 'Reports', 'Tax Report', 78),
  ('reports.aged_payables', 'Reports', 'Aged Payables', 79),
  ('reports.aged_receivables', 'Reports', 'Aged Receivables', 80),
  ('settings.companies', 'Settings', 'Companies', 90),
  ('settings.users', 'Settings', 'Users', 91),
  ('settings.permissions', 'Settings', 'Permissions', 92),
  ('settings.profile', 'Settings', 'Profile', 93),
  ('settings.data_reset', 'Settings', 'Data Reset', 94)
ON CONFLICT (key) DO NOTHING;

-- 6. Universal audit trigger
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID := auth.uid();
  v_entity_type TEXT := TG_TABLE_NAME;
  v_entity_id UUID;
  v_entity_number TEXT;
  v_action TEXT;
  v_changes JSONB;
  v_old JSONB;
  v_new JSONB;
  v_key TEXT;
  v_desc TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(NEW);
    v_company_id := (v_new->>'company_id')::UUID;
    v_entity_id := (v_new->>'id')::UUID;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    v_company_id := (v_new->>'company_id')::UUID;
    v_entity_id := (v_new->>'id')::UUID;
    -- diff
    v_changes := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key NOT IN ('updated_at','created_at') AND v_new->v_key IS DISTINCT FROM v_old->v_key THEN
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_company_id := (v_old->>'company_id')::UUID;
    v_entity_id := (v_old->>'id')::UUID;
    v_new := v_old;
  END IF;

  -- nomor entitas
  v_entity_number := COALESCE(
    v_new->>'transaction_number', v_new->>'invoice_number', v_new->>'bill_number',
    v_new->>'payment_number', v_new->>'receipt_number', v_new->>'entry_number',
    v_new->>'dp_number', v_new->>'deposit_number', v_new->>'asset_code',
    v_new->>'code', v_new->>'sku', v_new->>'name'
  );

  v_desc := CASE v_action
    WHEN 'create' THEN 'Membuat '||v_entity_type||COALESCE(' '||v_entity_number,'')
    WHEN 'update' THEN 'Mengubah '||v_entity_type||COALESCE(' '||v_entity_number,'')
    WHEN 'delete' THEN 'Menghapus '||v_entity_type||COALESCE(' '||v_entity_number,'')
  END;

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.activity_logs(company_id,user_id,action,entity_type,entity_id,entity_number,description,changes)
    VALUES (v_company_id, v_user_id, v_action, v_entity_type, v_entity_id, v_entity_number, v_desc,
            CASE WHEN TG_OP='UPDATE' THEN v_changes ELSE NULL END);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
EXCEPTION WHEN OTHERS THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- 7. Pasang trigger ke semua tabel transaksi
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'sales_orders','invoices','payments','customers',
    'purchase_orders','goods_receipts','bills','suppliers',
    'products','journal_entries','chart_of_accounts',
    'fixed_assets','stock_transfers','stock_opnames',
    'down_payments','pos_transactions','companies',
    'pos_open_tables','pos_deposits','pos_promotions',
    'pos_tax_rates','pos_payment_methods','printer_settings',
    'product_categories','warehouses','recipes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()', t, t);
    END IF;
  END LOOP;
END $$;
