-- Pasang audit_trigger_func ke semua tabel transaksi & master penting

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'companies','customers','suppliers','products','product_categories','warehouses',
    'chart_of_accounts','user_roles','user_companies','user_permissions',
    'sales_orders','sales_order_items','invoices','invoice_items',
    'purchase_orders','purchase_order_items','goods_receipts','goods_receipt_items',
    'bills','bill_items','payments','payment_allocations','down_payments',
    'journal_entries','journal_entry_lines',
    'inventory_movements','inventory_stock','stock_transfers','stock_transfer_items',
    'stock_opname','stock_opname_items',
    'fixed_assets','asset_depreciations',
    'pos_transactions','pos_transaction_items','pos_cash_sessions','pos_deposits',
    'pos_promotions','pos_tax_rates','pos_payment_methods',
    'period_closings','opening_balances',
    'recipes','recipe_items','product_suppliers','product_tax_rates'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_trg ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',
        t
      );
    END IF;
  END LOOP;
END $$;