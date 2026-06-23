import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Search, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';

const SalesReturns: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getCashBankAccounts } = useAccounts();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const empty = {
    return_date: new Date().toISOString().slice(0, 10),
    customer_id: '', warehouse_id: '', reason: '', refund_account_id: '', notes: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0, tax_percent: 0 }],
  };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    if (!selectedCompany) return;
    const r = await supabase.from('sales_returns')
      .select('*, customers(name)')
      .eq('company_id', selectedCompany.id).is('voided_at', null)
      .order('return_date', { ascending: false });
    setRows(r.data || []);
  };
  useEffect(() => {
    if (!selectedCompany) return;
    load();
    supabase.from('customers').select('id,name').eq('company_id', selectedCompany.id).order('name').then(({ data }) => setCustomers(data || []));
    supabase.from('products').select('id,name,sku,price').eq('company_id', selectedCompany.id).order('name').then(({ data }) => setProducts(data || []));
    supabase.from('warehouses').select('id,name').eq('company_id', selectedCompany.id).then(({ data }) => setWarehouses(data || []));
  }, [selectedCompany]);
  useEffect(() => {
    if (params.get('new') === '1' || location.pathname.endsWith('/new')) {
      setOpen(true); setForm(empty);
      if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    }
  }, [params, location.pathname]);

  const lineTotal = (l: any) => {
    const sub = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
    return sub + sub * (Number(l.tax_percent) || 0) / 100;
  };
  const subtotal = form.items.reduce((s: number, l: any) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const tax = form.items.reduce((s: number, l: any) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (Number(l.tax_percent) || 0) / 100, 0);
  const total = subtotal + tax;

  const updateItem = (idx: number, patch: any) => {
    const items = [...form.items]; items[idx] = { ...items[idx], ...patch };
    if (patch.product_id) { const p = products.find(x => x.id === patch.product_id); if (p) items[idx].unit_price = p.price || 0; }
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_price: 0, tax_percent: 0 }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) });

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    if (!form.customer_id || !form.refund_account_id) { toast.error('Pilih customer dan akun pengembalian'); return; }
    setSubmitting(true);
    try {
      const { data: numData } = await supabase.rpc('generate_document_number', { p_company_id: selectedCompany.id, p_document_type: 'SRN' });
      const num = (numData as string) || `SRN-${Date.now()}`;
      const { data: sr, error } = await supabase.from('sales_returns').insert({
        company_id: selectedCompany.id, return_number: num, return_date: form.return_date,
        customer_id: form.customer_id, warehouse_id: form.warehouse_id || null,
        reason: form.reason || null, refund_account_id: form.refund_account_id,
        subtotal, tax_amount: tax, total_amount: total, status: 'posted', notes: form.notes || null, created_by: user.id,
      }).select().single();
      if (error) throw error;
      await supabase.from('sales_return_items').insert(form.items.map((l: any) => ({
        return_id: sr.id, product_id: l.product_id || null,
        quantity: l.quantity, unit_price: l.unit_price, tax_percent: l.tax_percent, total: lineTotal(l),
      })));
      toast.success('Sales return tersimpan'); setOpen(false); setForm(empty); load();
    } catch (e: any) { toast.error(e.message || 'Gagal'); } finally { setSubmitting(false); }
  };

  const filtered = rows.filter(r => r.return_number.toLowerCase().includes(search.toLowerCase()) || (r.customers?.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><RotateCcw className="h-6 w-6" /> Sales Returns</h1>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Return</Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="relative mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari nomor / customer..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tanggal</TableHead><TableHead>No</TableHead><TableHead>Customer</TableHead>
            <TableHead>Alasan</TableHead><TableHead className="text-right">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada return</TableCell></TableRow>
              : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.return_date)}</TableCell>
                  <TableCell className="font-mono">{r.return_number}</TableCell>
                  <TableCell>{r.customers?.name || '-'}</TableCell>
                  <TableCell>{r.reason || '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Sales Return</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Tanggal</Label><Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} /></div>
            <div><Label>Customer</Label>
              <SearchableSelect value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })}
                options={customers.map(c => ({ value: c.id, label: c.name }))} placeholder="Pilih customer" />
            </div>
            <div><Label>Gudang</Label>
              <SearchableSelect value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })}
                options={warehouses.map(w => ({ value: w.id, label: w.name }))} placeholder="Pilih gudang" />
            </div>
            <div className="col-span-2"><Label>Akun Pengembalian (Kas/Bank)</Label>
              <SearchableSelect value={form.refund_account_id} onChange={(v) => setForm({ ...form, refund_account_id: v })}
                options={getCashBankAccounts().map((a: any) => ({ value: a.id, label: `${a.code} - ${a.name}` }))} placeholder="Pilih akun" />
            </div>
            <div><Label>Alasan</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <div className="space-y-2 mt-3">
            <div className="flex justify-between"><Label>Items</Label><Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Item</Button></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produk</TableHead><TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-32">Harga</TableHead><TableHead className="w-20">Pajak%</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {form.items.map((l: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell><SearchableSelect value={l.product_id} onChange={(v) => updateItem(i, { product_id: v })}
                      options={products.map(p => ({ value: p.id, label: `${p.sku || ''} ${p.name}` }))} placeholder="Pilih" /></TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={l.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={l.tax_percent} onChange={(e) => updateItem(i, { tax_percent: e.target.value })} /></TableCell>
                    <TableCell className="text-right">{formatCurrency(lineTotal(l))}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3"><Label>Catatan</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-between items-center pt-3 border-t mt-3">
            <div className="text-sm">Subtotal: {formatCurrency(subtotal)} | Pajak: {formatCurrency(tax)}</div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">Total: {formatCurrency(total)}</span>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesReturns;