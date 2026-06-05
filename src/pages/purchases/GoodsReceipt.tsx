import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Package, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface GoodsReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  purchase_order_id: string;
  notes: string | null;
  created_at: string;
  purchase_orders?: {
    id: string;
    order_number: string;
    total_amount: number;
    suppliers?: { id: string; code: string; name: string };
  };
}

interface ReceiptItem {
  product_id: string;
  product_name?: string;
  quantity_ordered: number;
  quantity_received: number;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  supplier_id: string;
  status: string;
  total_amount: number;
  suppliers?: { id: string; code: string; name: string };
}

interface OrderItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

export const GoodsReceipt: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<GoodsReceipt | null>(null);
  const [viewingItems, setViewingItems] = useState<ReceiptItem[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [notes, setNotes] = useState('');

  const fetchReceipts = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('goods_receipts')
      .select(`
        *,
        purchase_orders(id, order_number, total_amount, suppliers(id, code, name))
      `)
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching goods receipts:', error);
      toast.error('Failed to load goods receipts');
    } else {
      setReceipts(data || []);
    }
    setIsLoading(false);
  };

  const fetchConfirmedOrders = async () => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(id, code, name)')
      .eq('company_id', selectedCompany.id)
      .eq('status', 'confirmed')
      .order('order_date', { ascending: false });

    setConfirmedOrders(data || []);
  };

  useEffect(() => {
    fetchReceipts();
    fetchConfirmedOrders();
  }, [selectedCompany]);

  const handleOrderSelect = async (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = confirmedOrders.find(o => o.id === orderId);
    setSelectedOrder(order || null);

    if (orderId) {
      const { data } = await supabase
        .from('purchase_order_items')
        .select('*, products(name)')
        .eq('purchase_order_id', orderId);

      const items = (data || []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      setOrderItems(items);

      // Initialize receipt items with ordered quantities
      setReceiptItems(items.map((item: OrderItem) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_ordered: item.quantity,
        quantity_received: item.quantity, // Default to full qty
      })));
    } else {
      setOrderItems([]);
      setReceiptItems([]);
    }
  };

  const updateReceivedQty = (index: number, qty: number) => {
    setReceiptItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], quantity_received: qty };
      return newItems;
    });
  };

  const generateReceiptNumber = () => {
    const date = new Date();
    const prefix = 'GR';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${prefix}-${year}${month}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user || !selectedOrderId) return;

    const receiptNumber = generateReceiptNumber();

    // Create goods receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('goods_receipts')
      .insert({
        company_id: selectedCompany.id,
        purchase_order_id: selectedOrderId,
        receipt_number: receiptNumber,
        receipt_date: new Date().toISOString().split('T')[0],
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (receiptError) {
      toast.error('Failed to create goods receipt');
      return;
    }

    // Insert receipt items
    const itemsData = receiptItems.map(item => ({
      receipt_id: receipt.id,
      product_id: item.product_id,
      quantity_ordered: item.quantity_ordered,
      quantity_received: item.quantity_received,
    }));

    const { error: itemsError } = await supabase
      .from('goods_receipt_items')
      .insert(itemsData);

    if (itemsError) {
      toast.error('Failed to save receipt items');
      return;
    }

    // Update PO status to 'received'
    await supabase
      .from('purchase_orders')
      .update({ status: 'received' })
      .eq('id', selectedOrderId);

    // Update product stock quantities
    for (const item of receiptItems) {
      if (item.quantity_received > 0) {
        // Get current stock
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ 
              stock_quantity: (product.stock_quantity || 0) + item.quantity_received 
            })
            .eq('id', item.product_id);
        }
      }
    }

    toast.success(`Goods Receipt ${receiptNumber} created successfully`);
    fetchReceipts();
    fetchConfirmedOrders();
    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setSelectedOrderId('');
    setSelectedOrder(null);
    setOrderItems([]);
    setReceiptItems([]);
    setNotes('');
  };

  const handleView = async (receipt: GoodsReceipt) => {
    setViewingReceipt(receipt);

    const { data } = await supabase
      .from('goods_receipt_items')
      .select('*, products(name)')
      .eq('receipt_id', receipt.id);

    setViewingItems(
      (data || []).map((item: any) => ({
        ...item,
        product_name: item.products?.name,
      }))
    );
    setIsViewDialogOpen(true);
  };

  const handleCreateBill = async (receipt: GoodsReceipt) => {
    if (!confirm(`Buat Bill otomatis dari GR ${receipt.receipt_number}?`)) return;
    const { data, error } = await supabase.rpc('create_bill_from_goods_receipt', {
      p_gr_id: receipt.id,
    });
    if (error) {
      toast.error(error.message || 'Gagal membuat bill');
      return;
    }
    toast.success('Bill berhasil dibuat dari GR');
  };

  const filteredReceipts = receipts.filter(receipt =>
    receipt.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    receipt.purchase_orders?.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    receipt.purchase_orders?.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Goods Receipt</h1>
          <p className="text-muted-foreground mt-1">Receive goods from confirmed purchase orders</p>
        </div>

        <Button
          className="gradient-primary text-primary-foreground shadow-glow"
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          disabled={confirmedOrders.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Receipt
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Receipts</p>
                <p className="text-2xl font-bold">{receipts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <CheckCircle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
                <p className="text-2xl font-bold">{confirmedOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search receipts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Receipts Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No goods receipts yet</h3>
            <p className="text-muted-foreground">
              {confirmedOrders.length === 0
                ? 'Confirm a purchase order first to create a goods receipt'
                : 'Create your first goods receipt to start receiving goods'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">Receipt #</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">PO Number</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Supplier</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Date</th>
                    <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-muted/30 transition-fast">
                      <td className="px-4 py-3 font-mono text-sm">{receipt.receipt_number}</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {receipt.purchase_orders?.order_number}
                      </td>
                      <td className="px-4 py-3">
                        {receipt.purchase_orders?.suppliers?.name}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(receipt.receipt_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleView(receipt)} title="Lihat detail">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            title="Buat Bill dari GR ini"
                            onClick={() => handleCreateBill(receipt)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Receipt Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Goods Receipt</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div>
              <label className="form-label">Select Purchase Order</label>
              <SearchableSelect
                options={confirmedOrders.map(order => ({
                  value: order.id,
                  label: `${order.order_number} - ${order.suppliers?.name}`
                }))}
                value={selectedOrderId}
                onChange={handleOrderSelect}
                placeholder="Select confirmed PO"
                searchPlaceholder="Search orders..."
              />
            </div>

            {selectedOrder && (
              <>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Order Number:</span>
                      <span className="ml-2 font-medium">{selectedOrder.order_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Supplier:</span>
                      <span className="ml-2 font-medium">{selectedOrder.suppliers?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="ml-2 font-medium">{formatCurrency(selectedOrder.total_amount)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label mb-3">Items to Receive</label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-center">Ordered</th>
                          <th className="px-3 py-2 text-center">Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptItems.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{item.product_name}</td>
                            <td className="px-3 py-2 text-center">{item.quantity_ordered}</td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity_ordered}
                                value={item.quantity_received}
                                onChange={(e) => updateReceivedQty(index, Number(e.target.value))}
                                className="w-24 mx-auto text-center"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="form-label">Notes (Optional)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about this receipt..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                    <Package className="w-4 h-4 mr-2" />
                    Receive Goods
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Goods Receipt Details</DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Receipt Number</p>
                  <p className="font-mono font-semibold">{viewingReceipt.receipt_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <p className="font-mono">{viewingReceipt.purchase_orders?.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{viewingReceipt.purchase_orders?.suppliers?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p>{formatDate(viewingReceipt.receipt_date)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-center">Ordered</th>
                      <th className="px-3 py-2 text-center">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingItems.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2 text-center">{item.quantity_ordered}</td>
                        <td className="px-3 py-2 text-center font-medium">{item.quantity_received}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewingReceipt.notes && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p>{viewingReceipt.notes}</p>
                </div>
              )}

              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoodsReceipt;
