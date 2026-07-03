import { supabase } from '@/lib/supabase';

export type EntityType =
  | 'sales_order' | 'invoice' | 'payment' | 'customer'
  | 'purchase_order' | 'bill' | 'goods_receipt' | 'supplier'
  | 'product' | 'journal_entry' | 'pos_transaction'
  | 'chart_of_accounts' | 'fixed_asset' | 'stock_transfer'
  | 'stock_opname' | 'down_payment' | 'company';

export type ActionType = 'create' | 'update' | 'delete' | 'confirm' | 'cancel' | 'post' | 'close';

interface LogActivityParams {
  companyId: string;
  userId?: string;
  action: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityNumber?: string;
  description: string;
  changes?: Record<string, { old: any; new: any }>;
}

export const logActivity = async (params: LogActivityParams) => {
  try {
    await supabase.from('activity_logs').insert({
      company_id: params.companyId,
      user_id: params.userId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_number: params.entityNumber || null,
      description: params.description,
      changes: params.changes || null,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

export const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    create: 'Dibuat',
    update: 'Diubah',
    delete: 'Dihapus',
    confirm: 'Dikonfirmasi',
    cancel: 'Dibatalkan',
    post: 'Diposting',
    close: 'Ditutup',
  };
  return labels[action] || action;
};

const ENTITY_LABELS: Record<string, string> = {
  // friendly aliases
  sales_order: 'Sales Order',
  sales_orders: 'Sales Order',
  invoice: 'Invoice',
  invoices: 'Invoice',
  payment: 'Pembayaran',
  payments: 'Pembayaran',
  sales_payments: 'Pembayaran Penjualan',
  purchase_payments: 'Pembayaran Pembelian',
  customer: 'Customer',
  customers: 'Customer',
  purchase_order: 'Purchase Order',
  purchase_orders: 'Purchase Order',
  bill: 'Bill',
  bills: 'Bill',
  goods_receipt: 'Penerimaan Barang',
  goods_receipts: 'Penerimaan Barang',
  supplier: 'Supplier',
  suppliers: 'Supplier',
  product: 'Produk',
  products: 'Produk',
  materials: 'Bahan Baku',
  journal_entry: 'Jurnal Entry',
  journal_entries: 'Jurnal Entry',
  journal_lines: 'Baris Jurnal',
  pos_transaction: 'Transaksi POS',
  pos_transactions: 'Transaksi POS',
  pos_items: 'Item POS',
  chart_of_accounts: 'Akun (COA)',
  accounts: 'Akun (COA)',
  fixed_asset: 'Aset Tetap',
  fixed_assets: 'Aset Tetap',
  stock_transfer: 'Transfer Stok',
  stock_transfers: 'Transfer Stok',
  stock_opname: 'Stock Opname',
  stock_opnames: 'Stock Opname',
  down_payment: 'Down Payment',
  down_payments: 'Down Payment',
  company: 'Perusahaan',
  companies: 'Perusahaan',
  warehouses: 'Gudang',
  recipes: 'Resep / BOM',
  pos_deposits: 'Deposit POS',
  promotions: 'Promosi',
  tax_settings: 'Tax & Services',
  product_categories: 'Kategori Produk',
  user_permissions: 'Permission User',
  user_roles: 'Role User',
  user_companies: 'Assignment Perusahaan',
};

const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const getEntityLabel = (entityType: string): string => {
  return ENTITY_LABELS[entityType] || humanize(entityType);
};
