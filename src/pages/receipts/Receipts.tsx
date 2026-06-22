import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Search, Receipt as ReceiptIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface Row {
  id: string; receipt_number: string; receipt_date: string;
  amount: number; tax_amount: number; total_amount: number; notes: string | null;
  income_account?: { code: string; name: string } | null;
  cash_account?: { code: string; name: string } | null;
  customers?: { name: string } | null;
}

const Receipts: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getRevenueAccounts, getCashBankAccounts } = useAccounts();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const empty = {
    receipt_date: new Date().toISOString().slice(0, 10),
    customer_id: '',
    income_account_id: '',
    cash_account_id: '',
    amount: '',
    tax_amount: '0',
    reference_no: '',
    notes: '',
  };
  const [form, setForm] = useState(empty);

  const fetchRows = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('receipts')
      .select('*, income_account:chart_of_accounts!receipts_income_account_id_fkey(code,name), cash_account:chart_of_accounts!receipts_cash_account_id_fkey(code,name), customers(name)')
      .eq('company_id', selectedCompany.id)
      .is('voided_at', null)
      .order('receipt_date', { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    if (!selectedCompany) return;
    const { data } = await supabase.from('customers').select('id,name').eq('company_id', selectedCompany.id).order('name');
    setCustomers(data || []);
  };

  useEffect(() => { fetchRows(); fetchCustomers(); }, [selectedCompany]);
  useEffect(() => {
    if (params.get('new') === '1' || location.pathname.endsWith('/new')) {
      setOpen(true);
      if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    }
  }, [params, location.pathname]);

  const total = useMemo(() => (parseFloat(form.amount || '0') || 0) + (parseFloat(form.tax_amount || '0') || 0), [form]);

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    if (!form.income_account_id || !form.cash_account_id || !form.amount) {
      toast.error('Lengkapi akun pendapatan, akun kas, dan jumlah'); return;
    }
    setSubmitting(true);
    try {
      const { data: numData } = await supabase.rpc('generate_document_number', {
        p_company_id: selectedCompany.id, p_document_type: 'RCP',
      });
      const receipt_number = (numData as string) || `RCP-${Date.now()}`;
      const amt = parseFloat(form.amount); const tax = parseFloat(form.tax_amount || '0') || 0;

      const { data: je, error: jeErr } = await supabase.from('journal_entries').insert({
        company_id: selectedCompany.id,
        entry_number: receipt_number,
        entry_date: form.receipt_date,
        description: `Receipt ${receipt_number}`,
        status: 'posted', created_by: user.id,
      }).select().single();
      if (jeErr) throw jeErr;

      const lines = [
        { journal_entry_id: je.id, account_id: form.cash_account_id, debit: amt + tax, credit: 0 },
        { journal_entry_id: je.id, account_id: form.income_account_id, debit: 0, credit: amt },
      ];
      if (tax > 0) lines[1].credit = amt; // income only the base
      await supabase.from('journal_entry_lines').insert(lines as any);

      const { error } = await supabase.from('receipts').insert({
        company_id: selectedCompany.id,
        receipt_number, receipt_date: form.receipt_date,
        customer_id: form.customer_id || null,
        income_account_id: form.income_account_id,
        cash_account_id: form.cash_account_id,
        amount: amt, tax_amount: tax, total_amount: amt + tax,
        reference_no: form.reference_no || null,
        notes: form.notes || null,
        journal_entry_id: je.id, created_by: user.id,
      } as any);
      if (error) throw error;

      toast.success('Receipt berhasil dibuat');
      setOpen(false); setForm(empty); fetchRows();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan'); }
    finally { setSubmitting(false); }
  };

  const filtered = rows.filter(r =>
    r.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.customers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ReceiptIcon className="h-6 w-6" /> Receipts</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Receipt</Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari nomor / customer..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tanggal</TableHead><TableHead>No</TableHead><TableHead>Customer</TableHead>
            <TableHead>Akun Pendapatan</TableHead><TableHead>Akun Kas</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (<TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>)
              : filtered.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada data</TableCell></TableRow>)
              : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.receipt_date)}</TableCell>
                  <TableCell className="font-mono">{r.receipt_number}</TableCell>
                  <TableCell>{r.customers?.name || '-'}</TableCell>
                  <TableCell>{r.income_account ? `${r.income_account.code} - ${r.income_account.name}` : '-'}</TableCell>
                  <TableCell>{r.cash_account ? `${r.cash_account.code} - ${r.cash_account.name}` : '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Receipt</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Tanggal</label>
              <Input type="date" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Customer (opsional)</label>
              <SearchableSelect
                value={form.customer_id}
                onValueChange={(v) => setForm({ ...form, customer_id: v })}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Pilih customer"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Akun Pendapatan</label>
              <SearchableSelect
                value={form.income_account_id}
                onValueChange={(v) => setForm({ ...form, income_account_id: v })}
                options={getRevenueAccounts().map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                placeholder="Pilih akun pendapatan"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Akun Kas/Bank (Diterima ke)</label>
              <SearchableSelect
                value={form.cash_account_id}
                onValueChange={(v) => setForm({ ...form, cash_account_id: v })}
                options={getCashBankAccounts().map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                placeholder="Pilih akun kas"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Jumlah</label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Pajak</label>
              <Input type="number" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Reference</label>
              <Input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Catatan</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-semibold">Total: {formatCurrency(total)}</span>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Receipts;