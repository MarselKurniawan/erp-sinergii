import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';
import { formatCurrency } from '@/lib/formatters';
import { Users } from 'lucide-react';

export default function PLByClient() {
  const { selectedCompany } = useCompany();
  const r = defaultRange();
  const [from, setFrom] = useState(r.from); const [to, setTo] = useState(r.to);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    (async () => {
      const { data: invs } = await (supabase as any).from('invoices')
        .select('customer_id,total_amount,tax_amount,customer:customers(name),items:invoice_items(quantity,product_id)')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_date', from).lte('invoice_date', to).is('voided_at', null);
      const { data: prods } = await (supabase as any).from('products').select('id,cost_price').eq('company_id', selectedCompany.id);
      const costMap = Object.fromEntries((prods || []).map((p: any) => [p.id, Number(p.cost_price || 0)]));
      const map: Record<string, { name: string; rev: number; cogs: number; count: number }> = {};
      (invs || []).forEach((i: any) => {
        const k = i.customer_id || 'none';
        map[k] = map[k] || { name: i.customer?.name || 'Tanpa Customer', rev: 0, cogs: 0, count: 0 };
        map[k].rev += Number(i.total_amount || 0) - Number(i.tax_amount || 0);
        map[k].cogs += (i.items || []).reduce((s: number, x: any) => s + Number(x.quantity || 0) * (costMap[x.product_id] || 0), 0);
        map[k].count += 1;
      });
      setRows(Object.values(map).map(v => ({ ...v, profit: v.rev - v.cogs })).sort((a,b) => b.profit - a.profit));
    })();
  }, [selectedCompany, from, to]);

  return (
    <ReportShell title="P&L per Customer" icon={<Users />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Customer</th><th className="text-right">Invoice</th><th className="text-right">Pendapatan</th><th className="text-right">COGS</th><th className="text-right">Laba</th></tr></thead>
        <tbody>{rows.map((r,i) => (<tr key={i} className="border-b"><td className="py-2">{r.name}</td><td className="text-right">{r.count}</td><td className="text-right">{formatCurrency(r.rev)}</td><td className="text-right">{formatCurrency(r.cogs)}</td><td className="text-right font-semibold">{formatCurrency(r.profit)}</td></tr>))}</tbody>
      </table>
    </ReportShell>
  );
}