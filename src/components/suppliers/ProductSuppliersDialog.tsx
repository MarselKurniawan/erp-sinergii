import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProductSupplier {
  id?: string;
  product_id: string;
  supplier_id: string;
  cost_price: number;
  is_primary: boolean;
  product_name?: string;
  product_sku?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
}

export function ProductSuppliersDialog({ open, onOpenChange, supplierId, supplierName }: Props) {
  const { products } = useProducts();
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProductSuppliers = async () => {
    if (!supplierId) return;

    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('product_suppliers')
      .select('*')
      .eq('supplier_id', supplierId);

    if (!error && data) {
      // Get product details for each
      const withProducts = await Promise.all(
        data.map(async (ps) => {
          const { data: productData } = await supabase
            .from('products')
            .select('name, sku')
            .eq('id', ps.product_id)
            .single();
          
          return {
            ...ps,
            product_name: productData?.name,
            product_sku: productData?.sku,
          };
        })
      );
      setProductSuppliers(withProducts);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (open && supplierId) {
      fetchProductSuppliers();
    }
  }, [open, supplierId]);

  const addProductSupplier = () => {
    setProductSuppliers([...productSuppliers, {
      product_id: '',
      supplier_id: supplierId,
      cost_price: 0,
      is_primary: false,
    }]);
  };

  const updateProductSupplier = (index: number, field: keyof ProductSupplier, value: any) => {
    const updated = [...productSuppliers];
    updated[index] = { ...updated[index], [field]: value };
    setProductSuppliers(updated);
  };

  const removeProductSupplier = async (index: number) => {
    const item = productSuppliers[index];
    
    if (item.id) {
      const { error } = await supabase
        .from('product_suppliers')
        .delete()
        .eq('id', item.id);

      if (error) {
        toast.error('Gagal menghapus: ' + error.message);
        return;
      }
    }

    setProductSuppliers(productSuppliers.filter((_, i) => i !== index));
    toast.success('Produk dihapus dari supplier');
  };

  const handleSave = async () => {
    try {
      // Validate
      for (const ps of productSuppliers) {
        if (!ps.product_id) {
          toast.error('Pilih semua produk');
          return;
        }
      }

      // Check for duplicates
      const productIds = productSuppliers.map(ps => ps.product_id);
      if (new Set(productIds).size !== productIds.length) {
        toast.error('Ada produk yang duplikat');
        return;
      }

      // Separate new and existing
      const newItems = productSuppliers.filter(ps => !ps.id);
      const existingItems = productSuppliers.filter(ps => ps.id);

      // Update existing
      for (const item of existingItems) {
        const { error } = await supabase
          .from('product_suppliers')
          .update({
            cost_price: item.cost_price,
            is_primary: item.is_primary,
          })
          .eq('id', item.id);

        if (error) throw error;
      }

      // Insert new
      if (newItems.length > 0) {
        const { error } = await supabase
          .from('product_suppliers')
          .insert(newItems.map(item => ({
            product_id: item.product_id,
            supplier_id: supplierId,
            cost_price: item.cost_price,
            is_primary: item.is_primary,
          })));

        if (error) throw error;
      }

      toast.success('Data produk supplier berhasil disimpan');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Gagal menyimpan: ' + error.message);
    }
  };

  // Filter products that can be purchased (raw materials)
  const availableProducts = products.filter(p => p.product_type === 'raw_material');

  const productOptions = availableProducts.map(p => ({
    value: p.id,
    label: `${p.sku} - ${p.name}`
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Produk dari Supplier: {supplierName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={addProductSupplier}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Produk
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Memuat...</div>
          ) : productSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <p>Belum ada produk untuk supplier ini</p>
              <p className="text-sm">Klik "Tambah Produk" untuk menambahkan</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="w-32">Harga Beli</TableHead>
                    <TableHead className="w-24 text-center">Utama</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSuppliers.map((ps, index) => (
                    <TableRow key={ps.id || index}>
                      <TableCell>
                        {ps.id ? (
                          <span className="text-sm">
                            {ps.product_sku} - {ps.product_name}
                          </span>
                        ) : (
                          <SearchableSelect
                            options={productOptions}
                            value={ps.product_id}
                            onChange={(value) => updateProductSupplier(index, 'product_id', value)}
                            placeholder="Pilih produk"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={ps.cost_price}
                          onChange={(e) => updateProductSupplier(index, 'cost_price', parseFloat(e.target.value) || 0)}
                          min="0"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={ps.is_primary}
                          onCheckedChange={(checked) => updateProductSupplier(index, 'is_primary', checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProductSupplier(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
            <Button onClick={handleSave}>
              Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
