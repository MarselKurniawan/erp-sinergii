import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Search, Receipt, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { generateDocumentNumber } from '@/lib/documentNumber';
import { AttachmentList } from '@/components/AttachmentList';
import { expenseSchema, firstZodError } from '@/lib/validation/schemas';

interface ExpenseRow {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  expense_account?: { code: string; name: string } | null;
  payment_account?: { code: string; name: string } | null;
  suppliers?: { name: string } | null;
}

const Expenses: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getExpenseAccounts, getCashBankAccounts } = useAccounts();
  const { suppliers } = useSuppliers();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const empty = {
    expense_date: new Date().toISOString().slice(0, 10),
    expense_account_id: '',
    payment_account_id: '',
    supplier_id: '',
    amount: '',
    tax_amount: '0',
    reference_no: '',
    notes: '',
  };
  const [form, setForm] = useState(empty);
  const [savedExpenseId, setSavedExpenseId] = useState<string | null>(null);

  const fetchRows = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_account:chart_of_accounts!expenses_expense_account_id_fkey(code,name), payment_account:chart_of_accounts!expenses_payment_account_id_fkey(code,name), suppliers(name)')
      .eq('company_id', selectedCompany.id)
      .is('voided_at', null)
      .order('expense_date', { ascending: false });
    if (error) toast.error('Gagal memuat data');
    else setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, [selectedCompany]);
  useEffect(() => {
    if (params.get('new') === '1' || location.pathname.endsWith('/new')) {
      setOpen(true);
      if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    }
  }, [params, location.pathname]);

  const total = useMemo(() => (parseFloat(form.amount || '0') || 0) + (parseFloat(form.tax_amount || '0') || 0), [form]);

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    const parsed = expenseSchema.safeParse({
      expense_date: form.expense_date,
      expense_account_id: form.expense_account_id,
      payment_account_id: form.payment_account_id,
      amount: form.amount,
      tax_amount: form.tax_amount || 0,
      supplier_id: form.supplier_id || undefined,
      reference_no: form.reference_no,
      notes: form.notes,
    });
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }
    setSubmitting(true);
    try {
      const expense_number = await generateDocumentNumber(selectedCompany.id, 'JE');
      // Create journal entry
      const { data: je, error: jeErr } = await supabase
        .from('journal_entries')
        .insert({
          company_id: selectedCompany.id,
          entry_number: expense_number,
          entry_date: form.expense_date,
          description: `Beban: ${form.notes || ''}`.trim(),
          is_posted: true,
          reference_type: 'expense',
          created_by: user.id,
        })
        .select()
        .single();
      if (jeErr) throw jeErr;
      const lines = [
        { journal_entry_id: je.id, account_id: form.expense_account_id, debit_amount: parseFloat(form.amount), credit_amount: 0 },
        { journal_entry_id: je.id, account_id: form.payment_account_id, debit_amount: 0, credit_amount: total },
      ];
      if (parseFloat(form.tax_amount || '0') > 0) {
        lines.splice(1, 0, { journal_entry_id: je.id, account_id: form.expense_account_id, debit_amount: parseFloat(form.tax_amount), credit_amount: 0 });
      }
      const { error: lineErr } = await supabase.from('journal_entry_lines').insert(lines);
      if (lineErr) throw lineErr;

      const { data: inserted, error } = await supabase.from('expenses').insert({
        company_id: selectedCompany.id,
        expense_number,
        expense_date: form.expense_date,
        expense_account_id: form.expense_account_id,
        payment_account_id: form.payment_account_id,
        supplier_id: form.supplier_id || null,
        amount: parseFloat(form.amount),
        tax_amount: parseFloat(form.tax_amount || '0'),
        total_amount: total,
        reference_no: form.reference_no || null,
        notes: form.notes || null,
        journal_entry_id: je.id,
        created_by: user.id,
      }).select('id').single();
      if (error) throw error;
      toast.success('Expense tersimpan — kamu bisa upload lampiran di bawah (opsional)');
      setSavedExpenseId(inserted.id);
      fetchRows();
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setSavedExpenseId(null);
    setForm(empty);
  };

  const filtered = rows.filter(r =>
    !search ||
    r.expense_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.notes || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.suppliers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const expenseAccs = getExpenseAccounts();
  const cashAccs = getCashBankAccounts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6" /> Expenses</h1>
          <p className="text-muted-foreground">Catat beban operasional perusahaan</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Expense</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nomor, supplier, keterangan…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Akun Beban</TableHead>
                <TableHead>Dibayar Dari</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada expense</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.expense_number}</TableCell>
                  <TableCell>{formatDate(r.expense_date)}</TableCell>
                  <TableCell>{r.expense_account ? `${r.expense_account.code} ${r.expense_account.name}` : '-'}</TableCell>
                  <TableCell>{r.payment_account ? `${r.payment_account.code} ${r.payment_account.name}` : '-'}</TableCell>
                  <TableCell>{r.suppliers?.name || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.notes || '-'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(r.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tanggal</label>
                <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">No. Referensi</label>
                <Input value={form.reference_no} onChange={e => setForm({ ...form, reference_no: e.target.value })} placeholder="opsional" />
              </div>
              <div>
                <label className="text-sm font-medium">Akun Beban *</label>
                <SearchableSelect value={form.expense_account_id} onChange={v => setForm({ ...form, expense_account_id: v })}
                  options={expenseAccs.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))} placeholder="Pilih akun beban" />
              </div>
              <div>
                <label className="text-sm font-medium">Dibayar Dari (Kas/Bank) *</label>
                <SearchableSelect value={form.payment_account_id} onChange={v => setForm({ ...form, payment_account_id: v })}
                  options={cashAccs.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))} placeholder="Pilih akun kas/bank" />
              </div>
              <div>
                <label className="text-sm font-medium">Supplier (opsional)</label>
                <SearchableSelect value={form.supplier_id} onChange={v => setForm({ ...form, supplier_id: v })}
                  options={suppliers.map(s => ({ value: s.id, label: s.name }))} placeholder="Pilih supplier" />
              </div>
              <div>
                <label className="text-sm font-medium">Jumlah (DPP) *</label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Pajak</label>
                <Input type="number" value={form.tax_amount} onChange={e => setForm({ ...form, tax_amount: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Total</label>
                <Input value={formatCurrency(total)} disabled />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Keterangan</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;