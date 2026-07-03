import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, CheckCircle, ClipboardList, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useProducts } from '@/hooks/useProducts';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface StockOpname {
  id: string;
  opname_number: string;
  warehouse_id: string;
  opname_date: string;
  status: 'draft' | 'in_progress' | 'completed';
  notes: string | null;
  created_by: string | null;
  completed_at: string | null;
  warehouse?: { code: string; name: string };
  items?: OpnameItem[];
}

interface OpnameItem {
  id: string;
  product_id: string;
  system_quantity: number;
  actual_quantity: number;
  difference: number;
  notes: string | null;
  product?: { sku: string; name: string };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-secondary text-secondary-foreground' },
  in_progress: { label: 'Sedang Berjalan', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  completed: { label: 'Selesai', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
};

const StockOpname: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { warehouses } = useWarehouses();
  const { products } = useProducts();
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedOpname, setSelectedOpname] = useState<StockOpname | null>(null);

  const [formData, setFormData] = useState({
    warehouse_id: '',
    opname_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const [opnameItems, setOpnameItems] = useState<{
    product_id: string;
    system_quantity: number;
    actual_quantity: number;
    notes: string;
  }[]>([]);

  const fetchOpnames = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stock_opname')
      .select(`
        *,
        warehouse:warehouses(code, name)
      `)
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Gagal memuat data stock opname');
    } else {
      setOpnames(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOpnames();
  }, [selectedCompany]);

  const generateOpnameNumber = async () => {
    if (!selectedCompany) return '';
    const prefix = `OPN-${format(new Date(), 'yyyyMM')}-`;
    const { count } = await supabase
      .from('stock_opname')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany.id)
      .ilike('opname_number', `${prefix}%`);
    
    return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const handleCreateOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    const opnameNumber = await generateOpnameNumber();

    // Get current stock for selected warehouse
    const { data: stockData } = await supabase
      .from('inventory_stock')
      .select('product_id, quantity')
      .eq('warehouse_id', formData.warehouse_id);

    const { data: opname, error } = await supabase
      .from('stock_opname')
      .insert({
        company_id: selectedCompany.id,
        opname_number: opnameNumber,
        warehouse_id: formData.warehouse_id,
        opname_date: formData.opname_date,
        notes: formData.notes || null,
        status: 'in_progress',
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !opname) {
      toast.error('Gagal membuat stock opname');
      return;
    }

    // Create opname items for all products with their system quantities
    const items = products.map(product => {
      const stock = stockData?.find(s => s.product_id === product.id);
      return {
        opname_id: opname.id,
        product_id: product.id,
        system_quantity: stock?.quantity || 0,
        actual_quantity: stock?.quantity || 0,
      };
    });

    if (items.length > 0) {
      await supabase.from('stock_opname_items').insert(items);
    }

    toast.success('Stock opname berhasil dibuat');
    setIsDialogOpen(false);
    resetForm();
    fetchOpnames();
  };

  const viewDetail = async (opname: StockOpname) => {
    const { data: items } = await supabase
      .from('stock_opname_items')
      .select(`
        *,
        product:products(sku, name)
      `)
      .eq('opname_id', opname.id);

    setSelectedOpname({ ...opname, items: items || [] });
    setOpnameItems((items || []).map(item => ({
      product_id: item.product_id,
      system_quantity: item.system_quantity,
      actual_quantity: item.actual_quantity,
      notes: item.notes || '',
    })));
    setIsDetailDialogOpen(true);
  };

  const updateActualQuantity = (productId: string, quantity: number) => {
    setOpnameItems(items => items.map(item => 
      item.product_id === productId 
        ? { ...item, actual_quantity: quantity }
        : item
    ));
  };

  const saveOpnameItems = async () => {
    if (!selectedOpname) return;

    for (const item of opnameItems) {
      await supabase
        .from('stock_opname_items')
        .update({ actual_quantity: item.actual_quantity })
        .eq('opname_id', selectedOpname.id)
        .eq('product_id', item.product_id);
    }

    toast.success('Data opname berhasil disimpan');
    fetchOpnames();
  };

  const completeOpname = async () => {
    if (!selectedOpname) return;

    // Save current items first
    await saveOpnameItems();

    // Update inventory based on actual quantities
    for (const item of opnameItems) {
      const { data: existingStock } = await supabase
        .from('inventory_stock')
        .select('id')
        .eq('product_id', item.product_id)
        .eq('warehouse_id', selectedOpname.warehouse_id)
        .single();

      if (existingStock) {
        await supabase
          .from('inventory_stock')
          .update({ quantity: item.actual_quantity })
          .eq('id', existingStock.id);
      } else {
        await supabase
          .from('inventory_stock')
          .insert({
            product_id: item.product_id,
            warehouse_id: selectedOpname.warehouse_id,
            quantity: item.actual_quantity,
          });
      }
    }

    // Mark opname as completed
    await supabase
      .from('stock_opname')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', selectedOpname.id);

    toast.success('Stock opname selesai, inventory telah diperbarui');
    setIsDetailDialogOpen(false);
    fetchOpnames();
  };

  const resetForm = () => {
    setFormData({
      warehouse_id: '',
      opname_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
  };

  const warehouseOptions = warehouses.map(w => ({
    value: w.id,
    label: `${w.code} - ${w.name}`,
  }));

  const filteredOpnames = opnames.filter(o =>
    o.opname_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.warehouse?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Stock Opname</h1>
          <p className="text-muted-foreground mt-1">Kelola penghitungan stok fisik</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Buat Opname
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari opname..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Opname</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Gudang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="animate-pulse">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : filteredOpnames.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Belum ada stock opname</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOpnames.map(opname => {
                  const config = statusConfig[opname.status];
                  return (
                    <TableRow key={opname.id}>
                      <TableCell className="font-mono font-medium">{opname.opname_number}</TableCell>
                      <TableCell>{format(new Date(opname.opname_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{opname.warehouse?.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
                          {config.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => viewDetail(opname)}>
                          {opname.status === 'in_progress' ? (
                            <><Play className="w-4 h-4 mr-1" /> Lanjutkan</>
                          ) : (
                            <><Eye className="w-4 h-4 mr-1" /> Lihat</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Opname Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Stock Opname Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOpname} className="space-y-4">
            <div className="space-y-2">
              <Label>Gudang *</Label>
              <SearchableSelect
                options={warehouseOptions}
                value={formData.warehouse_id}
                onChange={(value) => setFormData({ ...formData, warehouse_id: value })}
                placeholder="Pilih gudang"
              />
            </div>

            <div className="space-y-2">
              <Label>Tanggal Opname</Label>
              <Input
                type="date"
                value={formData.opname_date}
                onChange={(e) => setFormData({ ...formData, opname_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Catatan tambahan..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={!formData.warehouse_id}>Mulai Opname</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail/Edit Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Stock Opname {selectedOpname?.opname_number}
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedOpname?.status || 'draft'].className}`}>
                {statusConfig[selectedOpname?.status || 'draft'].label}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedOpname && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Gudang</p>
                  <p className="font-medium">{selectedOpname.warehouse?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="font-medium">{format(new Date(selectedOpname.opname_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedOpname.status].className}`}>
                    {statusConfig[selectedOpname.status].label}
                  </span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Qty Sistem</TableHead>
                    <TableHead className="text-right">Qty Aktual</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOpname.items?.map(item => {
                    const opnameItem = opnameItems.find(i => i.product_id === item.product_id);
                    const difference = (opnameItem?.actual_quantity || 0) - item.system_quantity;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.product?.sku}</TableCell>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell className="text-right">{item.system_quantity}</TableCell>
                        <TableCell className="text-right">
                          {selectedOpname.status === 'in_progress' ? (
                            <Input
                              type="number"
                              min="0"
                              value={opnameItem?.actual_quantity || 0}
                              onChange={(e) => updateActualQuantity(item.product_id, parseInt(e.target.value) || 0)}
                              className="w-24 text-right ml-auto"
                            />
                          ) : (
                            item.actual_quantity
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={
                            difference > 0 ? 'text-green-600' :
                            difference < 0 ? 'text-destructive' : ''
                          }>
                            {difference > 0 ? '+' : ''}{difference}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {selectedOpname.status === 'in_progress' && (
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={saveOpnameItems}>
                    Simpan Progress
                  </Button>
                  <Button onClick={completeOpname} className="gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Selesaikan Opname
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockOpname;
