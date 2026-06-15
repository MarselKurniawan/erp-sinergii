import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatCurrency } from '@/lib/formatters';

const CustomerStatement: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    supabase.from('customers').select('id, name').eq('company_id', selectedCompany.id).then(({ data }) => setCustomers(data || []));
  }, [selectedCompany?.id]);

  useEffect(() => { if (customerId) void load(); /* eslint-disable-next-line */ }, [customerId, from, to]);

  const load = async () => {
    const q1: any = supabase.from('invoices');
    const inv: any = await q1.select('id, invoice_number, invoice_date, total_amount, paid_amount, outstanding_amount')
      .eq('customer_id', customerId).gte('invoice_date', from).lte('invoice_date', to).order('invoice_date');
    const q2: any = supabase.from('payments');
    const pay: any = await q2.select('id, payment_number, payment_date, amount, type')
      .eq('customer_id', customerId).eq('type', 'receipt').gte('payment_date', from).lte('payment_date', to).order('payment_date');

    const items: any[] = [];
    (inv.data || []).forEach((i: any) => items.push({ date: i.invoice_date, ref: i.invoice_number, desc: 'Invoice', debit: i.total_amount, credit: 0 }));
    (pay.data || []).forEach((p: any) => items.push({ date: p.payment_date, ref: p.payment_number, desc: 'Pembayaran', debit: 0, credit: p.amount }));
    items.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    items.forEach(it => { bal += (Number(it.debit || 0) - Number(it.credit || 0)); it.balance = bal; });
    setRows(items);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2"><Users className="w-7 h-7" />Mutasi Pelanggan</h1>
        <p className="text-muted-foreground mt-1">Riwayat invoice dan pembayaran per pelanggan.</p>
      </div>
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Pelanggan</Label>
            <SearchableSelect value={customerId} onChange={setCustomerId}
              options={customers.map(c => ({ value: c.id, label: c.name }))} placeholder="Pilih pelanggan" />
          </div>
          <div><Label>Dari</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Sampai</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Mutasi</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Referensi</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Kredit</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.date}</TableCell><TableCell className="font-mono text-xs">{r.ref}</TableCell>
                  <TableCell>{r.desc}</TableCell>
                  <TableCell className="text-right">{r.debit ? formatCurrency(r.debit) : '-'}</TableCell>
                  <TableCell className="text-right">{r.credit ? formatCurrency(r.credit) : '-'}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(r.balance)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Pilih pelanggan untuk melihat mutasi</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
export default CustomerStatement;