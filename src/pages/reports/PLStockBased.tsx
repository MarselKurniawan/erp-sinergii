import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';
import { formatCurrency } from '@/lib/formatters';
import { TrendingUp } from 'lucide-react';

export default function PLStockBased() {
  const { selectedCompany } = useCompany();
  const r = defaultRange();
  const [from, setFrom] = useState(r.from);
  const [to, setTo] = useState(r.to);
  const [data, setData] = useState({ revenue: 0, opening: 0, closing: 0, purchases: 0 });

  useEffect(() => {
    if (!selectedCompany) return;
    (async () => {
      const { data: invs } = await (supabase as any).from('invoices')
        .select('total_amount,tax_amount').eq('company_id', selectedCompany.id)
        .gte('invoice_date', from).lte('invoice_date', to).is('voided_at', null);
      const { data: bills } = await (supabase as any).from('bills')
        .select('total_amount,tax_amount').eq('company_id', selectedCompany.id)
        .gte('bill_date', from).lte('bill_date', to).is('voided_at', null);
      const { data: openMv } = await (supabase as any).from('inventory_movements')
        .select('quantity,unit_cost,movement_type').eq('company_id', selectedCompany.id).lt('movement_date', from);
      const { data: closeMv } = await (supabase as any).from('inventory_movements')
        .select('quantity,unit_cost,movement_type').eq('company_id', selectedCompany.id).lte('movement_date', to);
      const valueOf = (arr: any[]) => arr.reduce((s, m) => {
        const v = Number(m.quantity || 0) * Number(m.unit_cost || 0);
        return s + (['in','adjustment_in','transfer_in'].includes(m.movement_type) ? v : -v);
      }, 0);
      const revenue = (invs || []).reduce((s: number, i: any) => s + Number(i.total_amount || 0) - Number(i.tax_amount || 0), 0);
      const purchases = (bills || []).reduce((s: number, b: any) => s + Number(b.total_amount || 0) - Number(b.tax_amount || 0), 0);
      setData({ revenue, opening: Math.max(0, valueOf(openMv || [])), closing: Math.max(0, valueOf(closeMv || [])), purchases });
    })();
  }, [selectedCompany, from, to]);

  const cogs = data.opening + data.purchases - data.closing;
  const profit = data.revenue - cogs;

  return (
    <ReportShell title="P&L (Opening/Closing Stock)" icon={<TrendingUp />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b"><td className="py-2">Pendapatan</td><td className="text-right">{formatCurrency(data.revenue)}</td></tr>
          <tr><td className="py-2">Stok Awal</td><td className="text-right">{formatCurrency(data.opening)}</td></tr>
          <tr><td className="py-2">+ Pembelian</td><td className="text-right">{formatCurrency(data.purchases)}</td></tr>
          <tr><td className="py-2">- Stok Akhir</td><td className="text-right">({formatCurrency(data.closing)})</td></tr>
          <tr className="border-b border-t font-semibold"><td className="py-2">= COGS</td><td className="text-right">{formatCurrency(cogs)}</td></tr>
          <tr className="font-bold text-lg"><td className="py-2">Laba Kotor</td><td className="text-right">{formatCurrency(profit)}</td></tr>
        </tbody>
      </table>
    </ReportShell>
  );
}