import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { unitOptions } from '@/lib/units';

interface Material {
  id: string;
  sku: string;
  name: string;
  unit: string;
  cost_price: number;
  stock_quantity: number;
  is_active: boolean;
  cogs_account_id: string | null;
  cogs_account?: { id: string; code: string; name: string };
}

export const Materials: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { getCogsAccounts, getExpenseAccounts } = useAccounts();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    unit: 'pcs',
    cost_price: '',
    stock_quantity: '',
    cogs_account_id: '',
  });

  const fetchMaterials = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, sku, name, unit, cost_price, stock_quantity, is_active, cogs_account_id,
        cogs_account:chart_of_accounts!products_cogs_account_id_fkey(id, code, name)
      `)
      .eq('company_id', selectedCompany.id)
      .eq('product_type', 'raw_material')
      .order('name');

    if (error) {
      console.error('Error fetching materials:', error);
      toast.error('Failed to load materials');
    } else {
      setMaterials(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMaterials();
  }, [selectedCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const materialData = {
      sku: formData.sku,
      name: formData.name,
      product_type: 'raw_material' as const,
      unit: formData.unit,
      unit_price: 0,
      cost_price: parseFloat(formData.cost_price) || 0,
      stock_quantity: parseFloat(formData.stock_quantity) || 0,
      cogs_account_id: formData.cogs_account_id || null,
    };

    if (editingMaterial) {
      const { error } = await supabase
        .from('products')
        .update(materialData)
        .eq('id', editingMaterial.id);

      if (error) {
        toast.error('Failed to update material');
      } else {
        toast.success('Material updated successfully');
        fetchMaterials();
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert({
          ...materialData,
          company_id: selectedCompany.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('SKU already exists');
        } else {
          toast.error('Failed to create material');
        }
      } else {
        toast.success('Material created successfully');
        fetchMaterials();
      }
    }

    setIsDialogOpen(false);
    setEditingMaterial(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      unit: 'pcs',
      cost_price: '',
      stock_quantity: '',
      cogs_account_id: '',
    });
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      sku: material.sku,
      name: material.name,
      unit: material.unit,
      cost_price: material.cost_price.toString(),
      stock_quantity: material.stock_quantity.toString(),
      cogs_account_id: material.cogs_account_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus material ini?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Gagal menghapus material');
    } else {
      toast.success('Material berhasil dihapus');
      fetchMaterials();
    }
  };

  const filteredMaterials = materials.filter(m =>
    m.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cogsAccounts = [...getCogsAccounts(), ...getExpenseAccounts()];
  const cogsAccountOptions = [
    { value: '', label: 'No Account' },
    ...cogsAccounts.map(acc => ({ value: acc.id, label: `${acc.code} - ${acc.name}` })),
  ];

  const totalStock = materials.reduce((sum, m) => sum + (m.stock_quantity || 0), 0);
  const totalValue = materials.reduce((sum, m) => sum + ((m.stock_quantity || 0) * m.cost_price), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Materials & Supplies</h1>
          <p className="text-muted-foreground mt-1">
            Bahan baku dan supplies untuk pembelian
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="gradient-primary text-primary-foreground shadow-glow"
              onClick={() => {
                setEditingMaterial(null);
                resetForm();
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Material
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMaterial ? 'Edit Material' : 'Add New Material'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="form-label">SKU</label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g., MAT-001"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="form-label">Nama Material</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama material"
                  className="input-field"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Satuan</label>
                  <SearchableSelect
                    options={unitOptions()}
                    value={formData.unit}
                    onChange={(value) => setFormData({ ...formData, unit: value })}
                    placeholder="Pilih satuan"
                  />
                </div>
                <div>
                  <label className="form-label">Harga Beli</label>
                  <Input
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0"
                    className="input-field"
                  />
                  {editingMaterial && editingMaterial.stock_quantity > 0 && parseFloat(formData.cost_price || '0') !== editingMaterial.cost_price && (
                    <p className="text-xs text-warning mt-1">
                      Avg dengan harga lama: {formatCurrency(((editingMaterial.stock_quantity * editingMaterial.cost_price) + (parseFloat(formData.stock_quantity || '0') * parseFloat(formData.cost_price || '0'))) / Math.max(1, editingMaterial.stock_quantity + parseFloat(formData.stock_quantity || '0')))}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="form-label">Stok Awal</label>
                <Input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder="0"
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Akun COGS</label>
                <SearchableSelect
                  options={cogsAccountOptions}
                  value={formData.cogs_account_id}
                  onChange={(value) => setFormData({ ...formData, cogs_account_id: value })}
                  placeholder="Pilih akun"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  {editingMaterial ? 'Update' : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{materials.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Stock</p>
                <p className="text-2xl font-bold">{totalStock.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari material..."
          className="pl-10 input-field"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum ada material</h3>
              <p className="text-muted-foreground">
                Tambahkan bahan baku atau supplies untuk pembelian
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nama</th>
                    <th>Satuan</th>
                    <th className="text-right">Harga Beli</th>
                    <th className="text-right">Stok</th>
                    <th className="text-right">Nilai</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map((material) => (
                    <tr key={material.id}>
                      <td className="font-mono text-sm">{material.sku}</td>
                      <td className="font-medium">{material.name}</td>
                      <td>{material.unit}</td>
                      <td className="text-right">{formatCurrency(material.cost_price)}</td>
                      <td className="text-right">{material.stock_quantity}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(material.stock_quantity * material.cost_price)}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(material)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(material.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Materials;
