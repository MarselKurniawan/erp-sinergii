import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Kind = 'customer' | 'supplier';

const Contacts: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [tab, setTab] = useState<Kind>('customer');
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const empty = { name: '', code: '', email: '', phone: '', address: '', tax_number: '', notes: '' };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    if (!selectedCompany) return;
    const [c, s] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', selectedCompany.id).order('name'),
      supabase.from('suppliers').select('*').eq('company_id', selectedCompany.id).order('name'),
    ]);
    setCustomers(c.data || []); setSuppliers(s.data || []);
  };
  useEffect(() => { load(); }, [selectedCompany]);
  useEffect(() => {
    if (params.get('new') === '1' || location.pathname.endsWith('/new')) {
      setOpen(true); setEditingId(null); setForm(empty);
      if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    }
  }, [params, location.pathname]);

  const handleSubmit = async () => {
    if (!selectedCompany || !form.name) { toast.error('Nama wajib'); return; }
    const table = tab === 'customer' ? 'customers' : 'suppliers';
    let code = form.code?.trim();
    if (!code && !editingId) {
      const { generateCode } = await import('@/lib/autoCode');
      code = await generateCode(selectedCompany.id, tab === 'customer' ? 'CUST' : 'SUP');
    }
    const payload: any = { ...form, code, company_id: selectedCompany.id };
    const { error } = editingId
      ? await supabase.from(table).update(payload).eq('id', editingId)
      : await supabase.from(table).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Tersimpan'); setOpen(false); setForm(empty); setEditingId(null); load();
  };

  const openEdit = (row: any) => { setEditingId(row.id); setForm({ ...empty, ...row }); setOpen(true); };

  const rows = tab === 'customer' ? customers : suppliers;
  const filtered = useMemo(() => rows.filter((r: any) =>
    (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.email || '').toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Customer & Supplier</h1>
        <Button onClick={() => { setEditingId(null); setForm(empty); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Tambah {tab === 'customer' ? 'Customer' : 'Supplier'}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList>
          <TabsTrigger value="customer">Customer <Badge variant="secondary" className="ml-2">{customers.length}</Badge></TabsTrigger>
          <TabsTrigger value="supplier">Supplier <Badge variant="secondary" className="ml-2">{suppliers.length}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <Card><CardContent className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / kode / email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Email</TableHead>
                <TableHead>Telepon</TableHead><TableHead>NPWP</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada data</TableCell></TableRow>
                ) : filtered.map((r: any) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => openEdit(r)}>
                    <TableCell className="font-mono">{r.code || '-'}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.email || '-'}</TableCell>
                    <TableCell>{r.phone || '-'}</TableCell>
                    <TableCell>{r.tax_number || '-'}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Tambah'} {tab === 'customer' ? 'Customer' : 'Supplier'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Kode <span className="text-xs text-muted-foreground">(otomatis kosongkan)</span></Label><Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Otomatis" /></div>
            <div><Label>Nama *</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telepon</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="col-span-2"><Label>Alamat</Label><Textarea value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>NPWP</Label><Input value={form.tax_number || ''} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></div>
            <div><Label>Catatan</Label><Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="col-span-2 flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={handleSubmit}>Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contacts;