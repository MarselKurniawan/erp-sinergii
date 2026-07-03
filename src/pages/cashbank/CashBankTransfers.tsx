import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Search, ArrowLeftRight } from 'lucide-react';
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
import { generateDocumentNumber } from '@/lib/documentNumber';

interface Row {
  id: string;
  transfer_number: string;
  transfer_date: string;
  amount: number;
  fee_amount: number;
  notes: string | null;
  from_account?: { code: string; name: string } | null;
  to_account?: { code: string; name: string } | null;
}

const CashBankTransfers: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getCashBankAccounts, getExpenseAccounts } = useAccounts();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const empty = {
    transfer_date: new Date().toISOString().slice(0, 10),
    from_account_id: '',
    to_account_id: '',
    amount: '',
    fee_amount: '0',
    fee_account_id: '',
    notes: '',
  };
  const [form, setForm] = useState(empty);

  const fetch = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('cash_bank_transfers')
      .select('*, from_account:chart_of_accounts!cash_bank_transfers_from_account_id_fkey(code,name), to_account:chart_of_accounts!cash_bank_transfers_to_account_id_fkey(code,name)')
      .eq('company_id', selectedCompany.id)
      .is('voided_at', null)
      .order('transfer_date', { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, [selectedCompany]);
  useEffect(() => {
    if (params.get('new') === '1' || location.pathname.endsWith('/new')) {
      setOpen(true);
      if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    }
  }, [params, location.pathname]);

  const amt = parseFloat(form.amount || '0') || 0;
  const fee = parseFloat(form.fee_amount || '0') || 0;

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    if (!form.from_account_id || !form.to_account_id || !amt) { toast.error('Lengkapi dari, ke, dan jumlah'); return; }
    if (form.from_account_id === form.to_account_id) { toast.error('Akun asal & tujuan harus berbeda'); return; }
    if (fee > 0 && !form.fee_account_id) { toast.error('Pilih akun biaya admin'); return; }
    setSubmitting(true);
    try {
      const transfer_number = await generateDocumentNumber(selectedCompany.id, 'JE');
      const { data: je, error: jeErr } = await supabase
        .from('journal_entries')
        .insert({
          company_id: selectedCompany.id,
          entry_number: transfer_number,
          entry_date: form.transfer_date,
          description: `Transfer kas/bank ${form.notes || ''}`.trim(),
          is_posted: true,
          reference_type: 'cash_bank_transfer',
          created_by: user.id,
        })
        .select().single();
      if (jeErr) throw jeErr;
      const lines: any[] = [
        { journal_entry_id: je.id, account_id: form.to_account_id, debit_amount: amt, credit_amount: 0 },
        { journal_entry_id: je.id, account_id: form.from_account_id, debit_amount: 0, credit_amount: amt + fee },
      ];
      if (fee > 0) lines.splice(1, 0, { journal_entry_id: je.id, account_id: form.fee_account_id, debit_amount: fee, credit_amount: 0 });
      const { error: lErr } = await supabase.from('journal_entry_lines').insert(lines);
      if (lErr) throw lErr;
      const { error } = await supabase.from('cash_bank_transfers').insert({
        company_id: selectedCompany.id,
        transfer_number,
        transfer_date: form.transfer_date,
        from_account_id: form.from_account_id,
        to_account_id: form.to_account_id,
        amount: amt,
        fee_amount: fee,
        fee_account_id: form.fee_account_id || null,
        notes: form.notes || null,
        journal_entry_id: je.id,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success('Transfer tersimpan');
      setForm(empty); setOpen(false); fetch();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan'); }
    finally { setSubmitting(false); }
  };

  const cashAccs = getCashBankAccounts();
  const expAccs = getExpenseAccounts();
  const filtered = rows.filter(r => !search || r.transfer_number.toLowerCase().includes(search.toLowerCase()) || (r.notes || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowLeftRight className="w-6 h-6" /> Cash/Bank Transfers</h1>
          <p className="text-muted-foreground">Transfer antar akun kas/bank</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Transfer</Button>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>No.</TableHead><TableHead>Tanggal</TableHead><TableHead>Dari</TableHead><TableHead>Ke</TableHead>
              <TableHead className="text-right">Jumlah</TableHead><TableHead className="text-right">Biaya</TableHead><TableHead>Keterangan</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada transfer</TableCell></TableRow>
              : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.transfer_number}</TableCell>
                  <TableCell>{formatDate(r.transfer_date)}</TableCell>
                  <TableCell>{r.from_account ? `${r.from_account.code} ${r.from_account.name}` : '-'}</TableCell>
                  <TableCell>{r.to_account ? `${r.to_account.code} ${r.to_account.name}` : '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.fee_amount)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Cash/Bank Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Tanggal</label>
                <Input type="date" value={form.transfer_date} onChange={e => setForm({ ...form, transfer_date: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Jumlah *</label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Dari Akun *</label>
                <SearchableSelect value={form.from_account_id} onChange={v => setForm({ ...form, from_account_id: v })}
                  options={cashAccs.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))} placeholder="Pilih akun asal" /></div>
              <div><label className="text-sm font-medium">Ke Akun *</label>
                <SearchableSelect value={form.to_account_id} onChange={v => setForm({ ...form, to_account_id: v })}
                  options={cashAccs.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))} placeholder="Pilih akun tujuan" /></div>
              <div><label className="text-sm font-medium">Biaya Admin</label>
                <Input type="number" value={form.fee_amount} onChange={e => setForm({ ...form, fee_amount: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Akun Biaya Admin</label>
                <SearchableSelect value={form.fee_account_id} onChange={v => setForm({ ...form, fee_account_id: v })}
                  options={expAccs.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))} placeholder="Pilih akun beban" /></div>
            </div>
            <div><label className="text-sm font-medium">Keterangan</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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

export default CashBankTransfers;