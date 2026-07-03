import { z } from 'zod';

// ============ Primitives ============
export const nonEmptyTrim = (max = 200, label = 'Field') =>
  z.string().trim().min(1, `${label} wajib diisi`).max(max, `${label} maksimal ${max} karakter`);

export const positiveAmount = (label = 'Jumlah') =>
  z.coerce.number({ invalid_type_error: `${label} harus angka` }).positive(`${label} harus lebih dari 0`);

export const nonNegativeAmount = (label = 'Jumlah') =>
  z.coerce.number({ invalid_type_error: `${label} harus angka` }).min(0, `${label} tidak boleh negatif`);

export const emailOpt = z
  .string()
  .trim()
  .max(255)
  .email('Format email tidak valid')
  .optional()
  .or(z.literal(''));

export const phoneOpt = z
  .string()
  .trim()
  .max(20)
  .regex(/^[\d\s+()-]*$/, 'Format nomor telepon tidak valid')
  .optional()
  .or(z.literal(''));

export const npwpOpt = z
  .string()
  .trim()
  .regex(/^[\d.-]*$/, 'NPWP hanya boleh berisi angka, titik, dan strip')
  .max(25)
  .optional()
  .or(z.literal(''));

export const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid');

export const uuidReq = (label = 'Field') => z.string().uuid(`${label} wajib dipilih`).min(1, `${label} wajib dipilih`);
export const uuidOpt = z.string().uuid().optional().or(z.literal(''));

// ============ Entity Schemas ============
export const customerSchema = z.object({
  name: nonEmptyTrim(150, 'Nama'),
  email: emailOpt,
  phone: phoneOpt,
  tax_number: npwpOpt,
  credit_limit: nonNegativeAmount('Credit limit').optional(),
});

export const supplierSchema = z.object({
  name: nonEmptyTrim(150, 'Nama'),
  email: emailOpt,
  phone: phoneOpt,
  tax_number: npwpOpt,
});

export const expenseSchema = z.object({
  expense_date: dateISO,
  expense_account_id: uuidReq('Akun beban'),
  payment_account_id: uuidReq('Akun pembayaran'),
  amount: positiveAmount('Jumlah'),
  tax_amount: nonNegativeAmount('Pajak').optional(),
  supplier_id: uuidOpt,
  reference_no: z.string().trim().max(50).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
}).refine((d) => new Date(d.expense_date) <= new Date(new Date().toDateString()), {
  message: 'Tanggal beban tidak boleh di masa depan',
  path: ['expense_date'],
});

export const paymentSchema = z.object({
  payment_date: dateISO,
  cash_account_id: uuidReq('Akun kas/bank'),
  amount: positiveAmount('Jumlah'),
  reference_no: z.string().trim().max(50).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const cashTransferSchema = z.object({
  transfer_date: dateISO,
  from_account_id: uuidReq('Akun asal'),
  to_account_id: uuidReq('Akun tujuan'),
  amount: positiveAmount('Jumlah'),
  fee_amount: nonNegativeAmount('Biaya').optional(),
}).refine((d) => d.from_account_id !== d.to_account_id, {
  message: 'Akun asal dan tujuan harus berbeda',
  path: ['to_account_id'],
});

export const invoiceHeaderSchema = z.object({
  customer_id: uuidReq('Customer'),
  invoice_date: dateISO,
  due_date: dateISO,
}).refine((d) => d.due_date >= d.invoice_date, {
  message: 'Jatuh tempo harus setelah tanggal invoice',
  path: ['due_date'],
});

// ============ Cross-field helpers ============
export function assertBalanced(lines: { debit?: number; credit?: number }[], tolerance = 0.01) {
  const d = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const c = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(d - c) > tolerance) {
    throw new Error(`Jurnal tidak balance: Debit ${d.toFixed(2)} ≠ Credit ${c.toFixed(2)}`);
  }
}

export function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue ? `${issue.path.join('.') || 'Field'}: ${issue.message}` : 'Validasi gagal';
}
