import React, { useEffect, useState } from 'react';
import { Plus, Wand2, Upload, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

const BankReconciliation: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [statements, setStatements] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [form, setForm] = useState({ account_id: '', period_start: '', period_end: '', opening: '0', closing: '0' });
  const [csv, setCsv] = useState('');

  useEffect(() => {
    if (!selectedCompany) return;
    void load();
    // eslint-disable-next-line
  }, [selectedCompany?.id]);

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const [s, a] = await Promise.all([
      supabase.from('bank_statements').select('*, account:chart_of_accounts(code, name)').eq('company_id', selectedCompany.id).order('period_end', { ascending: false }),
      supabase.from('chart_of_accounts').select('id, code, name').eq('company_id', selectedCompany.id).in('account_type', ['asset']).ilike('name', '%bank%'),
    ]);
    setStatements(s.data || []);
    setAccounts(a.data || []);
    setLoading(false);
  };

  const create = async () => {
    if (!selectedCompany || !form.account_id || !form.period_start || !form.period_end) {
      toast.error('Lengkapi data'); return;
    }
    const num = `BS-${Date.now()}`;
    const { data, error } = await supabase.from('bank_statements').insert({
      company_id: selectedCompany.id, account_id: form.account_id, statement_number: num,
      period_start: form.period_start, period_end: form.period_end,
      opening_balance: Number(form.opening), closing_balance: Number(form.closing), status: 'draft',
    }).select().single();
    if (error) { toast.error(error.message); return; }

    // parse CSV: date,description,ref,debit,credit
    if (csv.trim()) {
      const rows = csv.trim().split('\n').slice(1).map(line => {
        const [d, desc, ref, dr, cr] = line.split(',').map(s => s.trim());
        return { statement_id: data.id, txn_date: d, description: desc, ref_number: ref, debit: Number(dr || 0), credit: Number(cr || 0) };
      });
      if (rows.length) await supabase.from('bank_statement_lines').insert(rows);
    }
    toast.success('Bank statement dibuat');
    setOpen(false); setForm({ account_id: '', period_start: '', period_end: '', opening: '0', closing: '0' }); setCsv('');
    void load();
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    const { data } = await supabase.from('bank_statement_lines').select('*, payment:payments(payment_number, amount)').eq('statement_id', id).order('txn_date');
    setLines(data || []);
  };

  const autoMatch = async () => {
    if (!detailId) return;
    const { data, error } = await supabase.rpc('auto_match_bank_lines', { p_statement_id: detailId });
    if (error) { toast.error(error.message); return; }
    toast.success(`${data} baris berhasil di-match`);
    void openDetail(detailId);
  };

  const finalize = async () => {
    if (!detailId) return;
    await supabase.from('bank_statements').update({ status: 'finalized' }).eq('id', detailId);
    toast.success('Rekonsiliasi difinalisasi');
    setDetailId(null); void load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Rekonsiliasi Bank</h1>
          <p className="text-muted-foreground mt-1">Cocokkan rekening koran bank dengan pembayaran di sistem.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Statement Baru</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Bank Statement</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8">Memuat...</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>No</TableHead><TableHead>Akun</TableHead><TableHead>Periode</TableHead>
                <TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Closing</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {statements.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.statement_number}</TableCell>
                    <TableCell>{s.account?.code} - {s.account?.name}</TableCell>
                    <TableCell>{s.period_start} → {s.period_end}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.opening_balance)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.closing_balance)}</TableCell>
                    <TableCell><Badge variant={s.status === 'finalized' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => openDetail(s.id)}>Detail</Button></TableCell>
                  </TableRow>
                ))}
                {statements.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada statement</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Statement Baru</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Akun Bank</Label>
              <SearchableSelect value={form.account_id} onChange={(v) => setForm({ ...form, account_id: v })}
                options={accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                placeholder="Pilih akun bank" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Periode Mulai</Label><Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} /></div>
              <div><Label>Periode Akhir</Label><Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} /></div>
              <div><Label>Saldo Awal</Label><Input type="number" value={form.opening} onChange={e => setForm({ ...form, opening: e.target.value })} /></div>
              <div><Label>Saldo Akhir</Label><Input type="number" value={form.closing} onChange={e => setForm({ ...form, closing: e.target.value })} /></div>
            </div>
            <div>
              <Label>Import CSV (header: date,description,ref,debit,credit)</Label>
              <textarea className="w-full border rounded p-2 text-sm font-mono" rows={6}
                placeholder="date,description,ref,debit,credit&#10;2026-06-01,Transfer ABC,REF001,0,1500000"
                value={csv} onChange={e => setCsv(e.target.value)} />
            </div>
            <Button onClick={create} className="w-full">Buat Statement</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detail Rekonsiliasi</DialogTitle></DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button onClick={autoMatch}><Wand2 className="w-4 h-4 mr-2" />Auto Match</Button>
            <Button onClick={finalize} variant="default">Finalisasi</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tanggal</TableHead><TableHead>Deskripsi</TableHead><TableHead>Ref</TableHead>
              <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
              <TableHead>Status</TableHead><TableHead>Match</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.txn_date}</TableCell>
                  <TableCell className="text-sm">{l.description}</TableCell>
                  <TableCell className="font-mono text-xs">{l.ref_number}</TableCell>
                  <TableCell className="text-right">{formatCurrency(l.debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(l.credit)}</TableCell>
                  <TableCell><Badge variant={l.match_status === 'matched' ? 'default' : 'secondary'}>{l.match_status}</Badge></TableCell>
                  <TableCell className="text-xs">{l.payment?.payment_number || '-'}</TableCell>
                </TableRow>
              ))}
              {lines.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada baris</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankReconciliation;