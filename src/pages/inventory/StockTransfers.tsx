import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, CheckCircle, XCircle, ArrowRight, Clock, Truck } from 'lucide-react';
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

interface StockTransfer {
  id: string;
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_date: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';
  notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  from_warehouse?: { code: string; name: string };
  to_warehouse?: { code: string; name: string };
  items?: TransferItem[];
}

interface TransferItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: { sku: string; name: string };
}

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', className: 'bg-secondary text-secondary-foreground', icon: Clock },
  pending: { label: 'Menunggu Approval', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Clock },
  approved: { label: 'Disetujui', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  rejected: { label: 'Ditolak', className: 'bg-destructive text-destructive-foreground', icon: XCircle },
  completed: { label: 'Selesai', className: 'bg-primary/10 text-primary', icon: CheckCircle },
};

const StockTransfers: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { warehouses } = useWarehouses();
  const { products } = useProducts();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');

  const [formData, setFormData] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    transfer_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    items: [{ product_id: '', quantity: 1 }],
  });

  const fetchTransfers = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stock_transfers')
      .select(`
        *,
        from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(code, name),
        to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(code, name)
      `)
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Gagal memuat data transfer');
    } else {
      setTransfers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTransfers();
  }, [selectedCompany]);

  const generateTransferNumber = async () => {
    if (!selectedCompany) return '';
    const prefix = `TRF-${format(new Date(), 'yyyyMM')}-`;
    const { count } = await supabase
      .from('stock_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany.id)
      .ilike('transfer_number', `${prefix}%`);
    
    return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    if (formData.from_warehouse_id === formData.to_warehouse_id) {
      toast.error('Gudang asal dan tujuan tidak boleh sama');
      return;
    }

    const transferNumber = await generateTransferNumber();

    const { data: transfer, error } = await supabase
      .from('stock_transfers')
      .insert({
        company_id: selectedCompany.id,
        transfer_number: transferNumber,
        from_warehouse_id: formData.from_warehouse_id,
        to_warehouse_id: formData.to_warehouse_id,
        transfer_date: formData.transfer_date,
        notes: formData.notes || null,
        status: 'pending',
        requested_by: user.id,
      })
      .select()
      .single();

    if (error || !transfer) {
      toast.error('Gagal membuat transfer');
      return;
    }

    const items = formData.items
      .filter(item => item.product_id && item.quantity > 0)
      .map(item => ({
        transfer_id: transfer.id,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('stock_transfer_items')
        .insert(items);

      if (itemsError) {
        toast.error('Gagal menambah item transfer');
        return;
      }
    }

    toast.success('Transfer berhasil dibuat dan menunggu approval');
    setIsDialogOpen(false);
    resetForm();
    fetchTransfers();
  };

  const handleApproval = async () => {
    if (!selectedTransfer || !user) return;

    const newStatus = approvalAction === 'approve' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('stock_transfers')
      .update({
        status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', selectedTransfer.id);

    if (error) {
      toast.error(`Gagal ${approvalAction === 'approve' ? 'menyetujui' : 'menolak'} transfer`);
      return;
    }

    // If approved, complete the transfer and update inventory
    if (newStatus === 'approved') {
      await completeTransfer(selectedTransfer.id);
    }

    toast.success(`Transfer berhasil ${approvalAction === 'approve' ? 'disetujui' : 'ditolak'}`);
    setIsApproveDialogOpen(false);
    fetchTransfers();
  };

  const completeTransfer = async (transferId: string) => {
    // Get transfer items
    const { data: items } = await supabase
      .from('stock_transfer_items')
      .select('product_id, quantity')
      .eq('transfer_id', transferId);

    if (!items || !selectedTransfer) return;

    // Update inventory for each item
    for (const item of items) {
      // Decrease from source warehouse
      const { data: fromStock } = await supabase
        .from('inventory_stock')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('warehouse_id', selectedTransfer.from_warehouse_id)
        .single();

      if (fromStock) {
        await supabase
          .from('inventory_stock')
          .update({ quantity: fromStock.quantity - item.quantity })
          .eq('id', fromStock.id);
      }

      // Increase in destination warehouse
      const { data: toStock } = await supabase
        .from('inventory_stock')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('warehouse_id', selectedTransfer.to_warehouse_id)
        .single();

      if (toStock) {
        await supabase
          .from('inventory_stock')
          .update({ quantity: toStock.quantity + item.quantity })
          .eq('id', toStock.id);
      } else {
        await supabase
          .from('inventory_stock')
          .insert({
            product_id: item.product_id,
            warehouse_id: selectedTransfer.to_warehouse_id,
            quantity: item.quantity,
          });
      }
    }

    // Mark as completed
    await supabase
      .from('stock_transfers')
      .update({ status: 'completed' })
      .eq('id', transferId);
  };

  const viewDetail = async (transfer: StockTransfer) => {
    const { data: items } = await supabase
      .from('stock_transfer_items')
      .select(`
        *,
        product:products(sku, name)
      `)
      .eq('transfer_id', transfer.id);

    setSelectedTransfer({ ...transfer, items: items || [] });
    setIsDetailDialogOpen(true);
  };

  const openApproveDialog = (transfer: StockTransfer, action: 'approve' | 'reject') => {
    setSelectedTransfer(transfer);
    setApprovalAction(action);
    setIsApproveDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      from_warehouse_id: '',
      to_warehouse_id: '',
      transfer_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      items: [{ product_id: '', quantity: 1 }],
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1 }],
    });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index),
      });
    }
  };

  const warehouseOptions = warehouses.map(w => ({
    value: w.id,
    label: `${w.code} - ${w.name}`,
  }));

  const productOptions = products.map(p => ({
    value: p.id,
    label: `${p.sku} - ${p.name}`,
  }));

  const filteredTransfers = transfers.filter(t =>
    t.transfer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.from_warehouse?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.to_warehouse?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if current user is PIC of the destination warehouse
  const canApprove = (transfer: StockTransfer) => {
    if (transfer.status !== 'pending') return false;
    const destWarehouse = warehouses.find(w => w.id === transfer.to_warehouse_id);
    return destWarehouse?.pic_user_id === user?.id;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Stock Transfers</h1>
          <p className="text-muted-foreground mt-1">Kelola mutasi barang antar gudang</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Buat Transfer
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari transfer..."
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
                <TableHead>No. Transfer</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Dari</TableHead>
                <TableHead></TableHead>
                <TableHead>Ke</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-pulse">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : filteredTransfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Belum ada transfer</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransfers.map(transfer => {
                  const config = statusConfig[transfer.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-mono font-medium">{transfer.transfer_number}</TableCell>
                      <TableCell>{format(new Date(transfer.transfer_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{transfer.from_warehouse?.name}</TableCell>
                      <TableCell><ArrowRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                      <TableCell>{transfer.to_warehouse?.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => viewDetail(transfer)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canApprove(transfer) && (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-green-600"
                                onClick={() => openApproveDialog(transfer, 'approve')}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-destructive"
                                onClick={() => openApproveDialog(transfer, 'reject')}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Transfer Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gudang Asal *</Label>
                <SearchableSelect
                  options={warehouseOptions}
                  value={formData.from_warehouse_id}
                  onChange={(value) => setFormData({ ...formData, from_warehouse_id: value })}
                  placeholder="Pilih gudang asal"
                />
              </div>
              <div className="space-y-2">
                <Label>Gudang Tujuan *</Label>
                <SearchableSelect
                  options={warehouseOptions}
                  value={formData.to_warehouse_id}
                  onChange={(value) => setFormData({ ...formData, to_warehouse_id: value })}
                  placeholder="Pilih gudang tujuan"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Transfer</Label>
              <Input
                type="date"
                value={formData.transfer_date}
                onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Item Transfer</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah Item
                </Button>
              </div>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <SearchableSelect
                        options={productOptions}
                        value={item.product_id}
                        onChange={(value) => updateItem(index, 'product_id', value)}
                        placeholder="Pilih produk"
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        placeholder="Qty"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit">Kirim untuk Approval</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Transfer {selectedTransfer?.transfer_number}</DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Dari Gudang</p>
                  <p className="font-medium">{selectedTransfer.from_warehouse?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ke Gudang</p>
                  <p className="font-medium">{selectedTransfer.to_warehouse?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="font-medium">{format(new Date(selectedTransfer.transfer_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedTransfer.status].className}`}>
                    {statusConfig[selectedTransfer.status].label}
                  </span>
                </div>
              </div>
              
              {selectedTransfer.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Catatan</p>
                  <p className="text-sm">{selectedTransfer.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Item Transfer</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTransfer.items?.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name || item.product_id}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalAction === 'approve' ? 'Setujui Transfer?' : 'Tolak Transfer?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approvalAction === 'approve' 
                ? 'Transfer akan diproses dan stok akan dipindahkan ke gudang tujuan.'
                : 'Transfer akan ditolak dan tidak akan diproses.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApproval}
              className={approvalAction === 'reject' ? 'bg-destructive text-destructive-foreground' : ''}
            >
              {approvalAction === 'approve' ? 'Setujui' : 'Tolak'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockTransfers;
