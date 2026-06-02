/**
 * Default Chart of Accounts Templates by Industry
 * Based on International Accounting Standards (IAS/IFRS)
 * 
 * Account Numbering System:
 * 1xxx - Assets (Aset)
 * 2xxx - Liabilities (Kewajiban)
 * 3xxx - Equity (Modal)
 * 4xxx - Revenue (Pendapatan)
 * 5xxx - Cost of Goods Sold / Cost of Services (HPP/Biaya Langsung)
 * 6xxx - Operating Expenses (Beban Operasional)
 * 7xxx - Other Income (Pendapatan Lain-lain)
 * 8xxx - Other Expenses (Beban Lain-lain)
 */

export type BusinessType = 'trading' | 'service' | 'manufacturing';

export interface COATemplate {
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cash_bank' | 'other_income' | 'other_expenses';
  parent_code?: string;
  is_header?: boolean;
  description?: string;
}

// Common accounts for all industries
const commonAccounts: COATemplate[] = [
  // ===== 1. ASSETS (ASET) =====
  // Cash & Bank
  { code: '1-1000', name: 'Kas & Bank', account_type: 'cash_bank', is_header: true },
  { code: '1-1001', name: 'Kas', account_type: 'cash_bank', parent_code: '1-1000', description: 'Uang tunai' },
  { code: '1-1002', name: 'Kas Kecil', account_type: 'cash_bank', parent_code: '1-1000', description: 'Petty cash' },
  { code: '1-1100', name: 'Bank BCA', account_type: 'cash_bank', parent_code: '1-1000' },
  { code: '1-1101', name: 'Bank Mandiri', account_type: 'cash_bank', parent_code: '1-1000' },
  { code: '1-1102', name: 'Bank BRI', account_type: 'cash_bank', parent_code: '1-1000' },
  { code: '1-1103', name: 'Bank BNI', account_type: 'cash_bank', parent_code: '1-1000' },

  // Current Assets
  { code: '1-2000', name: 'Aset Lancar', account_type: 'asset', is_header: true },
  { code: '1-2100', name: 'Piutang Usaha', account_type: 'asset', parent_code: '1-2000', description: 'Accounts Receivable' },
  { code: '1-2101', name: 'Cadangan Kerugian Piutang', account_type: 'asset', parent_code: '1-2000', description: 'Allowance for doubtful accounts' },
  { code: '1-2200', name: 'Piutang Lain-lain', account_type: 'asset', parent_code: '1-2000' },
  { code: '1-2300', name: 'Uang Muka Pembelian', account_type: 'asset', parent_code: '1-2000', description: 'Prepaid purchases / Down payment' },
  { code: '1-2400', name: 'Biaya Dibayar Dimuka', account_type: 'asset', parent_code: '1-2000', description: 'Prepaid expenses' },
  { code: '1-2500', name: 'PPN Masukan', account_type: 'asset', parent_code: '1-2000', description: 'VAT In' },
  { code: '1-2501', name: 'PPh 23 Dibayar Dimuka', account_type: 'asset', parent_code: '1-2000', description: 'Prepaid Income Tax Art. 23' },
  { code: '1-2502', name: 'PPh 25 Dibayar Dimuka', account_type: 'asset', parent_code: '1-2000', description: 'Prepaid Income Tax Art. 25' },

  // Fixed Assets
  { code: '1-3000', name: 'Aset Tetap', account_type: 'asset', is_header: true },
  { code: '1-3100', name: 'Tanah', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3200', name: 'Bangunan', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3201', name: 'Akumulasi Penyusutan Bangunan', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3300', name: 'Kendaraan', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3301', name: 'Akumulasi Penyusutan Kendaraan', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3400', name: 'Peralatan & Mesin', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3401', name: 'Akumulasi Penyusutan Peralatan', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3500', name: 'Inventaris Kantor', account_type: 'asset', parent_code: '1-3000' },
  { code: '1-3501', name: 'Akumulasi Penyusutan Inventaris', account_type: 'asset', parent_code: '1-3000' },

  // ===== 2. LIABILITIES (KEWAJIBAN) =====
  { code: '2-1000', name: 'Kewajiban Lancar', account_type: 'liability', is_header: true },
  { code: '2-1100', name: 'Hutang Usaha', account_type: 'liability', parent_code: '2-1000', description: 'Accounts Payable' },
  { code: '2-1200', name: 'Hutang Lain-lain', account_type: 'liability', parent_code: '2-1000' },
  { code: '2-1300', name: 'Uang Muka Penjualan', account_type: 'liability', parent_code: '2-1000', description: 'Customer deposits' },
  { code: '2-1400', name: 'Biaya Yang Masih Harus Dibayar', account_type: 'liability', parent_code: '2-1000', description: 'Accrued expenses' },
  { code: '2-1500', name: 'Hutang Gaji', account_type: 'liability', parent_code: '2-1000' },
  { code: '2-1600', name: 'PPN Keluaran', account_type: 'liability', parent_code: '2-1000', description: 'VAT Out' },
  { code: '2-1601', name: 'Hutang PPh 21', account_type: 'liability', parent_code: '2-1000', description: 'Employee income tax payable' },
  { code: '2-1602', name: 'Hutang PPh 23', account_type: 'liability', parent_code: '2-1000' },
  { code: '2-1603', name: 'Hutang PPh 25/29', account_type: 'liability', parent_code: '2-1000' },

  { code: '2-2000', name: 'Kewajiban Jangka Panjang', account_type: 'liability', is_header: true },
  { code: '2-2100', name: 'Hutang Bank', account_type: 'liability', parent_code: '2-2000', description: 'Bank loan' },
  { code: '2-2200', name: 'Hutang Sewa Guna Usaha', account_type: 'liability', parent_code: '2-2000', description: 'Lease liability' },

  // ===== 3. EQUITY (MODAL) =====
  { code: '3-1000', name: 'Modal', account_type: 'equity', is_header: true },
  { code: '3-1100', name: 'Modal Disetor', account_type: 'equity', parent_code: '3-1000', description: 'Paid-in capital' },
  { code: '3-1200', name: 'Modal Saham', account_type: 'equity', parent_code: '3-1000', description: 'Share capital' },
  { code: '3-2000', name: 'Laba Ditahan', account_type: 'equity', is_header: true },
  { code: '3-2100', name: 'Laba Ditahan Tahun Lalu', account_type: 'equity', parent_code: '3-2000', description: 'Retained earnings - prior years' },
  { code: '3-2200', name: 'Laba Tahun Berjalan', account_type: 'equity', parent_code: '3-2000', description: 'Current year earnings' },
  { code: '3-3000', name: 'Prive / Dividen', account_type: 'equity', description: 'Owner withdrawals / Dividends' },

  // ===== 7. OTHER INCOME (PENDAPATAN LAIN-LAIN) =====
  { code: '7-1000', name: 'Pendapatan Lain-lain', account_type: 'other_income', is_header: true },
  { code: '7-1100', name: 'Pendapatan Bunga', account_type: 'other_income', parent_code: '7-1000', description: 'Interest income' },
  { code: '7-1200', name: 'Pendapatan Sewa', account_type: 'other_income', parent_code: '7-1000', description: 'Rental income' },
  { code: '7-1300', name: 'Keuntungan Selisih Kurs', account_type: 'other_income', parent_code: '7-1000', description: 'Foreign exchange gain' },
  { code: '7-1400', name: 'Keuntungan Penjualan Aset', account_type: 'other_income', parent_code: '7-1000', description: 'Gain on sale of assets' },
  { code: '7-1900', name: 'Pendapatan Lain-lain - Lainnya', account_type: 'other_income', parent_code: '7-1000' },

  // ===== 8. OTHER EXPENSES (BEBAN LAIN-LAIN) =====
  { code: '8-1000', name: 'Beban Lain-lain', account_type: 'other_expenses', is_header: true },
  { code: '8-1100', name: 'Beban Bunga', account_type: 'other_expenses', parent_code: '8-1000', description: 'Interest expense' },
  { code: '8-1200', name: 'Beban Administrasi Bank', account_type: 'other_expenses', parent_code: '8-1000', description: 'Bank charges' },
  { code: '8-1300', name: 'Kerugian Selisih Kurs', account_type: 'other_expenses', parent_code: '8-1000', description: 'Foreign exchange loss' },
  { code: '8-1400', name: 'Kerugian Penjualan Aset', account_type: 'other_expenses', parent_code: '8-1000', description: 'Loss on sale of assets' },
  { code: '8-1500', name: 'Beban Pajak Penghasilan', account_type: 'other_expenses', parent_code: '8-1000', description: 'Income tax expense' },
  { code: '8-1900', name: 'Beban Lain-lain - Lainnya', account_type: 'other_expenses', parent_code: '8-1000' },
];

// Common operating expenses for all industries
const commonOperatingExpenses: COATemplate[] = [
  // ===== 6. OPERATING EXPENSES (BEBAN OPERASIONAL) =====
  { code: '6-1000', name: 'Beban Operasional', account_type: 'expense', is_header: true },
  { code: '6-1100', name: 'Beban Gaji & Upah', account_type: 'expense', parent_code: '6-1000', description: 'Salaries & wages' },
  { code: '6-1101', name: 'Beban Tunjangan Karyawan', account_type: 'expense', parent_code: '6-1000', description: 'Employee benefits' },
  { code: '6-1102', name: 'Beban BPJS Kesehatan', account_type: 'expense', parent_code: '6-1000' },
  { code: '6-1103', name: 'Beban BPJS Ketenagakerjaan', account_type: 'expense', parent_code: '6-1000' },
  { code: '6-1200', name: 'Beban Sewa', account_type: 'expense', parent_code: '6-1000', description: 'Rent expense' },
  { code: '6-1300', name: 'Beban Listrik & Air', account_type: 'expense', parent_code: '6-1000', description: 'Utilities' },
  { code: '6-1400', name: 'Beban Telepon & Internet', account_type: 'expense', parent_code: '6-1000' },
  { code: '6-1500', name: 'Beban Transportasi', account_type: 'expense', parent_code: '6-1000' },
  { code: '6-1600', name: 'Beban Perjalanan Dinas', account_type: 'expense', parent_code: '6-1000', description: 'Travel expense' },
  { code: '6-1700', name: 'Beban Perlengkapan Kantor', account_type: 'expense', parent_code: '6-1000', description: 'Office supplies' },
  { code: '6-1800', name: 'Beban Pemeliharaan', account_type: 'expense', parent_code: '6-1000', description: 'Maintenance expense' },
  { code: '6-1900', name: 'Beban Asuransi', account_type: 'expense', parent_code: '6-1000', description: 'Insurance expense' },
  { code: '6-2000', name: 'Beban Penyusutan', account_type: 'expense', parent_code: '6-1000', description: 'Depreciation expense' },
  { code: '6-2100', name: 'Beban Iklan & Promosi', account_type: 'expense', parent_code: '6-1000', description: 'Advertising & promotion' },
  { code: '6-2200', name: 'Beban Jasa Profesional', account_type: 'expense', parent_code: '6-1000', description: 'Professional fees' },
  { code: '6-2300', name: 'Beban Perijinan', account_type: 'expense', parent_code: '6-1000', description: 'Licenses & permits' },
  { code: '6-2400', name: 'Beban Kerugian Piutang', account_type: 'expense', parent_code: '6-1000', description: 'Bad debt expense' },
  { code: '6-2500', name: 'Beban Representasi', account_type: 'expense', parent_code: '6-1000', description: 'Entertainment expense' },
  { code: '6-2900', name: 'Beban Operasional Lainnya', account_type: 'expense', parent_code: '6-1000' },
];

// Trading (Dagang) specific accounts
const tradingAccounts: COATemplate[] = [
  // Inventory
  { code: '1-2600', name: 'Persediaan Barang Dagangan', account_type: 'asset', parent_code: '1-2000', description: 'Merchandise inventory' },
  { code: '1-2601', name: 'Persediaan Dalam Perjalanan', account_type: 'asset', parent_code: '1-2000', description: 'Goods in transit' },

  // Revenue
  { code: '4-1000', name: 'Pendapatan Penjualan', account_type: 'revenue', is_header: true },
  { code: '4-1100', name: 'Penjualan Barang Dagangan', account_type: 'revenue', parent_code: '4-1000', description: 'Sales revenue' },
  { code: '4-1200', name: 'Diskon Penjualan', account_type: 'revenue', parent_code: '4-1000', description: 'Sales discount (contra)' },
  { code: '4-1300', name: 'Retur Penjualan', account_type: 'revenue', parent_code: '4-1000', description: 'Sales returns (contra)' },
  { code: '4-1400', name: 'Potongan Penjualan', account_type: 'revenue', parent_code: '4-1000', description: 'Sales allowance (contra)' },

  // COGS
  { code: '5-1000', name: 'Harga Pokok Penjualan', account_type: 'expense', is_header: true, description: 'Cost of Goods Sold (COGS)' },
  { code: '5-1100', name: 'Pembelian Barang Dagangan', account_type: 'expense', parent_code: '5-1000', description: 'Purchases' },
  { code: '5-1200', name: 'Diskon Pembelian', account_type: 'expense', parent_code: '5-1000', description: 'Purchase discount (contra)' },
  { code: '5-1300', name: 'Retur Pembelian', account_type: 'expense', parent_code: '5-1000', description: 'Purchase returns (contra)' },
  { code: '5-1400', name: 'Ongkos Angkut Pembelian', account_type: 'expense', parent_code: '5-1000', description: 'Freight-in' },
  { code: '5-1500', name: 'Biaya Bea Masuk', account_type: 'expense', parent_code: '5-1000', description: 'Import duty' },
  { code: '5-1900', name: 'HPP - Penyesuaian Persediaan', account_type: 'expense', parent_code: '5-1000', description: 'Inventory adjustment' },
];

// Service (Jasa) specific accounts
const serviceAccounts: COATemplate[] = [
  // Work in Progress (for long-term projects)
  { code: '1-2600', name: 'Pekerjaan Dalam Proses', account_type: 'asset', parent_code: '1-2000', description: 'Work in progress' },

  // Revenue
  { code: '4-1000', name: 'Pendapatan Jasa', account_type: 'revenue', is_header: true },
  { code: '4-1100', name: 'Pendapatan Jasa Utama', account_type: 'revenue', parent_code: '4-1000', description: 'Main service revenue' },
  { code: '4-1200', name: 'Pendapatan Jasa Konsultasi', account_type: 'revenue', parent_code: '4-1000', description: 'Consulting revenue' },
  { code: '4-1300', name: 'Pendapatan Jasa Profesional', account_type: 'revenue', parent_code: '4-1000', description: 'Professional service revenue' },
  { code: '4-1400', name: 'Diskon Pendapatan Jasa', account_type: 'revenue', parent_code: '4-1000', description: 'Service discount (contra)' },

  // Cost of Services
  { code: '5-1000', name: 'Biaya Langsung Jasa', account_type: 'expense', is_header: true, description: 'Direct Cost of Services' },
  { code: '5-1100', name: 'Biaya Tenaga Kerja Langsung', account_type: 'expense', parent_code: '5-1000', description: 'Direct labor' },
  { code: '5-1200', name: 'Biaya Subkontraktor', account_type: 'expense', parent_code: '5-1000', description: 'Subcontractor cost' },
  { code: '5-1300', name: 'Biaya Material Langsung', account_type: 'expense', parent_code: '5-1000', description: 'Direct materials' },
  { code: '5-1400', name: 'Biaya Perjalanan Proyek', account_type: 'expense', parent_code: '5-1000', description: 'Project travel' },
  { code: '5-1900', name: 'Biaya Langsung Lainnya', account_type: 'expense', parent_code: '5-1000' },
];

// Manufacturing (Manufaktur) specific accounts
const manufacturingAccounts: COATemplate[] = [
  // Inventory
  { code: '1-2600', name: 'Persediaan Bahan Baku', account_type: 'asset', parent_code: '1-2000', description: 'Raw materials inventory' },
  { code: '1-2601', name: 'Persediaan Bahan Penolong', account_type: 'asset', parent_code: '1-2000', description: 'Supplies inventory' },
  { code: '1-2700', name: 'Barang Dalam Proses', account_type: 'asset', parent_code: '1-2000', description: 'Work in process (WIP)' },
  { code: '1-2800', name: 'Persediaan Barang Jadi', account_type: 'asset', parent_code: '1-2000', description: 'Finished goods inventory' },

  // Revenue
  { code: '4-1000', name: 'Pendapatan Penjualan', account_type: 'revenue', is_header: true },
  { code: '4-1100', name: 'Penjualan Barang Jadi', account_type: 'revenue', parent_code: '4-1000', description: 'Sales of manufactured goods' },
  { code: '4-1200', name: 'Diskon Penjualan', account_type: 'revenue', parent_code: '4-1000', description: 'Sales discount (contra)' },
  { code: '4-1300', name: 'Retur Penjualan', account_type: 'revenue', parent_code: '4-1000', description: 'Sales returns (contra)' },

  // Cost of Goods Manufactured
  { code: '5-1000', name: 'Harga Pokok Produksi', account_type: 'expense', is_header: true, description: 'Cost of Goods Manufactured (COGM)' },
  { code: '5-1100', name: 'Pemakaian Bahan Baku', account_type: 'expense', parent_code: '5-1000', description: 'Raw materials used' },
  { code: '5-1200', name: 'Pemakaian Bahan Penolong', account_type: 'expense', parent_code: '5-1000', description: 'Supplies used' },
  { code: '5-1300', name: 'Tenaga Kerja Langsung', account_type: 'expense', parent_code: '5-1000', description: 'Direct labor' },
  { code: '5-2000', name: 'Biaya Overhead Pabrik', account_type: 'expense', is_header: true, description: 'Factory overhead' },
  { code: '5-2100', name: 'Tenaga Kerja Tidak Langsung', account_type: 'expense', parent_code: '5-2000', description: 'Indirect labor' },
  { code: '5-2200', name: 'Biaya Listrik Pabrik', account_type: 'expense', parent_code: '5-2000', description: 'Factory utilities' },
  { code: '5-2300', name: 'Biaya Pemeliharaan Mesin', account_type: 'expense', parent_code: '5-2000', description: 'Machine maintenance' },
  { code: '5-2400', name: 'Penyusutan Mesin & Peralatan', account_type: 'expense', parent_code: '5-2000', description: 'Depreciation - machinery' },
  { code: '5-2500', name: 'Biaya Sewa Pabrik', account_type: 'expense', parent_code: '5-2000', description: 'Factory rent' },
  { code: '5-2600', name: 'Biaya Asuransi Pabrik', account_type: 'expense', parent_code: '5-2000', description: 'Factory insurance' },
  { code: '5-2900', name: 'Biaya Overhead Lainnya', account_type: 'expense', parent_code: '5-2000' },
];

/**
 * Returns the FULL standard PSAK Chart of Accounts (1-8), combining
 * common accounts + accounts from all industries (trading, service, manufacturing),
 * deduplicated by code. Unused accounts can simply be set inactive by the user.
 */
export const getFullPSAKCOA = (): COATemplate[] => {
  const merged: COATemplate[] = [
    ...commonAccounts,
    ...tradingAccounts,
    ...serviceAccounts,
    ...manufacturingAccounts,
    ...commonOperatingExpenses,
  ];

  const seen = new Set<string>();
  const unique: COATemplate[] = [];
  for (const acc of merged) {
    if (!seen.has(acc.code)) {
      seen.add(acc.code);
      unique.push(acc);
    }
  }
  return unique.sort((a, b) => a.code.localeCompare(b.code));
};

export const getDefaultCOA = (_businessType?: BusinessType): COATemplate[] => {
  // Always return the full standard PSAK COA regardless of business type.
  return getFullPSAKCOA();
};

export const businessTypeLabels: Record<BusinessType, { label: string; description: string }> = {
  trading: {
    label: 'Perdagangan (Trading)',
    description: 'Bisnis jual-beli barang dagangan, retail, wholesale, distributor',
  },
  service: {
    label: 'Jasa (Service)',
    description: 'Bisnis penyedia layanan: konsultan, bengkel, salon, restoran, hotel',
  },
  manufacturing: {
    label: 'Manufaktur (Manufacturing)',
    description: 'Bisnis produksi/pabrikasi: pabrik, pengolahan, konveksi',
  },
};

export const getBusinessTypeLabel = (type: BusinessType): string => {
  return businessTypeLabels[type]?.label || type;
};
