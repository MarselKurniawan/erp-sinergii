import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, ArrowRight, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';

const Estimates: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const empty = {
    estimate_date: new Date().toISOString().slice(0, 10),
    valid_until: '', customer_id: '', notes: '',
    items: [{ product_id: '', description: '', quantity: 1, unit_price: 0, tax_percent: 0, discount_percent: 0 }],
  };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    if (!selectedCompany) return;
    const r = await supabase.from('estimates')
      .select('*, customers(name), estimate_items(*)')
      .eq('company_id', selectedCompany.id).is('voided_at', null)
      .order('estimate_date', { ascending: false });
    setRows(r.data || []);
  };

  useEffect(() => {
    if (!selectedCompany) return;
    load();
    supabase.from('customers').select('id,name').eq('company_id', selectedCompany.id).order('name').then(({ data }) => setCustomers(data || []));
    supabase.from('products').select('id,name,sku,price').eq('company_id', selectedCompany.id).order('name').then(({ data }) => setProducts(data || []));
  }, [selectedCompany]);

  useEffect(() => {
    if (params.get('new') === '1' || location.pathname.endsWith('/new')) {
      setOpen(true); setForm(empty);
      if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    }
  }, [params, location.pathname]);

  const lineTotal = (l: any) => {
    const sub = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount_percent) || 0) / 100);
    return sub + sub * (Number(l.tax_percent) || 0) / 100;
  };
  const subtotal = form.items.reduce((s: number, l: any) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount_percent) || 0) / 100), 0);
  const tax = form.items.reduce((s: number, l: any) => {
    const base = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount_percent) || 0) / 100);
    return s + base * (Number(l.tax_percent) || 0) / 100;
  }, 0);
  const total = subtotal + tax;

  const updateItem = (idx: number, patch: any) => {
    const items = [...form.items]; items[idx] = { ...items[idx], ...patch };
    if (patch.product_id) { const p = products.find(x => x.id === patch.product_id); if (p) items[idx].unit_price = p.price || 0; }
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: '', description: '', quantity: 1, unit_price: 0, tax_percent: 0, discount_percent: 0 }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) });

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    if (!form.customer_id) { toast.error('Pilih customer'); return; }
    setSubmitting(true);
    try {
      const { data: numData } = await supabase.rpc('generate_document_number', { p_company_id: selectedCompany.id, p_document_type: 'EST' });
      const num = (numData as string) || `EST-${Date.now()}`;
      const { data: est, error } = await (supabase.from('estimates') as any).insert({
        company_id: selectedCompany.id, estimate_number: num,
        estimate_date: form.estimate_date, valid_until: form.valid_until || null,
        customer_id: form.customer_id, notes: form.notes || null,
        subtotal, tax_amount: tax, total_amount: total, status: 'sent', created_by: user.id,
      }).select().single();
      if (error) throw error;
      await (supabase.from('estimate_items') as any).insert(form.items.map((l: any) => ({
        estimate_id: est.id, product_id: l.product_id || null, description: l.description || null,
        quantity: l.quantity, unit_price: l.unit_price, tax_percent: l.tax_percent,
        discount_percent: l.discount_percent, total: lineTotal(l),
      })));
      toast.success('Estimate tersimpan'); setOpen(false); setForm(empty); load();
    } catch (e: any) { toast.error(e.message || 'Gagal'); } finally { setSubmitting(false); }
  };

  const convertToInvoice = async (est: any) => {
    if (!selectedCompany || !user) return;
    try {
      const { data: numData } = await supabase.rpc('generate_document_number', { p_company_id: selectedCompany.id, p_document_type: 'INV' });
      const inum = (numData as string) || `INV-${Date.now()}`;
      const { data: inv, error } = await (supabase.from('invoices') as any).insert({
        company_id: selectedCompany.id, invoice_number: inum,
        customer_id: est.customer_id, invoice_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        status: 'pending', subtotal: est.subtotal, tax_amount: est.tax_amount,
        total_amount: est.total_amount, outstanding_amount: est.total_amount, paid_amount: 0, created_by: user.id,
      }).select().single();
      if (error) throw error;
      await ((supabase as any).from('invoice_items')).insert((est.estimate_items || []).map((l: any) => ({
        invoice_id: inv.id, product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price,
        discount_percent: l.discount_percent, tax_percent: l.tax_percent, total: l.total,
      })));
      await (supabase.from('estimates') as any).update({ status: 'accepted', converted_to_invoice_id: inv.id }).eq('id', est.id);
      toast.success(`Invoice ${inum} dibuat`); load();
    } catch (e: any) { toast.error(e.message || 'Gagal konversi'); }
  };

  const filtered = rows.filter(r => r.estimate_number.toLowerCase().includes(search.toLowerCase()) || (r.customers?.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Estimates / Penawaran</h1>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Estimate</Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="relative mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari nomor / customer..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tanggal</TableHead><TableHead>No</TableHead><TableHead>Customer</TableHead>
            <TableHead>Berlaku Hingga</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada estimate</TableCell></TableRow>
              : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.estimate_date)}</TableCell>
                  <TableCell className="font-mono">{r.estimate_number}</TableCell>
                  <TableCell>{r.customers?.name || '-'}</TableCell>
                  <TableCell>{r.valid_until ? formatDate(r.valid_until) : '-'}</TableCell>
                  <TableCell><Badge variant={r.status === 'accepted' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell>
                  <TableCell>
                    {r.status !== 'accepted' && (
                      <Button size="sm" variant="outline" onClick={() => convertToInvoice(r)}>
                        <ArrowRight className="h-3 w-3 mr-1" />Ke Invoice
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Estimate</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Tanggal</Label><Input type="date" value={form.estimate_date} onChange={(e) => setForm({ ...form, estimate_date: e.target.value })} /></div>
            <div><Label>Berlaku Hingga</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
            <div><Label>Customer</Label>
              <SearchableSelect value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })}
                options={customers.map(c => ({ value: c.id, label: c.name }))} placeholder="Pilih customer" />
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between"><Label>Items</Label><Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Item</Button></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produk</TableHead><TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-32">Harga</TableHead><TableHead className="w-20">Disc%</TableHead>
                <TableHead className="w-20">Pajak%</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {form.items.map((l: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell><SearchableSelect value={l.product_id} onChange={(v) => updateItem(i, { product_id: v })}
                      options={products.map(p => ({ value: p.id, label: `${p.sku || ''} ${p.name}` }))} placeholder="Pilih" /></TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={l.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={l.discount_percent} onChange={(e) => updateItem(i, { discount_percent: e.target.value })} /></TableCell>
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

export default Estimates;