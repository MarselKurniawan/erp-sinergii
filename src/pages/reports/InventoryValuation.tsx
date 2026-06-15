import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';

interface Row {
  product_id: string;
  product_name: string;
  sku: string | null;
  warehouse_name: string;
  quantity: number;
  average_cost: number;
  total_value: number;
}

const InventoryValuation: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [costingMethod, setCostingMethod] = useState<string>('average');

  useEffect(() => {
    if (!selectedCompany) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data: comp } = await supabase
      .from('companies').select('costing_method').eq('id', selectedCompany.id).single();
    setCostingMethod((comp as any)?.costing_method || 'average');

    const { data } = await supabase
      .from('inventory_stock')
      .select('quantity, average_cost, product:products(id, sku, name), warehouse:warehouses!inner(id, name, company_id)')
      .eq('warehouse.company_id', selectedCompany.id);

    const mapped: Row[] = ((data || []) as any[])
      .filter(r => r.product && r.warehouse)
      .map(r => ({
        product_id: r.product.id,
        product_name: r.product.name,
        sku: r.product.sku,
        warehouse_name: r.warehouse.name,
        quantity: Number(r.quantity || 0),
        average_cost: Number(r.average_cost || 0),
        total_value: Number(r.quantity || 0) * Number(r.average_cost || 0),
      }))
      .sort((a, b) => b.total_value - a.total_value);
    setRows(mapped);
    setLoading(false);
  };

  const totalValue = rows.reduce((s, r) => s + r.total_value, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2"><Package className="w-7 h-7" />Valuasi Inventory</h1>
        <p className="text-muted-foreground mt-1">Nilai stok per produk per gudang berdasarkan metode costing perusahaan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><Label>Metode Costing</Label><div className="text-xl font-bold uppercase">{costingMethod}</div></CardContent></Card>
        <Card><CardContent className="p-4"><Label>Total Item</Label><div className="text-xl font-bold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><Label>Total Nilai Inventory</Label><div className="text-xl font-bold text-primary">{formatCurrency(totalValue)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Detail Valuasi</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-muted-foreground">Memuat...</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>SKU</TableHead><TableHead>Produk</TableHead><TableHead>Gudang</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Avg Cost</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.sku || '-'}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell>{r.warehouse_name}</TableCell>
                    <TableCell className="text-right">{r.quantity.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.average_cost)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.total_value)}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada data stok</TableCell></TableRow>)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryValuation;