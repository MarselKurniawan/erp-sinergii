import React, { useState, useEffect } from 'react';
import { Users, Eye, X } from 'lucide-react';
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
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface AgedInvoice {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  days_overdue: number;
  age_bucket: string;
  notes: string | null;
  status: string;
}

interface CustomerAging {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  invoices: AgedInvoice[];
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  total: number;
}

interface AgingSummary {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
}

export const AgedReceivables: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerAgings, setCustomerAgings] = useState<CustomerAging[]>([]);
  const [summary, setSummary] = useState<AgingSummary>({
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    over_90: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<AgedInvoice | null>(null);

  const fetchData = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);

    // Filter invoices created on or before the as of date
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(id, code, name)')
      .eq('company_id', selectedCompany.id)
      .gt('outstanding_amount', 0)
      .neq('status', 'cancelled')
      .lte('invoice_date', asOfDate)
      .order('due_date');

    if (error) {
      console.error('Error fetching aged receivables:', error);
      toast.error('Failed to load report data');
      setIsLoading(false);
      return;
    }

    const asOf = new Date(asOfDate);
    const newSummary: AgingSummary = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      over_90: 0,
    };

    // Group by customer
    const customerMap = new Map<string, CustomerAging>();

    (data || []).forEach((inv: any) => {
      const dueDate = new Date(inv.due_date);
      const diffTime = asOf.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let ageBucket = 'Current';
      let bucketKey: keyof AgingSummary = 'current';
      
      if (diffDays <= 0) {
        ageBucket = 'Current';
        bucketKey = 'current';
      } else if (diffDays <= 30) {
        ageBucket = '1-30 Days';
        bucketKey = 'days_1_30';
      } else if (diffDays <= 60) {
        ageBucket = '31-60 Days';
        bucketKey = 'days_31_60';
      } else if (diffDays <= 90) {
        ageBucket = '61-90 Days';
        bucketKey = 'days_61_90';
      } else {
        ageBucket = 'Over 90 Days';
        bucketKey = 'over_90';
      }

      newSummary[bucketKey] += inv.outstanding_amount;

      const customerId = inv.customers?.id || 'unknown';
      
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: inv.customers?.name || 'Unknown',
          customer_code: inv.customers?.code || '',
          invoices: [],
          current: 0,
          days_1_30: 0,
          days_31_60: 0,
          days_61_90: 0,
          over_90: 0,
          total: 0,
        });
      }

      const customer = customerMap.get(customerId)!;
      customer[bucketKey] += inv.outstanding_amount;
      customer.total += inv.outstanding_amount;
      
      customer.invoices.push({
        id: inv.id,
        customer_id: customerId,
        customer_name: inv.customers?.name || 'Unknown',
        customer_code: inv.customers?.code || '',
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        total_amount: inv.total_amount,
        paid_amount: inv.paid_amount || 0,
        outstanding_amount: inv.outstanding_amount,
        days_overdue: Math.max(0, diffDays),
        age_bucket: ageBucket,
        notes: inv.notes,
        status: inv.status,
      });
    });

    setCustomerAgings(Array.from(customerMap.values()).sort((a, b) => b.total - a.total));
    setSummary(newSummary);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany, asOfDate]);

  const totalOutstanding = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Aged Receivables</h1>
          <p className="text-muted-foreground mt-1">Outstanding customer invoices by age</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">As of Date</label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="input-field"
              />
            </div>
            <Button onClick={fetchData} variant="outline">
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-bold text-success">{formatCurrency(summary.current)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">1-30 Days</p>
            <p className="text-lg font-bold text-warning">{formatCurrency(summary.days_1_30)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">31-60 Days</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(summary.days_31_60)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">61-90 Days</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(summary.days_61_90)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Over 90 Days</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(summary.over_90)}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading report...</div>
      ) : customerAgings.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Outstanding Receivables</h3>
              <p className="text-muted-foreground">All customer invoices have been paid</p>
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
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th className="text-right">Current</th>
                    <th className="text-right">1-30 Days</th>
                    <th className="text-right">31-60 Days</th>
                    <th className="text-right">61-90 Days</th>
                    <th className="text-right">Over 90</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customerAgings.map((customer) => (
                    <React.Fragment key={customer.customer_id}>
                      {/* Customer summary row */}
                      <tr className="bg-muted/30 font-medium">
                        <td>
                          <div>
                            <p className="font-semibold">{customer.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{customer.customer_code}</p>
                          </div>
                        </td>
                        <td className="text-muted-foreground text-sm">
                          {customer.invoices.length} invoice(s)
                        </td>
                        <td className="text-right">
                          {customer.current > 0 && <span className="text-success">{formatCurrency(customer.current)}</span>}
                        </td>
                        <td className="text-right">
                          {customer.days_1_30 > 0 && <span className="text-warning">{formatCurrency(customer.days_1_30)}</span>}
                        </td>
                        <td className="text-right">
                          {customer.days_31_60 > 0 && <span className="text-orange-500">{formatCurrency(customer.days_31_60)}</span>}
                        </td>
                        <td className="text-right">
                          {customer.days_61_90 > 0 && <span className="text-destructive">{formatCurrency(customer.days_61_90)}</span>}
                        </td>
                        <td className="text-right">
                          {customer.over_90 > 0 && <span className="text-destructive">{formatCurrency(customer.over_90)}</span>}
                        </td>
                        <td className="text-right font-bold text-primary">
                          {formatCurrency(customer.total)}
                        </td>
                      </tr>
                      {/* Individual invoices */}
                      {customer.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/10">
                          <td></td>
                          <td>
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="flex items-center gap-2 text-primary hover:underline font-mono text-sm"
                            >
                              <Eye className="w-3 h-3" />
                              {inv.invoice_number}
                            </button>
                          </td>
                          <td className="text-right text-sm">
                            {inv.age_bucket === 'Current' && formatCurrency(inv.outstanding_amount)}
                          </td>
                          <td className="text-right text-sm">
                            {inv.age_bucket === '1-30 Days' && formatCurrency(inv.outstanding_amount)}
                          </td>
                          <td className="text-right text-sm">
                            {inv.age_bucket === '31-60 Days' && formatCurrency(inv.outstanding_amount)}
                          </td>
                          <td className="text-right text-sm">
                            {inv.age_bucket === '61-90 Days' && formatCurrency(inv.outstanding_amount)}
                          </td>
                          <td className="text-right text-sm">
                            {inv.age_bucket === 'Over 90 Days' && formatCurrency(inv.outstanding_amount)}
                          </td>
                          <td className="text-right text-sm">
                            {formatCurrency(inv.outstanding_amount)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/10 font-bold">
                    <td colSpan={2}>Grand Total</td>
                    <td className="text-right text-success">{formatCurrency(summary.current)}</td>
                    <td className="text-right text-warning">{formatCurrency(summary.days_1_30)}</td>
                    <td className="text-right text-orange-500">{formatCurrency(summary.days_31_60)}</td>
                    <td className="text-right text-destructive">{formatCurrency(summary.days_61_90)}</td>
                    <td className="text-right text-destructive">{formatCurrency(summary.over_90)}</td>
                    <td className="text-right text-primary">{formatCurrency(totalOutstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Invoice Number</p>
                  <p className="font-mono font-medium">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={cn(
                    'badge-status',
                    selectedInvoice.status === 'paid' ? 'bg-success/10 text-success' :
                    selectedInvoice.status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                    'bg-warning/10 text-warning'
                  )}>
                    {selectedInvoice.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedInvoice.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Age Bucket</p>
                  <span className={cn(
                    'badge-status',
                    selectedInvoice.age_bucket === 'Current' ? 'bg-success/10 text-success' :
                    selectedInvoice.age_bucket === '1-30 Days' ? 'bg-warning/10 text-warning' :
                    'bg-destructive/10 text-destructive'
                  )}>
                    {selectedInvoice.age_bucket}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.due_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Days Overdue</p>
                  <p className={cn(
                    'font-bold text-lg',
                    selectedInvoice.days_overdue === 0 ? 'text-success' :
                    selectedInvoice.days_overdue <= 30 ? 'text-warning' : 'text-destructive'
                  )}>
                    {selectedInvoice.days_overdue} days
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid Amount</span>
                  <span className="font-medium text-success">{formatCurrency(selectedInvoice.paid_amount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Outstanding</span>
                  <span className="font-bold text-destructive">{formatCurrency(selectedInvoice.outstanding_amount)}</span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgedReceivables;
