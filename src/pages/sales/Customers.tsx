import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  receivable_account_id: string | null;
}

export const Customers: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { accounts, getReceivableAccounts } = useAccounts();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    credit_limit: '',
    receivable_account_id: '',
  });

  const fetchCustomers = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('name');

    if (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } else {
      setCustomers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [selectedCompany]);

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      email: '',
      phone: '',
      address: '',
      credit_limit: '',
      receivable_account_id: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const { generateCode } = await import('@/lib/autoCode');
    const code = formData.code?.trim() || (await generateCode(selectedCompany.id, 'CUST'));

    const customerData = {
      code,
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      credit_limit: parseFloat(formData.credit_limit) || 0,
      receivable_account_id: formData.receivable_account_id || null,
    };

    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingCustomer.id);

      if (error) {
        toast.error('Failed to update customer');
      } else {
        toast.success('Customer updated successfully');
        fetchCustomers();
      }
    } else {
      const { error } = await supabase
        .from('customers')
        .insert({
          ...customerData,
          company_id: selectedCompany.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Customer code already exists');
        } else {
          toast.error('Failed to create customer');
        }
      } else {
        toast.success('Customer created successfully');
        fetchCustomers();
      }
    }

    setIsDialogOpen(false);
    setEditingCustomer(null);
    resetForm();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      code: customer.code,
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      credit_limit: customer.credit_limit.toString(),
      receivable_account_id: customer.receivable_account_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete customer. It may have related transactions.');
    } else {
      toast.success('Customer deleted successfully');
      fetchCustomers();
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const receivableAccounts = getReceivableAccounts();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage your customer database</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="gradient-primary text-primary-foreground shadow-glow"
              onClick={() => {
                setEditingCustomer(null);
                resetForm();
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Create New Customer'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Customer Code <span className="text-xs text-muted-foreground">(otomatis jika kosong)</span></label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Otomatis: CUST-YYYYMM-XXXX"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Credit Limit</label>
                  <Input
                    type="number"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    placeholder="0"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Customer Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter customer name"
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+62..."
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Address</label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter customer address"
                  className="input-field min-h-[80px]"
                />
              </div>

              <div>
                <label className="form-label">Receivable Account</label>
                <Select
                  value={formData.receivable_account_id}
                  onValueChange={(value) => setFormData({ ...formData, receivable_account_id: value })}
                >
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {receivableAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  {editingCustomer ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customers..."
          className="pl-10 input-field"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading customers...</div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No customers found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first customer'}
              </p>
            </div>
          </CardContent>
        </Card>
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
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-mono text-sm">{customer.code}</TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.email || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.phone || '-'}</TableCell>
                    <TableCell className="text-right text-primary font-medium">
                      {formatCurrency(customer.credit_limit)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer.id)}
                          className="text-destructive hover:text-destructive"
                        >
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
    </div>
  );
};

export default Customers;
