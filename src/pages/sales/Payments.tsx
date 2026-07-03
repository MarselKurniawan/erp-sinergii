import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, CreditCard, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { AccountValidationAlert } from '@/components/accounting/AccountValidationAlert';
import { generateDocumentNumber } from '@/lib/documentNumber';

interface Customer {
  id: string;
  code: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  outstanding_amount: number;
  customer_id: string;
}

interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_type: string;
  customer_id: string | null;
  cash_account_id: string | null;
  notes: string | null;
  customers?: Customer;
}

interface PaymentAllocation {
  invoice_id: string;
  amount: number;
  invoice_number?: string;
  outstanding?: number;
}

export const SalesPayments: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getCashBankAccounts } = useAccounts();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get('new') === '1') { setIsDialogOpen(true); sp.delete('new'); setSp(sp, { replace: true }); }
  }, [sp]);

  const [formData, setFormData] = useState({
    customer_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    cash_account_id: '',
    notes: '',
  });

  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);

  const fetchPayments = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select('*, customers(id, code, name)')
      .eq('company_id', selectedCompany.id)
      .eq('payment_type', 'incoming')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } else {
      setPayments(data || []);
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

  const fetchCustomerInvoices = async (customerId: string) => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('customer_id', customerId)
      .gt('outstanding_amount', 0)
      .order('due_date');

    setCustomerInvoices(data || []);
    setAllocations([]);
  };

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
  }, [selectedCompany]);

  useEffect(() => {
    if (formData.customer_id) {
      fetchCustomerInvoices(formData.customer_id);
    }
  }, [formData.customer_id]);

  const generatePaymentNumber = async () => {
    return await generateDocumentNumber(selectedCompany!.id, 'PAY-IN');
  };

  const toggleInvoiceAllocation = (invoice: Invoice, checked: boolean) => {
    if (checked) {
      setAllocations((prev) => [
        ...prev,
        {
          invoice_id: invoice.id,
          amount: invoice.outstanding_amount,
          invoice_number: invoice.invoice_number,
          outstanding: invoice.outstanding_amount,
        },
      ]);
    } else {
      setAllocations((prev) => prev.filter((a) => a.invoice_id !== invoice.id));
    }
  };

  const updateAllocationAmount = (invoiceId: string, amount: number) => {
    setAllocations((prev) =>
      prev.map((a) => (a.invoice_id === invoiceId ? { ...a, amount: Math.min(amount, a.outstanding || 0) } : a))
    );
  };

  const totalPaymentAmount = allocations.reduce((sum, a) => sum + a.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    if (allocations.length === 0) {
      toast.error('Please select at least one invoice to pay');
      return;
    }

    const paymentNumber = await generatePaymentNumber();

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        company_id: selectedCompany.id,
        customer_id: formData.customer_id,
        payment_number: paymentNumber,
        payment_date: formData.payment_date,
        payment_type: 'incoming',
        amount: totalPaymentAmount,
        cash_account_id: formData.cash_account_id || null,
        notes: formData.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      toast.error('Failed to create payment');
      return;
    }

    // Create payment allocations
    const allocationData = allocations.map((a) => ({
      payment_id: payment.id,
      invoice_id: a.invoice_id,
      amount: a.amount,
    }));

    await supabase.from('payment_allocations').insert(allocationData);

    // Update invoice paid amounts and outstanding
    for (const alloc of allocations) {
      const invoice = customerInvoices.find((i) => i.id === alloc.invoice_id);
      if (invoice) {
        const newPaidAmount = (invoice.total_amount - invoice.outstanding_amount) + alloc.amount;
        const newOutstanding = invoice.total_amount - newPaidAmount;
        const newStatus = newOutstanding <= 0 ? 'paid' : 'partial';

        await supabase
          .from('invoices')
          .update({
            paid_amount: newPaidAmount,
            outstanding_amount: newOutstanding,
            status: newStatus,
          })
          .eq('id', alloc.invoice_id);
      }
    }

    // Create journal entry for cash receipt
    const entryNumber = await generateDocumentNumber(selectedCompany.id, 'JE');
    
    const customer = customers.find(c => c.id === formData.customer_id);
    
    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: selectedCompany.id,
        entry_number: entryNumber,
        entry_date: formData.payment_date,
        description: `Payment ${paymentNumber} - ${customer?.name || 'Customer'}`,
        reference_type: 'payment',
        reference_id: payment.id,
        is_posted: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (!journalError && journalEntry) {
      // Use selected cash account if provided, otherwise first cash/bank account
      const cashAccounts = getCashBankAccounts();
      const cashAccountId = formData.cash_account_id || cashAccounts[0]?.id;

      const { data: receivableAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('account_type', 'asset')
        .or('name.ilike.%receivable%,name.ilike.%piutang%')
        .limit(1)
        .single();

      if (cashAccountId && receivableAccount) {
        await supabase.from('journal_entry_lines').insert([
          {
            journal_entry_id: journalEntry.id,
            account_id: cashAccountId,
            debit_amount: totalPaymentAmount,
            credit_amount: 0,
            description: 'Cash Received',
          },
          {
            journal_entry_id: journalEntry.id,
            account_id: receivableAccount.id,
            debit_amount: 0,
            credit_amount: totalPaymentAmount,
            description: 'Accounts Receivable',
          },
        ]);
      }
    }

    toast.success(`Payment ${paymentNumber} recorded successfully`);
    fetchPayments();
    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      cash_account_id: '',
      notes: '',
    });
    setAllocations([]);
    setCustomerInvoices([]);
  };

  const filteredPayments = payments.filter(
    (payment) =>
      payment.payment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cashAccounts = getCashBankAccounts();

  return (
    <div className="space-y-6">
      <AccountValidationAlert requiredAccountTypes={['cash_bank', 'receivable']} />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Receive Payments</h1>
          <p className="text-muted-foreground mt-1">Record customer payments</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Receive Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Receive Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Customer</label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  >
                    <SelectTrigger className="input-field">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((cust) => (
                        <SelectItem key={cust.id} value={cust.id}>
                          {cust.code} - {cust.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="form-label">Payment Date</label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Deposit To Account</label>
                <Select
                  value={formData.cash_account_id}
                  onValueChange={(value) => setFormData({ ...formData, cash_account_id: value })}
                >
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select cash/bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.customer_id && (
                <div>
                  <label className="form-label mb-3">Outstanding Invoices</label>
                  {customerInvoices.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No outstanding invoices</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left w-10"></th>
                            <th className="px-3 py-2 text-left">Invoice</th>
                            <th className="px-3 py-2 text-left">Due Date</th>
                            <th className="px-3 py-2 text-right">Outstanding</th>
                            <th className="px-3 py-2 text-right">Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerInvoices.map((invoice) => {
                            const allocation = allocations.find((a) => a.invoice_id === invoice.id);
                            return (
                              <tr key={invoice.id} className="border-t">
                                <td className="px-3 py-2">
                                  <Checkbox
                                    checked={!!allocation}
                                    onCheckedChange={(checked) =>
                                      toggleInvoiceAllocation(invoice, checked as boolean)
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono">{invoice.invoice_number}</td>
                                <td className="px-3 py-2">{formatDate(invoice.due_date)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(invoice.outstanding_amount)}</td>
                                <td className="px-3 py-2">
                                  {allocation && (
                                    <Input
                                      type="number"
                                      value={allocation.amount}
                                      onChange={(e) =>
                                        updateAllocationAmount(invoice.id, parseFloat(e.target.value) || 0)
                                      }
                                      max={invoice.outstanding_amount}
                                      className="h-8 text-right"
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Payment notes..."
                    className="input-field"
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 flex flex-col justify-center">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total Payment</span>
                    <span className="text-primary">{formatCurrency(totalPaymentAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gradient-primary text-primary-foreground"
                  disabled={allocations.length === 0}
                >
                  Record Payment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search payments..."
          className="pl-10 input-field"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading payments...</div>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payments found</h3>
              <p className="text-muted-foreground">Record customer payments to track cash flow</p>
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
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th className="text-right">Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="font-mono font-medium">{payment.payment_number}</td>
                      <td>{formatDate(payment.payment_date)}</td>
                      <td>{payment.customers?.name}</td>
                      <td className="text-right font-medium text-success">{formatCurrency(payment.amount)}</td>
                      <td className="text-muted-foreground truncate max-w-[200px]">{payment.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SalesPayments;
