import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';
import { formatCurrency } from '@/lib/formatters';
import { TrendingUp } from 'lucide-react';

type Period = 'daily' | 'weekly' | 'monthly';

export default function PLPeriodicCOGS() {
  const { selectedCompany } = useCompany();
  const r = defaultRange();
  const [from, setFrom] = useState(r.from);
  const [to, setTo] = useState(r.to);
  const [period, setPeriod] = useState<Period>('monthly');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    (async () => {
      const { data: invs } = await (supabase as any).from('invoices')
        .select('invoice_date,total_amount,outstanding_amount,tax_amount')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_date', from).lte('invoice_date', to).is('voided_at', null);
      const { data: mv } = await (supabase as any).from('inventory_movements')
        .select('movement_date,quantity,unit_cost,movement_type')
        .eq('company_id', selectedCompany.id)
        .gte('movement_date', from).lte('movement_date', to)
        .in('movement_type', ['out']);
      const bucket: Record<string, { rev: number; cogs: number }> = {};
      const key = (d: string) => {
        const dt = new Date(d);
        if (period === 'daily') return d;
        if (period === 'weekly') { const f = new Date(dt); f.setDate(dt.getDate() - dt.getDay()); return f.toISOString().slice(0,10); }
        return d.slice(0,7);
      };
      (invs || []).forEach((i: any) => { const k = key(i.invoice_date); bucket[k] = bucket[k] || { rev: 0, cogs: 0 }; bucket[k].rev += Number(i.total_amount || 0) - Number(i.tax_amount || 0); });
      (mv || []).forEach((m: any) => { const k = key(m.movement_date); bucket[k] = bucket[k] || { rev: 0, cogs: 0 }; bucket[k].cogs += Number(m.quantity || 0) * Number(m.unit_cost || 0); });
      setRows(Object.entries(bucket).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => ({ period: k, ...v, profit: v.rev - v.cogs })));
    })();
  }, [selectedCompany, from, to, period]);

  return (
    <ReportShell title="P&L Periodik (COGS)" icon={<TrendingUp />} from={from} to={to} setFrom={setFrom} setTo={setTo}
      extra={<div><label className="text-sm">Periode</label><select className="w-full border rounded p-2" value={period} onChange={(e)=>setPeriod(e.target.value as Period)}><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option></select></div>}>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Periode</th><th className="text-right">Pendapatan</th><th className="text-right">COGS</th><th className="text-right">Laba Kotor</th></tr></thead>
        <tbody>{rows.map(r => (<tr key={r.period} className="border-b"><td className="py-2">{r.period}</td><td className="text-right">{formatCurrency(r.rev)}</td><td className="text-right">{formatCurrency(r.cogs)}</td><td className="text-right font-semibold">{formatCurrency(r.profit)}</td></tr>))}</tbody>
      </table>
    </ReportShell>
  );
}