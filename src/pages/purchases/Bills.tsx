import React, { useState, useEffect, useRef } from 'react';
import { Search, Eye, FileText, CreditCard, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
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
import { toast } from 'sonner';
import { formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface Supplier {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  supplier_id: string;
  purchase_order_id: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  approval_status?: string;
  approved_at?: string | null;
  rejection_reason?: string | null;
  notes: string | null;
  suppliers?: Supplier;
}

interface BillItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  total: number;
}

export const Bills: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchBills = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*, suppliers(id, code, name, address, phone, email)')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load bills');
    } else {
      const today = new Date().toISOString().split('T')[0];
      const updatedBills = (data || []).map((bill: Bill) => {
        if (bill.due_date < today && bill.outstanding_amount > 0 && bill.status !== 'overdue' && bill.status !== 'paid') {
          return { ...bill, status: 'overdue' };
        }
        return bill;
      });
      setBills(updatedBills);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBills();
  }, [selectedCompany]);

  const handleView = async (bill: Bill) => {
    setViewingBill(bill);
    
    if (bill.purchase_order_id) {
      const { data } = await supabase
        .from('purchase_order_items')
        .select('*, products(name)')
        .eq('purchase_order_id', bill.purchase_order_id);

      setBillItems(
        (data || []).map((item: any) => ({
          product_name: item.products?.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
          total: item.total,
        }))
      );
    }
    setIsViewDialogOpen(true);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups for this site');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill ${viewingBill?.bill_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .bill-title { font-size: 20px; color: #666; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .info-block { }
            .info-label { color: #666; font-size: 12px; margin-bottom: 2px; }
            .info-value { font-weight: 500; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals { width: 300px; margin-left: auto; }
            .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
            .totals .total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
            .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOutstanding = bills.reduce((sum, bill) => sum + (bill.outstanding_amount || 0), 0);
  const totalOverdue = bills.filter(bill => bill.status === 'overdue').reduce((sum, bill) => sum + (bill.outstanding_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Bills</h1>
          <p className="text-muted-foreground mt-1">Track supplier bills and amounts payable</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bills</p>
                <p className="text-2xl font-bold">{bills.length}</p>
              </div>
              <FileText className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(totalOutstanding)}</p>
              </div>
              <CreditCard className="w-10 h-10 text-warning/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
              </div>
              <CreditCard className="w-10 h-10 text-destructive/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bills..."
            className="pl-10 input-field"
          />
        </div>
        <div className="w-full sm:w-48">
          <SearchableSelect
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Pending' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filter by status"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading bills...</div>
      ) : filteredBills.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bills found</h3>
              <p className="text-muted-foreground">Generate bills from confirmed purchase orders</p>
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
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Approval</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => (
                    <tr key={bill.id}>
                      <td className="font-mono font-medium">{bill.bill_number}</td>
                      <td>{formatDate(bill.bill_date)}</td>
                      <td>{formatDate(bill.due_date)}</td>
                      <td>{bill.suppliers?.name}</td>
                      <td>
                        <span className={cn('badge-status capitalize', getStatusBadgeClass(bill.status))}>
                          {bill.status === 'sent' ? 'Pending' : bill.status}
                        </span>
                      </td>
                      <td>
                        <span className={cn('badge-status capitalize', getStatusBadgeClass(bill.approval_status || 'pending'))}>
                          {bill.approval_status || 'pending'}
                        </span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(bill.total_amount || 0)}</td>
                      <td className={cn(
                        'text-right font-medium',
                        bill.outstanding_amount > 0 ? 'text-warning' : 'text-success'
                      )}>
                        {formatCurrency(bill.outstanding_amount || 0)}
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleView(bill)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Bill Details</span>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          {viewingBill && (
            <div className="space-y-6">
              <div ref={printRef}>
                <div className="header text-center mb-6 pb-4 border-b-2">
                  <div className="company-name text-xl font-bold">{selectedCompany?.name}</div>
                  <div className="bill-title text-lg text-muted-foreground">BILL</div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Bill Number</p>
                    <p className="font-mono font-semibold">{viewingBill.bill_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span className={cn('badge-status capitalize', getStatusBadgeClass(viewingBill.status))}>
                      {viewingBill.status === 'sent' ? 'Pending' : viewingBill.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Approval</p>
                    <span className={cn('badge-status capitalize', getStatusBadgeClass(viewingBill.approval_status || 'pending'))}>
                      {viewingBill.approval_status || 'pending'}
                    </span>
                    {viewingBill.rejection_reason && (
                      <p className="mt-1 text-xs text-destructive">{viewingBill.rejection_reason}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier</p>
                    <p className="font-medium">{viewingBill.suppliers?.name}</p>
                    {viewingBill.suppliers?.address && (
                      <p className="text-sm text-muted-foreground">{viewingBill.suppliers.address}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bill Date</p>
                    <p>{formatDate(viewingBill.bill_date)}</p>
                    <p className="text-sm text-muted-foreground mt-2">Due Date</p>
                    <p className={cn(viewingBill.status === 'overdue' && 'text-destructive font-medium')}>
                      {formatDate(viewingBill.due_date)}
                    </p>
                  </div>
                </div>

                {billItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden mb-6">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billItems.map((item, index) => (
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
                )}

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(viewingBill.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(viewingBill.tax_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(viewingBill.total_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-success">
                    <span>Paid</span>
                    <span>{formatCurrency(viewingBill.paid_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Outstanding</span>
                    <span className={viewingBill.outstanding_amount > 0 ? 'text-warning' : 'text-success'}>
                      {formatCurrency(viewingBill.outstanding_amount || 0)}
                    </span>
                  </div>
                </div>
              </div>

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

export default Bills;
