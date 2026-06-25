import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Building2, Mail, Phone, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ProductSuppliersDialog } from '@/components/suppliers/ProductSuppliersDialog';

interface Supplier {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  payable_account_id: string | null;
}

export const Suppliers: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { getPayableAccounts } = useAccounts();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', email: '', phone: '', address: '', payable_account_id: '' });
  
  // Product suppliers dialog state
  const [productSuppliersOpen, setProductSuppliersOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    const { data, error } = await supabase.from('suppliers').select('*').eq('company_id', selectedCompany.id).order('name');
    if (!error) setSuppliers(data || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, [selectedCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    const { generateCode } = await import('@/lib/autoCode');
    const code = formData.code?.trim() || (await generateCode(selectedCompany.id, 'SUP'));
    const supplierData = { code, name: formData.name, email: formData.email || null, phone: formData.phone || null, address: formData.address || null, payable_account_id: formData.payable_account_id || null };
    
    if (editingSupplier) {
      const { error } = await supabase.from('suppliers').update(supplierData).eq('id', editingSupplier.id);
      if (!error) { toast.success('Supplier updated'); fetchSuppliers(); }
    } else {
      const { error } = await supabase.from('suppliers').insert({ ...supplierData, company_id: selectedCompany.id });
      if (!error) { toast.success('Supplier created'); fetchSuppliers(); }
    }
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setFormData({ code: '', name: '', email: '', phone: '', address: '', payable_account_id: '' });
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({ code: supplier.code, name: supplier.name, email: supplier.email || '', phone: supplier.phone || '', address: supplier.address || '', payable_account_id: supplier.payable_account_id || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (!error) { toast.success('Supplier deleted'); fetchSuppliers(); }
  };

  const openProductSuppliers = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setProductSuppliersOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s => s.code.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const payableAccounts = getPayableAccounts();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage your supplier database</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={() => { setEditingSupplier(null); setFormData({ code: '', name: '', email: '', phone: '', address: '', payable_account_id: '' }); }}>
              <Plus className="w-4 h-4 mr-2" />Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Create New Supplier'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Supplier Code <span className="text-xs text-muted-foreground">(otomatis jika kosong)</span></label><Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Otomatis: SUP-YYYYMM-XXXX" className="input-field" /></div>
                <div><label className="form-label">Name</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Supplier name" className="input-field" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Email</label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field" /></div>
                <div><label className="form-label">Phone</label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" /></div>
              </div>
              <div><label className="form-label">Address</label><Textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="input-field" /></div>
              <div><label className="form-label">Payable Account</label>
                <Select value={formData.payable_account_id} onValueChange={v => setFormData({...formData, payable_account_id: v})}>
                  <SelectTrigger className="input-field"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{payableAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">{editingSupplier ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search suppliers..." className="pl-10 input-field" /></div>
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredSuppliers.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">No suppliers found</h3></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-mono text-sm">{supplier.code}</TableCell>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.email || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.phone || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openProductSuppliers(supplier)} title="Produk Supplier">
                          <Package className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(supplier.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Product Suppliers Dialog */}
      {selectedSupplier && (
        <ProductSuppliersDialog
          open={productSuppliersOpen}
          onOpenChange={setProductSuppliersOpen}
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
        />
      )}
    </div>
  );
};

export default Suppliers;
