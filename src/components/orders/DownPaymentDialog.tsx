import React, { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { generateDocumentNumber } from '@/lib/documentNumber';

interface DownPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'sales' | 'purchase';
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  dpPaid: number;
  customerOrSupplierName: string;
  onSuccess: () => void;
}

export const DownPaymentDialog: React.FC<DownPaymentDialogProps> = ({
  open,
  onOpenChange,
  type,
  orderId,
  orderNumber,
  totalAmount,
  dpPaid,
  customerOrSupplierName,
  onSuccess,
}) => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getCashBankAccounts } = useAccounts();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    cash_account_id: '',
    notes: '',
  });

  const cashAccounts = getCashBankAccounts();
  const maxDp = totalAmount - dpPaid;

  const generateDpNumber = async () => {
    return await generateDocumentNumber(selectedCompany!.id, 'DP');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    if (amount > maxDp) {
      toast.error(`Jumlah DP tidak boleh melebihi ${formatCurrency(maxDp)}`);
      return;
    }
    if (!formData.cash_account_id) {
      toast.error('Pilih akun kas/bank');
      return;
    }

    setIsLoading(true);
    const dpNumber = await generateDpNumber();
    const date = new Date();

    // Create down payment record
    const dpData: any = {
      company_id: selectedCompany.id,
      payment_type: type,
      dp_number: dpNumber,
      dp_date: new Date().toISOString().split('T')[0],
      amount,
      cash_account_id: formData.cash_account_id,
      notes: formData.notes || null,
      created_by: user.id,
    };

    if (type === 'sales') {
      dpData.sales_order_id = orderId;
    } else {
      dpData.purchase_order_id = orderId;
    }

    const { error: dpError } = await supabase
      .from('down_payments')
      .insert(dpData);

    if (dpError) {
      toast.error('Gagal menyimpan down payment');
      setIsLoading(false);
      return;
    }

    // Update order dp_paid
    const tableName = type === 'sales' ? 'sales_orders' : 'purchase_orders';
    const newDpPaid = dpPaid + amount;

    const { error: updateError } = await supabase
      .from(tableName)
      .update({ dp_paid: newDpPaid })
      .eq('id', orderId);

    if (updateError) {
      toast.error('Gagal update order');
      setIsLoading(false);
      return;
    }

    // Create journal entry
    const entryNumber = await generateDocumentNumber(selectedCompany.id, 'JE');

    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: selectedCompany.id,
        entry_number: entryNumber,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Down Payment ${dpNumber} - ${customerOrSupplierName}`,
        reference_type: 'down_payment',
        is_posted: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (!journalError && journalEntry) {
      // Get DP liability/asset account
      const dpAccountQuery = type === 'sales'
        ? supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('company_id', selectedCompany.id)
            .eq('account_type', 'liability')
            .or('name.ilike.%uang muka%,name.ilike.%dp%,name.ilike.%down payment%,name.ilike.%advance%')
            .limit(1)
        : supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('company_id', selectedCompany.id)
            .eq('account_type', 'asset')
            .or('name.ilike.%uang muka%,name.ilike.%dp%,name.ilike.%down payment%,name.ilike.%advance%')
            .limit(1);

      const { data: dpAccount } = await dpAccountQuery.single();

      // For sales DP: Debit Cash, Credit Uang Muka Penjualan (Liability)
      // For purchase DP: Debit Uang Muka Pembelian (Asset), Credit Cash
      const journalLines = [];

      if (type === 'sales') {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: formData.cash_account_id,
          debit_amount: amount,
          credit_amount: 0,
          description: 'Kas/Bank - Terima DP',
        });
        if (dpAccount) {
          journalLines.push({
            journal_entry_id: journalEntry.id,
            account_id: dpAccount.id,
            debit_amount: 0,
            credit_amount: amount,
            description: 'Uang Muka Penjualan',
          });
        }
      } else {
        if (dpAccount) {
          journalLines.push({
            journal_entry_id: journalEntry.id,
            account_id: dpAccount.id,
            debit_amount: amount,
            credit_amount: 0,
            description: 'Uang Muka Pembelian',
          });
        }
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: formData.cash_account_id,
          debit_amount: 0,
          credit_amount: amount,
          description: 'Kas/Bank - Bayar DP',
        });
      }

      if (journalLines.length > 0) {
        await supabase.from('journal_entry_lines').insert(journalLines);
      }
    }

    toast.success(`Down payment ${dpNumber} berhasil disimpan`);
    setFormData({ amount: '', cash_account_id: '', notes: '' });
    setIsLoading(false);
    onOpenChange(false);
    onSuccess();
  };

  const cashAccountOptions = cashAccounts.map(acc => ({
    value: acc.id,
    label: `${acc.code} - ${acc.name}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Input Down Payment
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order:</span>
              <span className="font-mono font-medium">{orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{type === 'sales' ? 'Customer' : 'Supplier'}:</span>
              <span className="font-medium">{customerOrSupplierName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Order:</span>
              <span className="font-medium">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">DP Sudah Dibayar:</span>
              <span className="font-medium text-success">{formatCurrency(dpPaid)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Sisa:</span>
              <span className="font-bold">{formatCurrency(maxDp)}</span>
            </div>
          </div>

          <div>
            <label className="form-label">Jumlah DP</label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0"
              className="input-field"
              max={maxDp}
              required
            />
          </div>

          <div>
            <label className="form-label">Akun Kas/Bank</label>
            <SearchableSelect
              options={cashAccountOptions}
              value={formData.cash_account_id}
              onChange={(value) => setFormData({ ...formData, cash_account_id: value })}
              placeholder="Pilih akun kas/bank"
            />
          </div>

          <div>
            <label className="form-label">Catatan (Opsional)</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Catatan..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1 gradient-primary text-primary-foreground"
              disabled={isLoading}
            >
              {isLoading ? 'Menyimpan...' : 'Simpan DP'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
