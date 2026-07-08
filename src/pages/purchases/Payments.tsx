import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, CreditCard, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { AccountValidationAlert } from '@/components/accounting/AccountValidationAlert';
import { generateDocumentNumber } from '@/lib/documentNumber';
import { CurrencyRateField } from '@/components/CurrencyRateField';

const getApprovalBadgeClass = (status: string) => {
  switch (status) {
    case 'approved':
      return 'bg-success/10 text-success border-success/20';
    case 'rejected':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    default:
      return 'bg-warning/10 text-warning border-warning/20';
  }
};

interface Bill {
  id: string;
  bill_number: string;
  due_date: string;
  total_amount: number;
  outstanding_amount: number;
  approval_status?: string;
  suppliers?: { name: string };
}

interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  supplier_id: string;
  notes: string | null;
  approval_status?: string;
  suppliers?: { id: string; name: string };
  cash_account?: { id: string; code: string; name: string };
}

interface BillAllocation {
  bill_id: string;
  bill_number: string;
  due_date: string;
  outstanding_amount: number;
  allocation_amount: number;
  selected: boolean;
}

export const PurchasePayments: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getCashBankAccounts } = useAccounts();
  const { suppliers } = useSuppliers();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get('new') === '1') { setIsDialogOpen(true); sp.delete('new'); setSp(sp, { replace: true }); }
  }, [sp]);

  const [formData, setFormData] = useState({
    supplier_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    cash_account_id: '',
    notes: '',
    currency_code: 'IDR',
    exchange_rate: 1,
  });

  const [billAllocations, setBillAllocations] = useState<BillAllocation[]>([]);
  const [totalPayment, setTotalPayment] = useState(0);

  const cashBankAccounts = getCashBankAccounts();

  const fetchPayments = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select('*, suppliers(id, name), cash_account:chart_of_accounts!payments_cash_account_id_fkey(id, code, name)')
      .eq('company_id', selectedCompany.id)
      .eq('payment_type', 'outgoing')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } else {
      setPayments(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, [selectedCompany]);

  const fetchSupplierBills = async (supplierId: string) => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('bills')
      .select('id, bill_number, due_date, total_amount, outstanding_amount, suppliers(name)')
      .eq('company_id', selectedCompany.id)
      .eq('supplier_id', supplierId)
      .eq('approval_status', 'approved')
      .gt('outstanding_amount', 0)
      .order('due_date');

    setBillAllocations(
      (data || []).map((bill: Bill) => ({
        bill_id: bill.id,
        bill_number: bill.bill_number,
        due_date: bill.due_date,
        outstanding_amount: bill.outstanding_amount,
        allocation_amount: 0,
        selected: false,
      }))
    );
  };

  const handleSupplierChange = (supplierId: string) => {
    setFormData({ ...formData, supplier_id: supplierId });
    fetchSupplierBills(supplierId);
    setTotalPayment(0);
  };

  const handleAllocationChange = (index: number, amount: number) => {
    setBillAllocations((prev) => {
      const newAllocations = [...prev];
      newAllocations[index].allocation_amount = Math.min(amount, newAllocations[index].outstanding_amount);
      newAllocations[index].selected = amount > 0;
      return newAllocations;
    });
    
    const total = billAllocations.reduce((sum, alloc, i) => 
      sum + (i === index ? Math.min(amount, billAllocations[index].outstanding_amount) : alloc.allocation_amount), 0
    );
    setTotalPayment(total);
  };

  const handleSelectAll = (checked: boolean) => {
    setBillAllocations((prev) =>
      prev.map((alloc) => ({
        ...alloc,
        selected: checked,
        allocation_amount: checked ? alloc.outstanding_amount : 0,
      }))
    );
    
    if (checked) {
      setTotalPayment(billAllocations.reduce((sum, alloc) => sum + alloc.outstanding_amount, 0));
    } else {
      setTotalPayment(0);
    }
  };

  const generatePaymentNumber = async () => {
    return await generateDocumentNumber(selectedCompany!.id, 'PAY-OUT');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    const selectedAllocations = billAllocations.filter((a) => a.allocation_amount > 0);
    if (selectedAllocations.length === 0) {
      toast.error('Please allocate payment to at least one bill');
      return;
    }

    const paymentNumber = await generatePaymentNumber();

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        company_id: selectedCompany.id,
        supplier_id: formData.supplier_id,
        payment_number: paymentNumber,
        payment_date: formData.payment_date,
        payment_type: 'outgoing',
        amount: totalPayment,
        cash_account_id: formData.cash_account_id || null,
        notes: formData.notes || null,
        currency_code: formData.currency_code,
        exchange_rate: formData.exchange_rate,
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (paymentError) {
      toast.error('Failed to create payment');
      return;
    }

    // Create payment allocations. Bill balances and journals are applied after approval.
    for (const alloc of selectedAllocations) {
      await supabase.from('payment_allocations').insert({
        payment_id: payment.id,
        bill_id: alloc.bill_id,
        amount: alloc.allocation_amount,
      });
    }

    toast.success(`Payment ${paymentNumber} menunggu approval`);
    fetchPayments();
    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      cash_account_id: '',
      notes: '',
      currency_code: (selectedCompany as any)?.base_currency || 'IDR',
      exchange_rate: 1,
    });
    setBillAllocations([]);
    setTotalPayment(0);
  };

  const filteredPayments = payments.filter((payment) => {
    return (
      payment.payment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <AccountValidationAlert requiredAccountTypes={['cash_bank', 'payable']} />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Make Payments</h1>
          <p className="text-muted-foreground mt-1">Record payments to suppliers</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Make Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Make Payment to Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Supplier</label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={handleSupplierChange}
                  >
                    <SelectTrigger className="input-field">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>
                          {sup.code} - {sup.name}
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
                <label className="form-label">Pay From (Cash/Bank Account)</label>
                <Select
                  value={formData.cash_account_id}
                  onValueChange={(value) => setFormData({ ...formData, cash_account_id: value })}
                >
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select cash/bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashBankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {billAllocations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="form-label mb-0">Allocate to Bills</label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={billAllocations.every((a) => a.selected)}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                      <span className="text-sm text-muted-foreground">Select All</span>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">Bill #</th>
                          <th className="px-3 py-2 text-left">Due Date</th>
                          <th className="px-3 py-2 text-right">Outstanding</th>
                          <th className="px-3 py-2 text-right w-40">Payment Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billAllocations.map((alloc, index) => (
                          <tr key={alloc.bill_id} className="border-t">
                            <td className="px-3 py-2 font-mono">{alloc.bill_number}</td>
                            <td className="px-3 py-2">{formatDate(alloc.due_date)}</td>
                            <td className="px-3 py-2 text-right text-warning">
                              {formatCurrency(alloc.outstanding_amount)}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={alloc.allocation_amount}
                                onChange={(e) => handleAllocationChange(index, parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                                max={alloc.outstanding_amount}
                                min={0}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {formData.supplier_id && billAllocations.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No outstanding bills for this supplier</p>
                  </CardContent>
                </Card>
              )}

              <div className="border rounded-lg p-3 bg-muted/30">
                <CurrencyRateField
                  currency={formData.currency_code}
                  rate={formData.exchange_rate}
                  date={formData.payment_date}
                  onChange={(c, r) => setFormData({ ...formData, currency_code: c, exchange_rate: r })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Payment notes..."
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 flex flex-col justify-center">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Payment</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(totalPayment)}</p>
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
                  disabled={totalPayment <= 0}
                >
                  Record Payment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Payments</p>
                <p className="text-2xl font-bold">{payments.length}</p>
              </div>
              <CreditCard className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalPaid)}</p>
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
            placeholder="Search payments..."
            className="pl-10 input-field"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading payments...</div>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payments found</h3>
              <p className="text-muted-foreground">Start by making a payment to a supplier</p>
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
                    <th>Supplier</th>
                    <th>Approval</th>
                    <th>Account</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="font-mono font-medium">{payment.payment_number}</td>
                      <td>{formatDate(payment.payment_date)}</td>
                      <td>{payment.suppliers?.name}</td>
                      <td>
                        <span className={cn('badge-status capitalize', getApprovalBadgeClass(payment.approval_status || 'pending'))}>
                          {payment.approval_status || 'pending'}
                        </span>
                      </td>
                      <td>{payment.cash_account?.name || '-'}</td>
                      <td className="text-right font-medium text-destructive">
                        {formatCurrency(payment.amount)}
                      </td>
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

export default PurchasePayments;
