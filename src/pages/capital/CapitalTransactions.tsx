import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Search, Landmark } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface Row {
  id: string; transaction_number: string; transaction_date: string;
  transaction_type: 'injection' | 'withdrawal';
  owner_name: string | null; amount: number; notes: string | null;
  equity_account?: { code: string; name: string } | null;
  cash_account?: { code: string; name: string } | null;
}

const CapitalTransactions: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { accounts, getCashBankAccounts } = useAccounts();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const equityAccounts = useMemo(() => accounts.filter(a => a.account_type === 'equity'), [accounts]);

  const empty = {
    transaction_date: new Date().toISOString().slice(0, 10),
    transaction_type: 'injection' as 'injection' | 'withdrawal',
    owner_name: '',
    equity_account_id: '',
    cash_account_id: '',
    amount: '',
    notes: '',
  };
  const [form, setForm] = useState(empty);

  const fetchRows = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('capital_transactions')
      .select('*, equity_account:chart_of_accounts!capital_transactions_equity_account_id_fkey(code,name), cash_account:chart_of_accounts!capital_transactions_cash_account_id_fkey(code,name)')
      .eq('company_id', selectedCompany.id)
      .is('voided_at', null)
      .order('transaction_date', { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, [selectedCompany]);
  useEffect(() => {
    if (params.get('new') === '1' || location.pathname.endsWith('/new')) {
      setOpen(true);
      if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    }
  }, [params, location.pathname]);

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    if (!form.equity_account_id || !form.cash_account_id || !form.amount) {
      toast.error('Lengkapi akun ekuitas, akun kas, dan jumlah'); return;
    }
    setSubmitting(true);
    try {
      const { data: numData } = await supabase.rpc('generate_document_number', {
        p_company_id: selectedCompany.id, p_document_type: 'CAP',
      });
      const tx_num = (numData as string) || `CAP-${Date.now()}`;
      const amt = parseFloat(form.amount);

      const { data: je, error: jeErr } = await supabase.from('journal_entries').insert({
        company_id: selectedCompany.id,
        entry_number: tx_num,
        entry_date: form.transaction_date,
        description: `Capital ${form.transaction_type} ${tx_num}`,
        status: 'posted', created_by: user.id,
      }).select().single();
      if (jeErr) throw jeErr;

      // Injection: Cash DR, Equity CR  | Withdrawal: Equity DR, Cash CR
      const lines = form.transaction_type === 'injection' ? [
        { journal_entry_id: je.id, account_id: form.cash_account_id, debit: amt, credit: 0 },
        { journal_entry_id: je.id, account_id: form.equity_account_id, debit: 0, credit: amt },
      ] : [
        { journal_entry_id: je.id, account_id: form.equity_account_id, debit: amt, credit: 0 },
        { journal_entry_id: je.id, account_id: form.cash_account_id, debit: 0, credit: amt },
      ];
      await supabase.from('journal_entry_lines').insert(lines as any);

      const { error } = await supabase.from('capital_transactions').insert({
        company_id: selectedCompany.id,
        transaction_number: tx_num,
        transaction_date: form.transaction_date,
        transaction_type: form.transaction_type,
        owner_name: form.owner_name || null,
        equity_account_id: form.equity_account_id,
        cash_account_id: form.cash_account_id,
        amount: amt, notes: form.notes || null,
        journal_entry_id: je.id, created_by: user.id,
      } as any);
      if (error) throw error;

      toast.success('Capital transaction tersimpan');
      setOpen(false); setForm(empty); fetchRows();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan'); }
    finally { setSubmitting(false); }
  };

  const filtered = rows.filter(r =>
    r.transaction_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.owner_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="h-6 w-6" /> Capital Transactions</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Transaction</Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari nomor / owner..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tanggal</TableHead><TableHead>No</TableHead><TableHead>Tipe</TableHead>
            <TableHead>Owner</TableHead><TableHead>Akun Ekuitas</TableHead>
            <TableHead>Akun Kas</TableHead><TableHead className="text-right">Jumlah</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (<TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>)
              : filtered.length === 0 ? (<TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada data</TableCell></TableRow>)
              : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.transaction_date)}</TableCell>
                  <TableCell className="font-mono">{r.transaction_number}</TableCell>
                  <TableCell>
                    <Badge variant={r.transaction_type === 'injection' ? 'default' : 'secondary'}>
                      {r.transaction_type === 'injection' ? 'Injection' : 'Withdrawal'}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.owner_name || '-'}</TableCell>
                  <TableCell>{r.equity_account ? `${r.equity_account.code} - ${r.equity_account.name}` : '-'}</TableCell>
                  <TableCell>{r.cash_account ? `${r.cash_account.code} - ${r.cash_account.name}` : '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Capital Transaction</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Tanggal</label>
              <Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Tipe</label>
              <Select value={form.transaction_type} onValueChange={(v: any) => setForm({ ...form, transaction_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="injection">Injection (Setoran Modal)</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal (Prive)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Nama Owner</label>
              <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Akun Ekuitas</label>
              <SearchableSelect
                value={form.equity_account_id}
                onChange={(v) => setForm({ ...form, equity_account_id: v })}
                options={equityAccounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                placeholder="Pilih akun ekuitas"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Akun Kas/Bank</label>
              <SearchableSelect
                value={form.cash_account_id}
                onChange={(v) => setForm({ ...form, cash_account_id: v })}
                options={getCashBankAccounts().map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                placeholder="Pilih akun kas"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Jumlah</label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Catatan</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end pt-2 border-t">
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CapitalTransactions;