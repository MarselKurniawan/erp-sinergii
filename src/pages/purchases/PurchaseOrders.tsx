import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, FileText, Trash2, Package, Wallet, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { AccountValidationAlert } from '@/components/accounting/AccountValidationAlert';
import { DownPaymentDialog } from '@/components/orders/DownPaymentDialog';
import { generateDocumentNumber } from '@/lib/documentNumber';

interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  due_date: string | null;
  supplier_id: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  dp_amount: number;
  dp_paid: number;
  approval_status?: string;
  approved_at?: string | null;
  rejection_reason?: string | null;
  notes: string | null;
  suppliers?: { id: string; code: string; name: string };
}

interface OrderItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  total: number;
}

export const PurchaseOrders: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { products } = useProducts();
  const { suppliers } = useSuppliers();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [viewingItems, setViewingItems] = useState<OrderItem[]>([]);
  const [isDpDialogOpen, setIsDpDialogOpen] = useState(false);
  const [dpOrder, setDpOrder] = useState<PurchaseOrder | null>(null);

  const [formData, setFormData] = useState({
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 11, total: 0 },
  ]);

  const fetchOrders = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(id, code, name)')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchase orders:', error);
      toast.error('Failed to load purchase orders');
    } else {
      setOrders(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedCompany]);

  const generateOrderNumber = async () => {
    if (!selectedCompany) return 'PO-000000-0000';
    return await generateDocumentNumber(selectedCompany.id, 'PO');
  };

  const calculateItemTotal = (item: OrderItem) => {
    const subtotal = item.quantity * item.unit_price;
    const discount = subtotal * (item.discount_percent / 100);
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * (item.tax_percent / 100);
    return afterDiscount + tax;
  };

  const updateItemTotal = (index: number, updates: Partial<OrderItem>) => {
    setOrderItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], ...updates };
      newItems[index].total = calculateItemTotal(newItems[index]);
      return newItems;
    });
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItemTotal(index, {
        product_id: productId,
        unit_price: product.cost_price, // Use cost_price for purchases
        product_name: product.name,
      });
    }
  };

  const addOrderItem = () => {
    setOrderItems((prev) => [
      ...prev,
      { product_id: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 11, total: 0 },
    ]);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const totalDiscount = orderItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price * (item.discount_percent / 100),
      0
    );
    const afterDiscount = subtotal - totalDiscount;
    const taxAmount = orderItems.reduce(
      (sum, item) =>
        sum +
        (item.quantity * item.unit_price - item.quantity * item.unit_price * (item.discount_percent / 100)) *
          (item.tax_percent / 100),
      0
    );
    return { subtotal: afterDiscount, taxAmount, total: afterDiscount + taxAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    const validItems = orderItems.filter((item) => item.product_id);
    if (validItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    const totals = calculateTotals();
    const orderNumber = await generateOrderNumber();

    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        company_id: selectedCompany.id,
        supplier_id: formData.supplier_id,
        order_number: orderNumber,
        order_date: formData.order_date,
        due_date: formData.due_date || null,
        status: 'draft',
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes: formData.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (orderError) {
      toast.error('Failed to create purchase order');
      return;
    }

    const itemsData = validItems.map((item) => ({
      purchase_order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      tax_percent: item.tax_percent,
      total: item.total,
    }));

    const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsData);

    if (itemsError) {
      toast.error('Failed to save order items');
    } else {
      toast.success('Purchase order created successfully');
      fetchOrders();
      resetForm();
      setIsDialogOpen(false);
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      order_date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: '',
    });
    setOrderItems([{ product_id: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 11, total: 0 }]);
  };

  const handleView = async (order: PurchaseOrder) => {
    setViewingOrder(order);
    
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*, products(name)')
      .eq('purchase_order_id', order.id);

    setViewingItems(
      (data || []).map((item: any) => ({
        ...item,
        product_name: item.products?.name,
      }))
    );
    setIsViewDialogOpen(true);
  };

  const handleConfirmOrder = async (order: PurchaseOrder) => {
    if (order.approval_status !== 'approved') {
      toast.error('Purchase Order harus di-approve dulu di Approval Center sebelum bisa dikonfirmasi');
      return;
    }

    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'confirmed' })
      .eq('id', order.id);

    if (error) {
      toast.error('Failed to confirm order');
    } else {
      toast.success('Order confirmed');
      fetchOrders();
      setIsViewDialogOpen(false);
    }
  };

  const handleOpenDpDialog = (order: PurchaseOrder) => {
    setDpOrder(order);
    setIsDpDialogOpen(true);
  };

  const handleGenerateBill = async (order: PurchaseOrder) => {
    if (!selectedCompany || !user) return;
    if (order.approval_status !== 'approved') {
      toast.error('Purchase Order harus di-approve dulu sebelum dibuatkan Bill');
      return;
    }

    // Calculate bill amount (minus DP already paid)
    const dpPaid = order.dp_paid || 0;
    const billTotal = order.total_amount - dpPaid;

    const billNumber = await generateDocumentNumber(selectedCompany.id, 'BILL');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        company_id: selectedCompany.id,
        supplier_id: order.supplier_id,
        purchase_order_id: order.id,
        bill_number: billNumber,
        bill_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'sent',
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total_amount: billTotal, // Reduced by DP
        outstanding_amount: billTotal,
        paid_amount: 0,
        notes: dpPaid > 0 ? `${order.notes || ''}\nDP sudah dibayar: ${formatCurrency(dpPaid)}` : order.notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (billError) {
      toast.error('Failed to generate bill');
      return;
    }

    await supabase.from('purchase_orders').update({ status: 'invoiced' }).eq('id', order.id);

    // Create journal entry for accounts payable
    const entryNumber = await generateDocumentNumber(selectedCompany.id, 'JE');
    
    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: selectedCompany.id,
        entry_number: entryNumber,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Bill ${billNumber} - ${order.suppliers?.name || 'Supplier'}`,
        reference_type: 'bill',
        reference_id: bill.id,
        is_posted: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (!journalError && journalEntry) {
      // Get inventory/expense and payable accounts
      const { data: inventoryAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('account_type', 'asset')
        .or('name.ilike.%inventory%,name.ilike.%persediaan%')
        .limit(1)
        .single();

      const { data: payableAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('account_type', 'liability')
        .or('name.ilike.%payable%,name.ilike.%hutang%')
        .limit(1)
        .single();

      if (inventoryAccount && payableAccount) {
        await supabase.from('journal_entry_lines').insert([
          {
            journal_entry_id: journalEntry.id,
            account_id: inventoryAccount.id,
            debit_amount: order.total_amount,
            credit_amount: 0,
            description: 'Inventory / Purchases',
          },
          {
            journal_entry_id: journalEntry.id,
            account_id: payableAccount.id,
            debit_amount: 0,
            credit_amount: order.total_amount,
            description: 'Accounts Payable',
          },
        ]);
      }
    }

    toast.success(`Bill ${billNumber} generated successfully`);
    fetchOrders();
    setIsViewDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete order');
    } else {
      toast.success('Order deleted successfully');
      fetchOrders();
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <AccountValidationAlert requiredAccountTypes={['payable', 'expense', 'tax', 'discount']} />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Manage your purchase orders</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Supplier</label>
                  <SearchableSelect
                    options={suppliers.map(sup => ({ value: sup.id, label: `${sup.code} - ${sup.name}` }))}
                    value={formData.supplier_id}
                    onChange={(value) => setFormData({ ...formData, supplier_id: value })}
                    placeholder="Select supplier"
                    searchPlaceholder="Search suppliers..."
                  />
                </div>
                <div>
                  <label className="form-label">Order Date</label>
                  <Input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Due Date</label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="form-label mb-0">Order Items</label>
                  <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-center w-20">Qty</th>
                        <th className="px-3 py-2 text-right w-32">Unit Price</th>
                        <th className="px-3 py-2 text-center w-20">Disc %</th>
                        <th className="px-3 py-2 text-center w-20">Tax %</th>
                        <th className="px-3 py-2 text-right w-32">Total</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">
                            <SearchableSelect
                              options={products.map(prod => ({ value: prod.id, label: `${prod.sku} - ${prod.name}` }))}
                              value={item.product_id}
                              onChange={(value) => handleProductChange(index, value)}
                              placeholder="Select product"
                              searchPlaceholder="Search products..."
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItemTotal(index, { quantity: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-center"
                              min={1}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateItemTotal(index, { unit_price: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={item.discount_percent}
                              onChange={(e) => updateItemTotal(index, { discount_percent: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-center"
                              min={0}
                              max={100}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={item.tax_percent}
                              onChange={(e) => updateItemTotal(index, { tax_percent: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-center"
                              min={0}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOrderItem(index)}
                              className="h-8 w-8 p-0 text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(totals.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  Create Order
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="pl-10 input-field"
          />
        </div>
        <div className="w-full sm:w-48">
          <SearchableSelect
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'invoiced', label: 'Billed' },
              { value: 'paid', label: 'Paid' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filter by status"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading purchase orders...</div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Truck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No purchase orders found</h3>
              <p className="text-muted-foreground">Start by creating your first purchase order</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">DP Paid</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="font-mono font-medium">{order.order_number}</td>
                      <td>{formatDate(order.order_date)}</td>
                      <td>{order.suppliers?.name}</td>
                      <td>
                        <span className={cn('badge-status capitalize', getStatusBadgeClass(order.status))}>
                          {order.status === 'invoiced' ? 'Billed' : order.status}
                        </span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(order.total_amount || 0)}</td>
                      <td className="text-right">
                        {(order.dp_paid || 0) > 0 ? (
                          <span className="text-destructive font-medium">{formatCurrency(order.dp_paid)}</span>
                        ) : '-'}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleView(order)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(order.status === 'draft' || order.status === 'confirmed') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDpDialog(order)}
                              className="text-warning"
                              title="Input Down Payment"
                            >
                              <Wallet className="w-4 h-4" />
                            </Button>
                          )}
                          {order.status === 'received' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateBill(order)}
                              className="text-primary"
                              title="Generate Bill"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                          {order.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(order.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
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

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-mono font-semibold">{viewingOrder.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={cn('badge-status capitalize', getStatusBadgeClass(viewingOrder.status))}>
                    {viewingOrder.status === 'invoiced' ? 'Billed' : viewingOrder.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{viewingOrder.suppliers?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p>{formatDate(viewingOrder.order_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p>{viewingOrder.due_date ? formatDate(viewingOrder.due_date) : '-'}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-center">Disc %</th>
                      <th className="px-3 py-2 text-center">Tax %</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingItems.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 text-center">{item.discount_percent}%</td>
                        <td className="px-3 py-2 text-center">{item.tax_percent}%</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(viewingOrder.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(viewingOrder.tax_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(viewingOrder.total_amount || 0)}</span>
                </div>
                {(viewingOrder.dp_paid || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-destructive">
                      <span>Down Payment</span>
                      <span>-{formatCurrency(viewingOrder.dp_paid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Sisa (Bill Amount)</span>
                      <span>{formatCurrency(viewingOrder.total_amount - viewingOrder.dp_paid)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                {(viewingOrder.status === 'draft' || viewingOrder.status === 'confirmed') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleOpenDpDialog(viewingOrder);
                    }}
                    className="flex-1"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Input DP
                  </Button>
                )}
                {viewingOrder.status === 'draft' && (
                  <Button onClick={() => handleConfirmOrder(viewingOrder.id)} className="flex-1">
                    Confirm Order
                  </Button>
                )}
                {viewingOrder.status === 'confirmed' && (
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/purchases/receipts'}
                    className="flex-1"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Go to Receive
                  </Button>
                )}
                {viewingOrder.status === 'received' && (
                  <Button onClick={() => handleGenerateBill(viewingOrder)} className="flex-1 gradient-primary text-primary-foreground">
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Bill
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Down Payment Dialog */}
      {dpOrder && (
        <DownPaymentDialog
          open={isDpDialogOpen}
          onOpenChange={setIsDpDialogOpen}
          type="purchase"
          orderId={dpOrder.id}
          orderNumber={dpOrder.order_number}
          totalAmount={dpOrder.total_amount}
          dpPaid={dpOrder.dp_paid || 0}
          customerOrSupplierName={dpOrder.suppliers?.name || ''}
          onSuccess={() => {
            fetchOrders();
            setDpOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default PurchaseOrders;
