import React, { useEffect, useState } from 'react';
import { Building2, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';

const ExecutiveDashboard: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data: comps } = await supabase.from('companies').select('id, name, code');
    const out: any[] = [];
    for (const c of comps || []) {
      const inv: any = await supabase.from('invoices').select('total_amount, outstanding_amount').eq('company_id', c.id);
      const bill: any = await supabase.from('bills').select('total_amount, outstanding_amount').eq('company_id', c.id);
      const sQ: any = supabase.from('inventory_stock');
      const stock: any = await sQ.select('quantity, average_cost, warehouse:warehouses!inner(company_id)').eq('warehouse.company_id', c.id);
      const revenue = (inv.data || []).reduce((s: number, x: any) => s + Number(x.total_amount || 0), 0);
      const cost = (bill.data || []).reduce((s: number, x: any) => s + Number(x.total_amount || 0), 0);
      const ar = (inv.data || []).reduce((s: number, x: any) => s + Number(x.outstanding_amount || 0), 0);
      const ap = (bill.data || []).reduce((s: number, x: any) => s + Number(x.outstanding_amount || 0), 0);
      const stockValue = (stock.data || []).reduce((s: number, x: any) => s + Number(x.quantity || 0) * Number(x.average_cost || 0), 0);
      out.push({ ...c, revenue, cost, profit: revenue - cost, ar, ap, stockValue });
    }
    setRows(out);
    setLoading(false);
  };

  const total = rows.reduce((s, r) => ({
    revenue: s.revenue + r.revenue, profit: s.profit + r.profit,
    ar: s.ar + r.ar, ap: s.ap + r.ap, stockValue: s.stockValue + r.stockValue,
  }), { revenue: 0, profit: 0, ar: 0, ap: 0, stockValue: 0 });

  const KPI = ({ icon: Icon, label, value, color = '' }: any) => (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <Icon className={`w-8 h-8 ${color}`} />
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-bold">{formatCurrency(value)}</div></div>
    </CardContent></Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2"><Building2 className="w-7 h-7" />Executive Dashboard</h1>
        <p className="text-muted-foreground mt-1">Konsolidasi lintas perusahaan.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={TrendingUp} label="Total Revenue" value={total.revenue} color="text-green-600" />
        <KPI icon={DollarSign} label="Net Profit" value={total.profit} color="text-blue-600" />
        <KPI icon={Wallet} label="Outstanding AR" value={total.ar} color="text-amber-600" />
        <KPI icon={Wallet} label="Outstanding AP" value={total.ap} color="text-red-600" />
        <KPI icon={Building2} label="Nilai Stok" value={total.stockValue} color="text-purple-600" />
      </div>
      <Card>
        <CardHeader><CardTitle>Ringkasan per Perusahaan</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8">Memuat...</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Perusahaan</TableHead><TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead><TableHead className="text-right">AR</TableHead>
                <TableHead className="text-right">AP</TableHead><TableHead className="text-right">Stok</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.code} — {r.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className={`text-right ${r.profit < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(r.profit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.ar)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.ap)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.stockValue)}</TableCell>
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
export default ExecutiveDashboard;