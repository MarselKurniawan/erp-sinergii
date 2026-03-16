import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Building2, Shield, Factory, Store, Briefcase, Loader2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog';
import { DataResetDialog } from '@/components/settings/DataResetDialog';
import { getDefaultCOA, businessTypeLabels, type BusinessType } from '@/lib/defaultCOA';
import { Badge } from '@/components/ui/badge';

interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  business_type: BusinessType | null;
  created_at: string;
}

const initialFormData = {
  name: '',
  code: '',
  address: '',
  phone: '',
  email: '',
  business_type: 'trading' as BusinessType,
};

const businessTypeIcons: Record<BusinessType, React.ReactNode> = {
  trading: <Store className="w-5 h-5" />,
  service: <Briefcase className="w-5 h-5" />,
  manufacturing: <Factory className="w-5 h-5" />,
};

const Companies: React.FC = () => {
  const { isAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchCompanies();
    }
  }, [isAdmin]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies((data || []) as Company[]);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      code: company.code,
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      business_type: company.business_type || 'trading',
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setSelectedCompany(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const generateDefaultCOA = async (companyId: string, businessType: BusinessType) => {
    const defaultAccounts = getDefaultCOA(businessType);
    
    // First pass: create all accounts without parent_id
    const accountsToInsert = defaultAccounts.map(acc => ({
      company_id: companyId,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      is_active: true,
      balance: 0,
    }));

    const { error } = await supabase
      .from('chart_of_accounts')
      .insert(accountsToInsert);

    if (error) {
      console.error('Error creating default COA:', error);
      throw new Error('Failed to create default chart of accounts');
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('Name and Code are required');
      return;
    }

    setSaving(true);

    try {
      if (selectedCompany) {
        // Update - don't change business_type for existing companies
        const { error } = await supabase
          .from('companies')
          .update({
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            address: formData.address.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
          })
          .eq('id', selectedCompany.id);

        if (error) throw error;
        toast.success('Company updated successfully');
      } else {
        // Create new company
        const { data: newCompany, error } = await supabase
          .from('companies')
          .insert({
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            address: formData.address.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            business_type: formData.business_type,
          })
          .select()
          .single();

        if (error) throw error;

        // Generate default COA for the new company
        toast.loading('Membuat Chart of Accounts default...', { id: 'coa-generation' });
        await generateDefaultCOA(newCompany.id, formData.business_type);
        toast.dismiss('coa-generation');
        
        toast.success(`Company created with ${businessTypeLabels[formData.business_type].label} COA template`);
      }

      setDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      toast.dismiss('coa-generation');
      console.error('Error saving company:', error);
      if (error.code === '23505') {
        toast.error('A company with this code already exists');
      } else {
        toast.error(error.message || 'Failed to save company');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id);

      if (error) throw error;

      toast.success('Company deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedCompany(null);
      fetchCompanies();
    } catch (error: any) {
      console.error('Error deleting company:', error);
      if (error.code === '23503') {
        toast.error('Cannot delete: company has related data');
      } else {
        toast.error('Failed to delete company');
      }
    }
  };

  const confirmDelete = (company: Company) => {
    setSelectedCompany(company);
    setDeleteDialogOpen(true);
  };

  const getBusinessTypeBadge = (type: BusinessType | null) => {
    if (!type) return <Badge variant="secondary">-</Badge>;
    
    const colors: Record<BusinessType, string> = {
      trading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      service: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      manufacturing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };

    return (
      <Badge className={colors[type]}>
        {businessTypeLabels[type]?.label || type}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You need administrator privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Company Management</h1>
          <p className="text-muted-foreground mt-1">Manage companies in the system</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Company
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            All Companies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading companies...</div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No companies found. Create your first company to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Business Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map(company => (
                  <TableRow key={company.id}>
                    <TableCell className="font-mono font-medium">{company.code}</TableCell>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{getBusinessTypeBadge(company.business_type)}</TableCell>
                    <TableCell>{company.email || '-'}</TableCell>
                    <TableCell>{company.phone || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(company)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950"
                          onClick={() => {
                            setSelectedCompany(company);
                            setResetDialogOpen(true);
                          }}
                          title="Reset Data"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => confirmDelete(company)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCompany ? 'Edit Company' : 'Create New Company'}
            </DialogTitle>
            {!selectedCompany && (
              <DialogDescription>
                Pilih bidang usaha untuk menentukan template Chart of Accounts default.
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Type Selection - Only for new companies */}
            {!selectedCompany && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Bidang Usaha *</Label>
                <RadioGroup
                  value={formData.business_type}
                  onValueChange={(value) => setFormData({ ...formData, business_type: value as BusinessType })}
                  className="grid gap-3"
                >
                  {(Object.keys(businessTypeLabels) as BusinessType[]).map((type) => (
                    <div key={type} className="relative">
                      <RadioGroupItem
                        value={type}
                        id={type}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={type}
                        className="flex items-start gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5 text-muted-foreground peer-data-[state=checked]:text-primary">
                          {businessTypeIcons[type]}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium leading-none">
                            {businessTypeLabels[type].label}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {businessTypeLabels[type].description}
                          </p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., ABC"
                  maxLength={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Company Name"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="company@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+62 xxx xxxx xxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full address"
              />
            </div>

            {!selectedCompany && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">ℹ️ Informasi</p>
                <p>
                  Setelah company dibuat, sistem akan otomatis membuat Chart of Accounts (COA) 
                  default sesuai bidang usaha yang dipilih dengan penomoran akun 1-8 
                  berdasarkan standar akuntansi internasional.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : selectedCompany ? 'Update' : 'Create Company'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <PasswordConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Company?"
        description={`Are you sure you want to delete "${selectedCompany?.name}"? This action cannot be undone and will fail if the company has related data.`}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default Companies;
