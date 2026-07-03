import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, FileText, Trash2, ShoppingCart, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { generateDocumentNumber } from '@/lib/documentNumber';
import { logActivity } from '@/lib/activityLog';
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

interface Customer {
  id: string;
  code: string;
  name: string;
}

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  due_date: string | null;
  customer_id: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  dp_amount: number;
  dp_paid: number;
  notes: string | null;
  customers?: Customer;
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

export const SalesOrders: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { products } = useProducts();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<SalesOrder | null>(null);
  const [viewingItems, setViewingItems] = useState<OrderItem[]>([]);
  const [isDpDialogOpen, setIsDpDialogOpen] = useState(false);
  const [dpOrder, setDpOrder] = useState<SalesOrder | null>(null);

  const [formData, setFormData] = useState({
    customer_id: '',
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
      .from('sales_orders')
      .select('*, customers(id, code, name)')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales orders:', error);
      toast.error('Failed to load sales orders');
    } else {
      setOrders(data || []);
    }
    setIsLoading(false);
  };

  const fetchCustomers = async () => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('customers')
      .select('id, code, name')
      .eq('company_id', selectedCompany.id)
      .order('name');

    setCustomers(data || []);
  };

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, [selectedCompany]);

  const generateOrderNumber = async () => {
    if (!selectedCompany) return 'SO-000000-0000';
    return await generateDocumentNumber(selectedCompany.id, 'SO');
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
        unit_price: product.unit_price,
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
      .from('sales_orders')
      .insert({
        company_id: selectedCompany.id,
        customer_id: formData.customer_id,
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
      toast.error('Failed to create sales order');
      return;
    }

    const itemsData = validItems.map((item) => ({
      sales_order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      tax_percent: item.tax_percent,
      total: item.total,
    }));

    const { error: itemsError } = await supabase.from('sales_order_items').insert(itemsData);

    if (itemsError) {
      toast.error('Failed to save order items');
    } else {
      await logActivity({
        companyId: selectedCompany.id,
        userId: user.id,
        action: 'create',
        entityType: 'sales_order',
        entityId: order.id,
        entityNumber: orderNumber,
        description: `Sales Order ${orderNumber} dibuat untuk ${customers.find(c => c.id === formData.customer_id)?.name || 'Customer'}`,
      });
      toast.success('Sales order created successfully');
      fetchOrders();
      resetForm();
      setIsDialogOpen(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      order_date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: '',
    });
    setOrderItems([{ product_id: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 11, total: 0 }]);
  };

  const handleView = async (order: SalesOrder) => {
    setViewingOrder(order);
    
    const { data } = await supabase
      .from('sales_order_items')
      .select('*, products(name)')
      .eq('sales_order_id', order.id);

    setViewingItems(
      (data || []).map((item: any) => ({
        ...item,
        product_name: item.products?.name,
      }))
    );
    setIsViewDialogOpen(true);
  };

  const handleConfirmOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('sales_orders')
      .update({ status: 'confirmed' })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to confirm order');
    } else {
      toast.success('Order confirmed');
      fetchOrders();
      setIsViewDialogOpen(false);
    }
  };

  const handleOpenDpDialog = (order: SalesOrder) => {
    setDpOrder(order);
    setIsDpDialogOpen(true);
  };

  const handleGenerateInvoice = async (order: SalesOrder) => {
    if (!selectedCompany || !user) return;

    // Calculate invoice amount (minus DP already paid)
    const dpPaid = order.dp_paid || 0;
    const invoiceTotal = order.total_amount - dpPaid;
    const invoiceSubtotal = order.subtotal - (dpPaid / (1 + (order.tax_amount / order.subtotal)));

    // Generate invoice number using auto-numbering
    const invoiceNumber = await generateDocumentNumber(selectedCompany.id, 'INV');

    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        company_id: selectedCompany.id,
        customer_id: order.customer_id,
        sales_order_id: order.id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'sent',
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total_amount: invoiceTotal, // Reduced by DP
        outstanding_amount: invoiceTotal,
        paid_amount: 0,
        notes: dpPaid > 0 ? `${order.notes || ''}\nDP sudah dibayar: ${formatCurrency(dpPaid)}` : order.notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (invoiceError) {
      toast.error('Failed to generate invoice');
      return;
    }

    // Update sales order status to invoiced
    await supabase.from('sales_orders').update({ status: 'invoiced' }).eq('id', order.id);

    // Create journal entry for accounts receivable
    const entryNumber = await generateDocumentNumber(selectedCompany.id, 'JE');
    
    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: selectedCompany.id,
        entry_number: entryNumber,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Invoice ${invoiceNumber} - ${order.customers?.name || 'Customer'}`,
        reference_type: 'invoice',
        reference_id: invoice.id,
        is_posted: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (journalError) {
      console.error('Journal entry error:', journalError);
    } else {
      // Get order items to calculate discount amounts
      const { data: orderItems } = await supabase
        .from('sales_order_items')
        .select('quantity, unit_price, discount_percent, tax_percent')
        .eq('sales_order_id', order.id);

      // Calculate totals
      let grossRevenue = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      (orderItems || []).forEach((item: any) => {
        const lineSubtotal = item.quantity * item.unit_price;
        const lineDiscount = lineSubtotal * (item.discount_percent / 100);
        const afterDiscount = lineSubtotal - lineDiscount;
        const lineTax = afterDiscount * (item.tax_percent / 100);
        
        grossRevenue += lineSubtotal;
        totalDiscount += lineDiscount;
        totalTax += lineTax;
      });

      // Get required accounts
      const { data: receivableAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('account_type', 'asset')
        .or('name.ilike.%receivable%,name.ilike.%piutang%')
        .limit(1)
        .single();

      const { data: revenueAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('account_type', 'revenue')
        .limit(1)
        .single();

      const { data: taxAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .or('name.ilike.%tax%,name.ilike.%pajak%,name.ilike.%ppn%,name.ilike.%pph%')
        .limit(1)
        .single();

      const { data: discountAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .or('name.ilike.%discount%,name.ilike.%diskon%,name.ilike.%potongan%')
        .limit(1)
        .single();

      const journalLines = [];

      // Debit: Accounts Receivable (net amount customer pays)
      if (receivableAccount) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: receivableAccount.id,
          debit_amount: order.total_amount,
          credit_amount: 0,
          description: 'Piutang Usaha',
        });
      }

      // Debit: Tax Receivable (if tax exists - e.g., PPh 23 withheld)
      // Note: For withholding tax, the customer pays less but we still recognize revenue
      // If it's VAT/PPN collected, it would be a credit to liability
      if (taxAccount && totalTax > 0) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: taxAccount.id,
          debit_amount: totalTax,
          credit_amount: 0,
          description: 'Pajak (PPh/PPN)',
        });
      }

      // Debit: Sales Discount (contra-revenue)
      if (discountAccount && totalDiscount > 0) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: discountAccount.id,
          debit_amount: totalDiscount,
          credit_amount: 0,
          description: 'Potongan Penjualan',
        });
      }

      // Credit: Sales Revenue (gross revenue)
      if (revenueAccount) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: revenueAccount.id,
          debit_amount: 0,
          credit_amount: grossRevenue + totalTax, // Gross revenue including tax
          description: 'Pendapatan Penjualan',
        });
      }

      if (journalLines.length > 0) {
        await supabase.from('journal_entry_lines').insert(journalLines);
      }
    }

    toast.success(`Invoice ${invoiceNumber} generated successfully`);
    fetchOrders();
    setIsViewDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    await supabase.from('sales_order_items').delete().eq('sales_order_id', id);
    const { error } = await supabase.from('sales_orders').delete().eq('id', id);

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
      order.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <AccountValidationAlert requiredAccountTypes={['receivable', 'revenue', 'tax', 'discount']} />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Sales Orders</h1>
          <p className="text-muted-foreground mt-1">Manage your sales orders</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Sales Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Sales Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Customer</label>
                  <SearchableSelect
                    options={customers.map(cust => ({ value: cust.id, label: `${cust.code} - ${cust.name}` }))}
                    value={formData.customer_id}
                    onChange={(value) => setFormData({ ...formData, customer_id: value })}
                    placeholder="Select customer"
                    searchPlaceholder="Search customers..."
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
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemTotal(index, { quantity: parseFloat(e.target.value) || 1 })
                              }
                              className="h-9 text-center"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateItemTotal(index, { unit_price: parseFloat(e.target.value) || 0 })
                              }
                              className="h-9 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount_percent}
                              onChange={(e) =>
                                updateItemTotal(index, { discount_percent: parseFloat(e.target.value) || 0 })
                              }
                              className="h-9 text-center"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              value={item.tax_percent}
                              onChange={(e) =>
                                updateItemTotal(index, { tax_percent: parseFloat(e.target.value) || 0 })
                              }
                              className="h-9 text-center"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOrderItem(index)}
                              className="text-destructive"
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

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="input-field"
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
                    <span className="text-primary">{formatCurrency(totals.total)}</span>
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
              { value: 'invoiced', label: 'Invoiced' },
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
        <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sales orders found</h3>
              <p className="text-muted-foreground">Create your first sales order to get started</p>
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
                    <th>Customer</th>
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
                      <td>{order.customers?.name}</td>
                      <td>
                        <span className={cn('badge-status capitalize', getStatusBadgeClass(order.status))}>
                          {order.status}
                        </span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(order.total_amount || 0)}</td>
                      <td className="text-right">
                        {(order.dp_paid || 0) > 0 ? (
                          <span className="text-success font-medium">{formatCurrency(order.dp_paid)}</span>
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
                              className="text-success"
                              title="Input Down Payment"
                            >
                              <Wallet className="w-4 h-4" />
                            </Button>
                          )}
                          {order.status === 'confirmed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateInvoice(order)}
                              className="text-primary"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sales Order Details</DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-mono font-semibold">{viewingOrder.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={cn('badge-status capitalize', getStatusBadgeClass(viewingOrder.status))}>
                    {viewingOrder.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{viewingOrder.customers?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p>{formatDate(viewingOrder.order_date)}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Items</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">{item.product_name}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  <span className="text-primary">{formatCurrency(viewingOrder.total_amount || 0)}</span>
                </div>
                {(viewingOrder.dp_paid || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-success">
                      <span>Down Payment</span>
                      <span>-{formatCurrency(viewingOrder.dp_paid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Sisa (Invoice Amount)</span>
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
                  <Button
                    onClick={() => handleConfirmOrder(viewingOrder.id)}
                    className="flex-1 gradient-primary text-primary-foreground"
                  >
                    Confirm Order
                  </Button>
                )}
                {viewingOrder.status === 'confirmed' && (
                  <Button
                    onClick={() => handleGenerateInvoice(viewingOrder)}
                    className="flex-1 gradient-primary text-primary-foreground"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Invoice
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
          type="sales"
          orderId={dpOrder.id}
          orderNumber={dpOrder.order_number}
          totalAmount={dpOrder.total_amount}
          dpPaid={dpOrder.dp_paid || 0}
          customerOrSupplierName={dpOrder.customers?.name || ''}
          onSuccess={() => {
            fetchOrders();
            setDpOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default SalesOrders;
