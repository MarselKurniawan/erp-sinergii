import React, { useEffect, useState } from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';

const FixPaymentMapping: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { getCashBankAccounts } = useAccounts();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const fetch = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('id, payment_number, payment_date, payment_type, amount, cash_account_id, notes')
      .eq('company_id', selectedCompany.id)
      .is('cash_account_id', null)
      .is('voided_at', null)
      .order('payment_date', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, [selectedCompany]);

  const cashAccs = getCashBankAccounts();

  const fixOne = async (id: string) => {
    const accId = mapping[id];
    if (!accId) { toast.error('Pilih akun terlebih dahulu'); return; }
    const { error } = await supabase.from('payments').update({ cash_account_id: accId }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Mapping diperbaiki'); fetch(); }
  };

  const fixAll = async () => {
    const updates = Object.entries(mapping).filter(([_, v]) => v);
    if (!updates.length) { toast.error('Tidak ada mapping'); return; }
    for (const [id, accId] of updates) {
      await supabase.from('payments').update({ cash_account_id: accId }).eq('id', id);
    }
    toast.success(`${updates.length} payment diperbaiki`);
    setMapping({}); fetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="w-6 h-6" /> Fix Payment Mapping</h1>
          <p className="text-muted-foreground">Perbaiki payment tanpa akun kas/bank</p>
        </div>
        <Button onClick={fixAll} disabled={!Object.keys(mapping).length}>Fix Semua Terpilih</Button>
      </div>
      <Card>
        <CardContent className="p-4">
          {!loading && rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-green-600" />
              Semua payment sudah ter-mapping dengan benar.
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>No.</TableHead><TableHead>Tanggal</TableHead><TableHead>Tipe</TableHead>
                <TableHead className="text-right">Jumlah</TableHead><TableHead>Akun Kas/Bank</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Loading…</TableCell></TableRow>
                : rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.payment_number}</TableCell>
                    <TableCell>{formatDate(r.payment_date)}</TableCell>
                    <TableCell>{r.payment_type}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="min-w-[260px]">
                      <SearchableSelect value={mapping[r.id] || ''} onChange={v => setMapping({ ...mapping, [r.id]: v })}
                        options={cashAccs.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))} placeholder="Pilih akun" />
                    </TableCell>
                    <TableCell><Button size="sm" onClick={() => fixOne(r.id)}>Fix</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FixPaymentMapping;