import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';
import { formatCurrency } from '@/lib/formatters';
import { Package } from 'lucide-react';

export default function PLByProduct() {
  const { selectedCompany } = useCompany();
  const r = defaultRange();
  const [from, setFrom] = useState(r.from); const [to, setTo] = useState(r.to);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    (async () => {
      const { data: items } = await (supabase as any).from('invoice_items')
        .select('product_id,quantity,unit_price,total,invoice:invoices!inner(invoice_date,company_id,voided_at)')
        .eq('invoice.company_id', selectedCompany.id)
        .gte('invoice.invoice_date', from).lte('invoice.invoice_date', to);
      const { data: prods } = await (supabase as any).from('products').select('id,sku,name,cost_price').eq('company_id', selectedCompany.id);
      const map: Record<string, { sku: string; name: string; qty: number; rev: number; cogs: number }> = {};
      (items || []).filter((i: any) => !i.invoice?.voided_at).forEach((i: any) => {
        const p = prods?.find((x: any) => x.id === i.product_id);
        const k = i.product_id;
        map[k] = map[k] || { sku: p?.sku || '-', name: p?.name || '-', qty: 0, rev: 0, cogs: 0 };
        map[k].qty += Number(i.quantity || 0);
        map[k].rev += Number(i.total || 0);
        map[k].cogs += Number(i.quantity || 0) * Number(p?.cost_price || 0);
      });
      setRows(Object.values(map).map(v => ({ ...v, profit: v.rev - v.cogs })).sort((a,b) => b.profit - a.profit));
    })();
  }, [selectedCompany, from, to]);

  return (
    <ReportShell title="P&L per Produk" icon={<Package />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">SKU</th><th>Produk</th><th className="text-right">Qty</th><th className="text-right">Pendapatan</th><th className="text-right">COGS</th><th className="text-right">Laba</th></tr></thead>
        <tbody>{rows.map((r,i) => (<tr key={i} className="border-b"><td className="py-2 font-mono">{r.sku}</td><td>{r.name}</td><td className="text-right">{r.qty}</td><td className="text-right">{formatCurrency(r.rev)}</td><td className="text-right">{formatCurrency(r.cogs)}</td><td className="text-right font-semibold">{formatCurrency(r.profit)}</td></tr>))}</tbody>
      </table>
    </ReportShell>
  );
}