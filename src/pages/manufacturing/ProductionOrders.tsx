import React, { useEffect, useState } from 'react';
import { Plus, Play, CheckCircle2, Factory } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

const ProductionOrders: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [form, setForm] = useState({ product_id: '', recipe_id: '', warehouse_id: '', planned_qty: '1' });
  const [actualQty, setActualQty] = useState('');

  useEffect(() => { if (selectedCompany) void load(); /* eslint-disable-next-line */ }, [selectedCompany?.id]);

  const load = async () => {
    if (!selectedCompany) return;
    const [o, p, r, w] = await Promise.all([
      supabase.from('production_orders').select('*, product:products(name), warehouse:warehouses(name)').eq('company_id', selectedCompany.id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, sku').eq('company_id', selectedCompany.id).eq('type', 'product'),
      supabase.from('recipes').select('id, name, product_id, items:recipe_items(material_id, quantity, material:products(name))').eq('company_id', selectedCompany.id),
      supabase.from('warehouses').select('id, name').eq('company_id', selectedCompany.id),
    ]);
    setOrders(o.data || []); setProducts(p.data || []); setRecipes(r.data || []); setWarehouses(w.data || []);
  };

  const create = async () => {
    if (!selectedCompany || !form.product_id || !form.warehouse_id || !form.recipe_id) {
      toast.error('Lengkapi data'); return;
    }
    const num = `PRO-${Date.now()}`;
    const { data, error } = await supabase.from('production_orders').insert({
      company_id: selectedCompany.id, order_number: num, product_id: form.product_id,
      recipe_id: form.recipe_id, warehouse_id: form.warehouse_id,
      planned_qty: Number(form.planned_qty), status: 'draft',
    }).select().single();
    if (error) { toast.error(error.message); return; }

    // snapshot recipe → materials
    const recipe = recipes.find(r => r.id === form.recipe_id);
    if (recipe?.items?.length) {
      const mats = recipe.items.map((it: any) => ({
        production_order_id: data.id, material_id: it.material_id,
        planned_qty: Number(it.quantity) * Number(form.planned_qty),
      }));
      await supabase.from('production_order_materials').insert(mats);
    }
    toast.success('Production order dibuat');
    setOpen(false); setForm({ product_id: '', recipe_id: '', warehouse_id: '', planned_qty: '1' });
    void load();
  };

  const openDetail = async (po: any) => {
    setDetail(po);
    const { data } = await supabase.from('production_order_materials').select('*, material:products(name, sku)').eq('production_order_id', po.id);
    setMaterials(data || []);
    setActualQty(po.planned_qty?.toString() || '');
  };

  const start = async () => {
    if (!detail) return;
    const { error } = await supabase.rpc('start_production', { p_order_id: detail.id });
    if (error) { toast.error(error.message); return; }
    toast.success('Produksi dimulai, material dikonsumsi');
    setDetail(null); void load();
  };

  const complete = async () => {
    if (!detail || !actualQty) return;
    const { error } = await supabase.rpc('complete_production', { p_order_id: detail.id, p_actual_qty: Number(actualQty) });
    if (error) { toast.error(error.message); return; }
    toast.success('Produksi selesai, barang jadi ditambahkan ke stok');
    setDetail(null); void load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-2"><Factory className="w-7 h-7" />Production Order</h1>
          <p className="text-muted-foreground mt-1">Konsumsi bahan baku, hasilkan produk jadi.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />PO Baru</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Production Order</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>No</TableHead><TableHead>Produk</TableHead><TableHead>Gudang</TableHead>
              <TableHead className="text-right">Plan</TableHead><TableHead className="text-right">Produced</TableHead>
              <TableHead className="text-right">Total Cost</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell>{o.product?.name}</TableCell>
                  <TableCell>{o.warehouse?.name}</TableCell>
                  <TableCell className="text-right">{o.planned_qty}</TableCell>
                  <TableCell className="text-right">{o.produced_qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.total_material_cost)}</TableCell>
                  <TableCell><Badge>{o.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => openDetail(o)}>Detail</Button></TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada production order</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Production Order Baru</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Produk Jadi</Label>
              <SearchableSelect value={form.product_id} onChange={(v) => setForm({ ...form, product_id: v })}
                options={products.map(p => ({ value: p.id, label: `${p.sku || ''} ${p.name}` }))} placeholder="Pilih produk" />
            </div>
            <div><Label>Resep / BOM</Label>
              <SearchableSelect value={form.recipe_id} onChange={(v) => setForm({ ...form, recipe_id: v })}
                options={recipes.filter(r => !form.product_id || r.product_id === form.product_id).map(r => ({ value: r.id, label: r.name }))} placeholder="Pilih resep" />
            </div>
            <div><Label>Gudang</Label>
              <SearchableSelect value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })}
                options={warehouses.map(w => ({ value: w.id, label: w.name }))} placeholder="Pilih gudang" />
            </div>
            <div><Label>Quantity Rencana</Label>
              <Input type="number" value={form.planned_qty} onChange={e => setForm({ ...form, planned_qty: e.target.value })} />
            </div>
            <Button onClick={create} className="w-full">Buat</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">Status: <Badge>{detail?.status}</Badge></div>
            <div>
              <div className="font-medium mb-2">Material yang Digunakan</div>
              <Table>
                <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Plan</TableHead><TableHead className="text-right">Consumed</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                <TableBody>
                  {materials.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{m.material?.name}</TableCell>
                      <TableCell className="text-right">{m.planned_qty}</TableCell>
                      <TableCell className="text-right">{m.consumed_qty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.total_cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {detail?.status === 'draft' && <Button onClick={start} className="w-full"><Play className="w-4 h-4 mr-2" />Mulai Produksi</Button>}
            {detail?.status === 'in_progress' && (
              <div className="space-y-2">
                <Label>Quantity Aktual Diproduksi</Label>
                <Input type="number" value={actualQty} onChange={e => setActualQty(e.target.value)} />
                <Button onClick={complete} className="w-full"><CheckCircle2 className="w-4 h-4 mr-2" />Selesaikan Produksi</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductionOrders;