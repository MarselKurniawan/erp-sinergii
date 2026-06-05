import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProducts } from '@/hooks/useProducts';
import { formatDate } from '@/lib/formatters';
import { Package, Search } from 'lucide-react';

interface Movement {
  id: string;
  movement_date: string;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  balance_after: number | null;
  reference_type: string | null;
  reference_number: string | null;
  notes: string | null;
  product_id: string;
  warehouse_id: string | null;
  products?: { name: string; sku: string; unit: string };
  warehouses?: { name: string };
}

const typeLabel: Record<string, { label: string; tone: string }> = {
  in: { label: 'Masuk', tone: 'bg-success/10 text-success' },
  out: { label: 'Keluar', tone: 'bg-destructive/10 text-destructive' },
  transfer_in: { label: 'Transfer Masuk', tone: 'bg-primary/10 text-primary' },
  transfer_out: { label: 'Transfer Keluar', tone: 'bg-warning/10 text-warning' },
  adjustment: { label: 'Penyesuaian', tone: 'bg-muted text-foreground' },
  opening: { label: 'Saldo Awal', tone: 'bg-secondary text-secondary-foreground' },
};

export default function StockCard() {
  const { selectedCompany } = useCompany();
  const { products } = useProducts();
  const [productId, setProductId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCompany) return;
    setLoading(true);
    let query = supabase
      .from('inventory_movements')
      .select('*, products(name, sku, unit), warehouses(name)')
      .eq('company_id', selectedCompany.id)
      .gte('movement_date', fromDate)
      .lte('movement_date', toDate)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (productId) query = query.eq('product_id', productId);
    query.then(({ data }) => {
      setRows((data as any) || []);
      setLoading(false);
    });
  }, [selectedCompany, productId, fromDate, toDate]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.products?.name?.toLowerCase().includes(s) ||
        r.products?.sku?.toLowerCase().includes(s) ||
        r.reference_number?.toLowerCase().includes(s),
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    let inQty = 0, outQty = 0;
    for (const r of filtered) {
      if (r.movement_type === 'in' || r.movement_type === 'transfer_in' || r.movement_type === 'opening') {
        inQty += Number(r.quantity);
      } else if (r.movement_type === 'out' || r.movement_type === 'transfer_out') {
        outQty += Math.abs(Number(r.quantity));
      } else if (r.movement_type === 'adjustment') {
        if (Number(r.quantity) > 0) inQty += Number(r.quantity);
        else outQty += Math.abs(Number(r.quantity));
      }
    }
    return { inQty, outQty, net: inQty - outQty, count: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Kartu Stok</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat mutasi stok lengkap (masuk, keluar, transfer, penyesuaian).
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="form-label">Produk</label>
            <SearchableSelect
              options={[
                { value: '', label: 'Semua Produk' },
                ...products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` })),
              ]}
              value={productId}
              onValueChange={setProductId}
              placeholder="Pilih produk"
            />
          </div>
          <div>
            <label className="form-label">Dari Tanggal</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Sampai Tanggal</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nama produk, SKU, atau nomor referensi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Mutasi</div><div className="text-2xl font-bold">{summary.count}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Masuk</div><div className="text-2xl font-bold text-success">{summary.inQty.toLocaleString('id-ID')}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Keluar</div><div className="text-2xl font-bold text-destructive">{summary.outQty.toLocaleString('id-ID')}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Net</div><div className="text-2xl font-bold">{summary.net.toLocaleString('id-ID')}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Detail Mutasi</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">Gudang</th>
                  <th className="px-3 py-2">Tipe</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2">Referensi</th>
                  <th className="px-3 py-2">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Memuat...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada mutasi pada periode ini</td></tr>
                ) : (
                  filtered.map((r) => {
                    const t = typeLabel[r.movement_type] || { label: r.movement_type, tone: 'bg-muted' };
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2">{formatDate(r.movement_date)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{r.products?.name || '-'}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.products?.sku}</div>
                        </td>
                        <td className="px-3 py-2">{r.warehouses?.name || '-'}</td>
                        <td className="px-3 py-2"><Badge className={t.tone}>{t.label}</Badge></td>
                        <td className="px-3 py-2 text-right font-mono">
                          {Number(r.quantity).toLocaleString('id-ID')} {r.products?.unit}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r.balance_after != null ? Number(r.balance_after).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.reference_number || '-'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
