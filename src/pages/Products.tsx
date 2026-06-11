import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Package, Archive, Settings, FolderOpen, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCSVImport } from '@/components/products/ProductCSVImport';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AccountValidationAlert } from '@/components/accounting/AccountValidationAlert';

interface Category {
  id: string;
  name: string;
  description?: string | null;
}

interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  category: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  product_type: 'stockable' | 'service' | 'raw_material';
  unit: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  is_active: boolean;
  category_id: string | null;
  revenue_account_id: string | null;
  cogs_account_id: string | null;
  category?: Category;
  revenue_account?: { id: string; code: string; name: string };
  cogs_account?: { id: string; code: string; name: string };
  product_tax_rates?: { tax_rate_id: string }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

export const Products: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { accounts, getRevenueAccounts, getCogsAccounts, getExpenseAccounts } = useAccounts();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // Category management state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    product_type: 'stockable' as 'stockable' | 'service' | 'raw_material',
    category_id: '',
    unit: 'pcs',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    revenue_account_id: '',
    cogs_account_id: '',
    tax_rate_ids: [] as string[],
  });

  const fetchProducts = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:product_categories(id, name),
        revenue_account:chart_of_accounts!products_revenue_account_id_fkey(id, code, name),
        cogs_account:chart_of_accounts!products_cogs_account_id_fkey(id, code, name),
        product_tax_rates(tax_rate_id)
      `)
      .eq('company_id', selectedCompany.id)
      .order('name');

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } else {
      setProducts((data as any) || []);
    }
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('product_categories')
      .select('id, name, description')
      .eq('company_id', selectedCompany.id)
      .order('name');

    setCategories(data || []);
  };

  const fetchTaxRates = async () => {
    if (!selectedCompany) return;
    const { data } = await supabase
      .from('pos_tax_rates')
      .select('id, name, rate, category')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('category')
      .order('name');
    setTaxRates((data as any) || []);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchTaxRates();
  }, [selectedCompany]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const syncProductTaxRates = async (productId: string, taxRateIds: string[]) => {
    await supabase.from('product_tax_rates').delete().eq('product_id', productId);
    if (taxRateIds.length > 0) {
      await supabase.from('product_tax_rates').insert(
        taxRateIds.map(tid => ({ product_id: productId, tax_rate_id: tid }))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const productData = {
      sku: formData.sku,
      name: formData.name,
      product_type: formData.product_type,
      category_id: formData.category_id || null,
      unit: formData.unit,
      unit_price: parseFloat(formData.unit_price) || 0,
      cost_price: parseFloat(formData.cost_price) || 0,
      stock_quantity: formData.product_type === 'stockable' ? parseFloat(formData.stock_quantity) || 0 : 0,
      revenue_account_id: formData.revenue_account_id || null,
      cogs_account_id: formData.cogs_account_id || null,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) {
        toast.error('Failed to update product');
      } else {
        await syncProductTaxRates(editingProduct.id, formData.tax_rate_ids);
        toast.success('Product updated successfully');
        fetchProducts();
      }
    } else {
      const { data: created, error } = await supabase
        .from('products')
        .insert({
          ...productData,
          company_id: selectedCompany.id,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('SKU already exists');
        } else {
          toast.error('Failed to create product');
        }
      } else {
        if (created?.id) {
          await syncProductTaxRates(created.id, formData.tax_rate_ids);
        }
        toast.success('Product created successfully');
        fetchProducts();
      }
    }

    setIsDialogOpen(false);
    setEditingProduct(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      product_type: 'stockable',
      category_id: '',
      unit: 'pcs',
      unit_price: '',
      cost_price: '',
      stock_quantity: '',
      revenue_account_id: '',
      cogs_account_id: '',
      tax_rate_ids: [],
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      product_type: product.product_type,
      category_id: product.category_id || '',
      unit: product.unit,
      unit_price: product.unit_price.toString(),
      cost_price: product.cost_price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      revenue_account_id: product.revenue_account_id || '',
      cogs_account_id: product.cogs_account_id || '',
      tax_rate_ids: (product.product_tax_rates || []).map(r => r.tax_rate_id),
    });
    setIsDialogOpen(true);
  };


  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product deleted successfully');
      fetchProducts();
    }
  };

  // Category management functions
  const openAddCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setIsCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, description: category.description || '' });
    setIsCategoryDialogOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !categoryForm.name.trim()) return;

    if (editingCategory) {
      const { error } = await supabase
        .from('product_categories')
        .update({ name: categoryForm.name.trim(), description: categoryForm.description.trim() || null })
        .eq('id', editingCategory.id);

      if (error) {
        toast.error('Failed to update category');
      } else {
        toast.success('Category updated');
        fetchCategories();
      }
    } else {
      const { error } = await supabase
        .from('product_categories')
        .insert({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          company_id: selectedCompany.id,
        });

      if (error) {
        toast.error('Failed to create category');
      } else {
        toast.success('Category created');
        fetchCategories();
      }
    }

    setIsCategoryDialogOpen(false);
  };

  const confirmDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', categoryToDelete.id);

    if (error) {
      if (error.code === '23503') {
        toast.error('Cannot delete category with products');
      } else {
        toast.error('Failed to delete category');
      }
    } else {
      toast.success('Category deleted');
      fetchCategories();
    }

    setDeleteCategoryDialogOpen(false);
    setCategoryToDelete(null);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || product.product_type === filterType;
    return matchesSearch && matchesType;
  });

  // Sort by category, then by name
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const catA = a.category?.name || 'zzz';
    const catB = b.category?.name || 'zzz';
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.localeCompare(b.name);
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get available accounts
  const revenueAccounts = getRevenueAccounts();
  const cogsAccounts = [...getCogsAccounts(), ...getExpenseAccounts()];

  // Options for SearchableSelect
  const productTypeOptions = [
    { value: 'stockable', label: 'Stockable' },
    { value: 'service', label: 'Service' },
    { value: 'raw_material', label: 'Raw Material' },
  ];

  const categoryOptions = [
    { value: '', label: 'No Category' },
    ...categories.map(cat => ({ value: cat.id, label: cat.name })),
  ];

  const revenueAccountOptions = [
    { value: '', label: 'No Account' },
    ...revenueAccounts.map(acc => ({ value: acc.id, label: `${acc.code} - ${acc.name}` })),
  ];

  const cogsAccountOptions = [
    { value: '', label: 'No Account' },
    ...cogsAccounts.map(acc => ({ value: acc.id, label: `${acc.code} - ${acc.name}` })),
  ];

  const filterTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'stockable', label: 'Stockable' },
    { value: 'service', label: 'Service' },
    { value: 'raw_material', label: 'Raw Material' },
  ];

  return (
    <div className="space-y-6">
      <AccountValidationAlert requiredAccountTypes={['revenue', 'expense']} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your products and services
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Import CSV Button */}
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          
          {/* Category Management Button */}
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openAddCategoryDialog}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Categories
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Edit Category' : 'Manage Categories'}
                </DialogTitle>
              </DialogHeader>
              
              {/* Add/Edit Category Form */}
              <form onSubmit={handleCategorySubmit} className="space-y-4">
                <div>
                  <label className="form-label">Category Name</label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="Enter category name"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Description (Optional)</label>
                  <Input
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Enter description"
                  />
                </div>
                <div className="flex gap-2">
                  {editingCategory && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryForm({ name: '', description: '' });
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                  <Button type="submit" className="flex-1">
                    {editingCategory ? 'Update' : 'Add Category'}
                  </Button>
                </div>
              </form>

              {/* Category List */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3">Existing Categories</h4>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          {cat.description && (
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditCategoryDialog(cat)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => confirmDeleteCategory(cat)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Product Button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="gradient-primary text-primary-foreground shadow-glow"
                onClick={() => {
                  setEditingProduct(null);
                  resetForm();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Edit Product' : 'Create New Product'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">SKU</label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g., PRD-001"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Product Type</label>
                    <SearchableSelect
                      options={productTypeOptions}
                      value={formData.product_type}
                      onChange={(value) => setFormData({ ...formData, product_type: value as 'stockable' | 'service' | 'raw_material' })}
                      placeholder="Select type"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="form-label">Product Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                    className="input-field"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={formData.category_id}
                      onChange={(value) => setFormData({ ...formData, category_id: value })}
                      placeholder="Select category"
                      searchPlaceholder="Search categories..."
                    />
                  </div>
                  <div>
                    <label className="form-label">Unit</label>
                    <Input
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="e.g., pcs, kg, m"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Unit Price (Sell)</label>
                    <Input
                      type="number"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      placeholder="0"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Cost Price (Buy)</label>
                    <Input
                      type="number"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      placeholder="0"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                {formData.product_type === 'stockable' && (
                  <div>
                    <label className="form-label">Initial Stock</label>
                    <Input
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      placeholder="0"
                      className="input-field"
                    />
                  </div>
                )}

                {/* Account Linking Section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold text-foreground mb-3">Account Linking</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Revenue Account</label>
                      <SearchableSelect
                        options={revenueAccountOptions}
                        value={formData.revenue_account_id}
                        onChange={(value) => setFormData({ ...formData, revenue_account_id: value })}
                        placeholder="Select revenue account"
                        searchPlaceholder="Search accounts..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">Used when selling this product</p>
                    </div>
                    <div>
                      <label className="form-label">COGS / Expense Account</label>
                      <SearchableSelect
                        options={cogsAccountOptions}
                        value={formData.cogs_account_id}
                        onChange={(value) => setFormData({ ...formData, cogs_account_id: value })}
                        placeholder="Select COGS account"
                        searchPlaceholder="Search accounts..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">Used for cost of goods sold</p>
                    </div>
                  </div>
                </div>

                {/* Pajak & Service per Produk */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold text-foreground mb-1">Pajak & Service</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Pilih tarif Pajak / Service yang otomatis diterapkan saat produk dijual di POS. Master tarif dikelola di menu Tax & Services.
                  </p>
                  {taxRates.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Belum ada tarif. Tambahkan dulu di menu POS &gt; Tax &amp; Services.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {taxRates.map((tax) => {
                        const checked = formData.tax_rate_ids.includes(tax.id);
                        return (
                          <label
                            key={tax.id}
                            className={cn(
                              'flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50',
                              checked && 'border-primary bg-primary/5'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...formData.tax_rate_ids, tax.id]
                                  : formData.tax_rate_ids.filter((id) => id !== tax.id);
                                setFormData({ ...formData, tax_rate_ids: next });
                              }}
                            />
                            <span className="text-sm flex-1">
                              <span className="font-medium">{tax.name}</span>{' '}
                              <span className="text-muted-foreground">({tax.rate}%)</span>
                              <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                                {tax.category}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>



                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                    {editingProduct ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="pl-10 input-field"
          />
        </div>
        <div className="w-full sm:w-48">
          <SearchableSelect
            options={filterTypeOptions}
            value={filterType}
            onChange={setFilterType}
            placeholder="Filter by type"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead className="text-right">Harga Beli</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No products found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || filterType !== 'all'
                        ? 'Try adjusting your search or filter'
                        : 'Get started by adding your first product'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {product.category ? (
                        <span className="text-sm">{product.category.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        product.product_type === 'stockable'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {product.product_type === 'stockable' ? 'Stockable' : product.product_type === 'raw_material' ? 'Raw Material' : 'Service'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(product.unit_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.cost_price)}</TableCell>
                    <TableCell className="text-right">
                      {product.product_type === 'stockable' ? (
                        <span className={cn(
                          product.stock_quantity <= 0 ? 'text-destructive font-medium' : ''
                        )}>
                          {product.stock_quantity} {product.unit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && sortedProducts.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Menampilkan {Math.min((currentPage - 1) * itemsPerPage + 1, sortedProducts.length)} - {Math.min(currentPage * itemsPerPage, sortedProducts.length)} dari {sortedProducts.length} produk
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Halaman {currentPage} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation */}
      <AlertDialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{categoryToDelete?.name}"? 
              This action cannot be undone. Products using this category will be unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <ProductCSVImport
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportSuccess={fetchProducts}
      />
    </div>
  );
};

export default Products;
