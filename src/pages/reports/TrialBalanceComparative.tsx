import React, { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';

const TrialBalanceComparative: React.FC = () => {
  const { selectedCompany } = useCompany();
  const today = new Date().toISOString().slice(0, 10);
  const [periodA, setPeriodA] = useState({ from: today.slice(0, 8) + '01', to: today });
  const [periodB, setPeriodB] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return { from: d.toISOString().slice(0, 8) + '01', to: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) };
  });
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { if (selectedCompany) void load(); /* eslint-disable-next-line */ }, [selectedCompany?.id, periodA, periodB]);

  const load = async () => {
    if (!selectedCompany) return;
    const coa: any = await supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('company_id', selectedCompany.id).order('code');
    const accIds = (coa.data || []).map((a: any) => a.id);
    if (!accIds.length) { setData([]); return; }

    const fetchPeriod = async (from: string, to: string) => {
      const q: any = supabase.from('journal_entry_lines');
      const { data: lines } = await q
        .select('account_id, debit, credit, entry:journal_entries!inner(entry_date, company_id)')
        .in('account_id', accIds)
        .gte('entry.entry_date', from).lte('entry.entry_date', to);
      const m: Record<string, { d: number; c: number }> = {};
      (lines || []).forEach((l: any) => {
        if (!m[l.account_id]) m[l.account_id] = { d: 0, c: 0 };
        m[l.account_id].d += Number(l.debit || 0);
        m[l.account_id].c += Number(l.credit || 0);
      });
      return m;
    };
    const [a, b] = await Promise.all([fetchPeriod(periodA.from, periodA.to), fetchPeriod(periodB.from, periodB.to)]);
    const merged = (coa.data || []).map((acc: any) => ({
      ...acc,
      a_debit: a[acc.id]?.d || 0, a_credit: a[acc.id]?.c || 0,
      b_debit: b[acc.id]?.d || 0, b_credit: b[acc.id]?.c || 0,
    })).filter((r: any) => r.a_debit || r.a_credit || r.b_debit || r.b_credit);
    setData(merged);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2"><Scale className="w-7 h-7" />Neraca Saldo Komparatif</h1>
        <p className="text-muted-foreground mt-1">Bandingkan saldo akun antar dua periode.</p>
      </div>
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><Label>Periode A — Dari</Label><Input type="date" value={periodA.from} onChange={e => setPeriodA({ ...periodA, from: e.target.value })} /></div>
        <div><Label>Periode A — Sampai</Label><Input type="date" value={periodA.to} onChange={e => setPeriodA({ ...periodA, to: e.target.value })} /></div>
        <div><Label>Periode B — Dari</Label><Input type="date" value={periodB.from} onChange={e => setPeriodB({ ...periodB, from: e.target.value })} /></div>
        <div><Label>Periode B — Sampai</Label><Input type="date" value={periodB.to} onChange={e => setPeriodB({ ...periodB, to: e.target.value })} /></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Perbandingan</CardTitle></CardHeader><CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Kode</TableHead><TableHead>Akun</TableHead>
            <TableHead className="text-right">A Debit</TableHead><TableHead className="text-right">A Kredit</TableHead>
            <TableHead className="text-right">B Debit</TableHead><TableHead className="text-right">B Kredit</TableHead>
            <TableHead className="text-right">Selisih</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map(r => {
              const aNet = r.a_debit - r.a_credit; const bNet = r.b_debit - r.b_credit;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.code}</TableCell><TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.a_debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.a_credit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.b_debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.b_credit)}</TableCell>
                  <TableCell className={`text-right font-semibold ${aNet - bNet > 0 ? 'text-green-600' : aNet - bNet < 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(aNet - bNet)}
                  </TableCell>
                </TableRow>
              );
            })}
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};
export default TrialBalanceComparative;