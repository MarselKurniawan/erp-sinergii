import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';

const ProductPurchaseReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const def = defaultRange();
  const [from, setFrom] = useState(def.from); const [to, setTo] = useState(def.to);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (!selectedCompany) return; (async () => {
    const bills = await supabase.from('bills').select('id').eq('company_id', selectedCompany.id).is('voided_at', null).gte('bill_date', from).lte('bill_date', to);
    const ids = (bills.data || []).map((b: any) => b.id);
    if (ids.length === 0) { setRows([]); return; }
    const items = await supabase.from('bill_items').select('product_id, quantity, total, products(name, sku)').in('bill_id', ids);
    const map: Record<string, any> = {};
    (items.data || []).forEach((it: any) => {
      const k = it.product_id || 'none';
      map[k] = map[k] || { name: it.products?.name || '-', sku: it.products?.sku || '', qty: 0, total: 0 };
      map[k].qty += Number(it.quantity || 0); map[k].total += Number(it.total || 0);
    });
    setRows(Object.values(map).sort((a: any, b: any) => b.total - a.total));
  })(); }, [selectedCompany, from, to]);
  return (
    <ReportShell title="Product Purchase Report" icon={<Package className="h-6 w-6" />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <Table>
        <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Produk</TableHead><TableHead className="text-right">Qty Dibeli</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            : rows.map((r, i) => <TableRow key={i}><TableCell className="font-mono">{r.sku}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{formatNumber(r.qty)}</TableCell><TableCell className="text-right">{formatCurrency(r.total)}</TableCell></TableRow>)}
        </TableBody>
      </Table>
    </ReportShell>
  );
};
export default ProductPurchaseReport;