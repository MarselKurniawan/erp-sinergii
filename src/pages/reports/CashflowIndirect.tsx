import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';

const CashflowIndirect: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 8) + '01'; });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState({ netIncome: 0, depreciation: 0, arChange: 0, apChange: 0, invChange: 0, operating: 0, investing: 0, financing: 0, net: 0 });

  useEffect(() => { if (selectedCompany) void load(); /* eslint-disable-next-line */ }, [selectedCompany?.id, from, to]);

  const load = async () => {
    if (!selectedCompany) return;
    const coa: any = await supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('company_id', selectedCompany.id);
    const accs = coa.data || [];
    const accById: any = Object.fromEntries(accs.map((a: any) => [a.id, a]));

    const q: any = supabase.from('journal_entry_lines');
    const { data: lines } = await q
      .select('account_id, debit, credit, entry:journal_entries!inner(entry_date, company_id)')
      .gte('entry.entry_date', from).lte('entry.entry_date', to);

    let revenue = 0, expense = 0, depr = 0, ar = 0, ap = 0, inv = 0, investing = 0, financing = 0;
    (lines || []).forEach((l: any) => {
      const a = accById[l.account_id]; if (!a) return;
      const d = Number(l.debit || 0); const c = Number(l.credit || 0);
      if (a.account_type === 'revenue') revenue += (c - d);
      else if (a.account_type === 'expense') expense += (d - c);
      const nm = (a.name || '').toLowerCase();
      if (nm.includes('depresiasi') || nm.includes('depreciation') || nm.includes('penyusutan')) depr += (d - c);
      if (nm.includes('piutang') || nm.includes('receivable')) ar += (d - c);
      if (nm.includes('hutang') || nm.includes('payable')) ap += (c - d);
      if (nm.includes('inventory') || nm.includes('persediaan')) inv += (d - c);
      if ((a.code || '').startsWith('1-15') || (a.code || '').startsWith('1-16')) investing += (c - d);
      if ((a.code || '').startsWith('3-') || a.account_type === 'equity') financing += (c - d);
    });
    const netIncome = revenue - expense;
    const operating = netIncome + depr - ar + ap - inv;
    const net = operating + investing + financing;
    setData({ netIncome, depreciation: depr, arChange: -ar, apChange: ap, invChange: -inv, operating, investing, financing, net });
  };

  const Row = ({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) => (
    <div className={`flex justify-between py-2 border-b ${bold ? 'font-bold border-t-2' : ''}`}>
      <span>{label}</span><span className={value < 0 ? 'text-red-600' : ''}>{formatCurrency(value)}</span>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2"><TrendingUp className="w-7 h-7" />Laporan Arus Kas (Tidak Langsung)</h1>
        <p className="text-muted-foreground mt-1">Mulai dari laba bersih, sesuaikan perubahan modal kerja.</p>
      </div>
      <Card><CardContent className="p-4 grid grid-cols-2 gap-3">
        <div><Label>Dari</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>Sampai</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Arus Kas Operasi</CardTitle></CardHeader>
        <CardContent>
          <Row label="Laba Bersih" value={data.netIncome} />
          <Row label="(+) Depresiasi & Amortisasi" value={data.depreciation} />
          <Row label="(−) Kenaikan Piutang" value={data.arChange} />
          <Row label="(+) Kenaikan Hutang Usaha" value={data.apChange} />
          <Row label="(−) Kenaikan Persediaan" value={data.invChange} />
          <Row label="Arus Kas Operasi" value={data.operating} bold />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Arus Kas Investasi & Pendanaan</CardTitle></CardHeader>
        <CardContent>
          <Row label="Arus Kas Investasi" value={data.investing} />
          <Row label="Arus Kas Pendanaan" value={data.financing} />
          <Row label="Kenaikan / (Penurunan) Kas Bersih" value={data.net} bold />
        </CardContent>
      </Card>
    </div>
  );
};
export default CashflowIndirect;