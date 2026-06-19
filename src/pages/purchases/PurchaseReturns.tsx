import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Undo2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { useWarehouses } from '@/hooks/useWarehouses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface Item { product_id: string; quantity: string; unit_price: string; tax_percent: string; }

const PurchaseReturns: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { suppliers } = useSuppliers();
  const { products } = useProducts();
  const { warehouses } = useWarehouses();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const empty = {
    return_date: new Date().toISOString().slice(0, 10),
    supplier_id: '', warehouse_id: '', bill_id: '',
    reason: '', notes: '',
    items: [{ product_id: '', quantity: '1', unit_price: '0', tax_percent: '0' }] as Item[],
  };
  const [form, setForm] = useState(empty);

  const fetch = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('purchase_returns')
      .select('*, suppliers(name)')
      .eq('company_id', selectedCompany.id)
      .is('voided_at', null)
      .order('return_date', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, [selectedCompany]);

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    for (const it of form.items) {
      const q = parseFloat(it.quantity || '0'), p = parseFloat(it.unit_price || '0'), t = parseFloat(it.tax_percent || '0');
      const line = q * p; sub += line; tax += line * t / 100;
    }
    return { sub, tax, total: sub + tax };
  }, [form.items]);

  const updateItem = (i: number, patch: Partial<Item>) => {
    const items = [...form.items]; items[i] = { ...items[i], ...patch }; setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: '1', unit_price: '0', tax_percent: '0' }] });
  const delItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    if (!form.supplier_id) { toast.error('Pilih supplier'); return; }
    const validItems = form.items.filter(i => i.product_id && parseFloat(i.quantity) > 0);
    if (!validItems.length) { toast.error('Tambahkan minimal 1 item'); return; }
    setSubmitting(true);
    try {
      const { data: lastNo } = await supabase
        .from('purchase_returns').select('return_number').eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false }).limit(1);
      const seq = (lastNo?.[0]?.return_number?.match(/(\d+)$/)?.[1] || '0');
      const next = String(parseInt(seq) + 1).padStart(4, '0');
      const return_number = `PR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${next}`;

      const { data: pr, error } = await supabase.from('purchase_returns').insert({
        company_id: selectedCompany.id,
        return_number,
        return_date: form.return_date,
        supplier_id: form.supplier_id,
        bill_id: form.bill_id || null,
        warehouse_id: form.warehouse_id || null,
        subtotal: totals.sub, tax_amount: totals.tax, total_amount: totals.total,
        reason: form.reason || null,
        notes: form.notes || null,
        created_by: user.id,
      }).select().single();
      if (error) throw error;

      const itemRows = validItems.map(it => {
        const q = parseFloat(it.quantity), p = parseFloat(it.unit_price), t = parseFloat(it.tax_percent || '0');
        const line = q * p;
        return {
          return_id: pr.id, product_id: it.product_id, quantity: q, unit_price: p, tax_percent: t,
          total: line + line * t / 100,
        };
      });
      const { error: iErr } = await supabase.from('purchase_return_items').insert(itemRows);
      if (iErr) throw iErr;

      toast.success('Purchase return tersimpan');
      setForm(empty); setOpen(false); fetch();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan'); }
    finally { setSubmitting(false); }
  };

  const filtered = rows.filter(r => !search || r.return_number.toLowerCase().includes(search.toLowerCase()) || (r.suppliers?.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Undo2 className="w-6 h-6" /> Purchase Returns</h1>
          <p className="text-muted-foreground">Retur pembelian ke supplier</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Return</Button>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>No.</TableHead><TableHead>Tanggal</TableHead><TableHead>Supplier</TableHead>
              <TableHead>Alasan</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading…</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada retur</TableCell></TableRow>
              : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.return_number}</TableCell>
                  <TableCell>{formatDate(r.return_date)}</TableCell>
                  <TableCell>{r.suppliers?.name || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.reason || '-'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(r.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-sm font-medium">Tanggal</label>
                <Input type="date" value={form.return_date} onChange={e => setForm({ ...form, return_date: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Supplier *</label>
                <SearchableSelect value={form.supplier_id} onChange={v => setForm({ ...form, supplier_id: v })}
                  options={suppliers.map(s => ({ value: s.id, label: s.name }))} placeholder="Pilih supplier" /></div>
              <div><label className="text-sm font-medium">Gudang</label>
                <SearchableSelect value={form.warehouse_id} onChange={v => setForm({ ...form, warehouse_id: v })}
                  options={warehouses.map(w => ({ value: w.id, label: w.name }))} placeholder="Pilih gudang" /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Item Retur</label>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Item</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[2fr_80px_120px_80px_40px] gap-2 items-center">
                    <SearchableSelect value={it.product_id} onChange={v => updateItem(i, { product_id: v })}
                      options={products.map(p => ({ value: p.id, label: `${p.sku || ''} ${p.name}`.trim() }))} placeholder="Produk" />
                    <Input type="number" placeholder="Qty" value={it.quantity} onChange={e => updateItem(i, { quantity: e.target.value })} />
                    <Input type="number" placeholder="Harga" value={it.unit_price} onChange={e => updateItem(i, { unit_price: e.target.value })} />
                    <Input type="number" placeholder="Pajak %" value={it.tax_percent} onChange={e => updateItem(i, { tax_percent: e.target.value })} />
                    <Button size="icon" variant="ghost" onClick={() => delItem(i)} disabled={form.items.length === 1}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Alasan</label>
                <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="contoh: barang rusak" /></div>
              <div className="text-right">
                <div className="text-sm">Subtotal: <span className="font-medium">{formatCurrency(totals.sub)}</span></div>
                <div className="text-sm">Pajak: <span className="font-medium">{formatCurrency(totals.tax)}</span></div>
                <div className="text-lg font-bold">Total: {formatCurrency(totals.total)}</div>
              </div>
            </div>
            <div><label className="text-sm font-medium">Catatan</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseReturns;