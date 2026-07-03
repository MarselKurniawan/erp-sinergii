import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { generateDocumentNumber } from '@/lib/documentNumber';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface JournalLine {
  id: string;
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  description: string;
}

interface ManualJournalEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ManualJournalEntryForm: React.FC<ManualJournalEntryFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { selectedCompany } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { id: '1', account_id: '', debit_amount: '', credit_amount: '', description: '' },
    { id: '2', account_id: '', debit_amount: '', credit_amount: '', description: '' },
  ]);

  useEffect(() => {
    if (selectedCompany && open) {
      fetchAccounts();
    }
  }, [selectedCompany, open]);

  const fetchAccounts = async () => {
    if (!selectedCompany) return;
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('code');
    
    setAccounts(data || []);
  };

  const addLine = () => {
    setLines([
      ...lines,
      { id: Date.now().toString(), account_id: '', debit_amount: '', credit_amount: '', description: '' },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      toast.error('Minimal 2 baris untuk journal entry');
      return;
    }
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof JournalLine, value: string) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l;
      
      // If entering debit, clear credit and vice versa
      if (field === 'debit_amount' && value) {
        return { ...l, debit_amount: value, credit_amount: '' };
      }
      if (field === 'credit_amount' && value) {
        return { ...l, credit_amount: value, debit_amount: '' };
      }
      
      return { ...l, [field]: value };
    }));
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit_amount) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit_amount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const difference = Math.abs(totalDebit - totalCredit);
  const hasValidLines = lines.filter(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0)).length >= 2;

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setLines([
      { id: '1', account_id: '', debit_amount: '', credit_amount: '', description: '' },
      { id: '2', account_id: '', debit_amount: '', credit_amount: '', description: '' },
    ]);
  };

  const handleSubmit = async () => {
    if (!selectedCompany) return;

    // Validation
    if (!entryDate) {
      toast.error('Tanggal wajib diisi');
      return;
    }

    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0));
    if (validLines.length < 2) {
      toast.error('Minimal 2 baris dengan akun dan nominal');
      return;
    }

    if (!isBalanced) {
      toast.error('Total Debit dan Credit harus sama');
      return;
    }

    setIsSubmitting(true);

    try {
      // Auto-generate entry number via DB sequence
      const entryNumber = await generateDocumentNumber(selectedCompany.id, 'JE');

      // Create journal entry
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: selectedCompany.id,
          entry_number: entryNumber,
          entry_date: entryDate,
          description,
          reference_type: 'manual',
          is_posted: true,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Create journal lines
      const linesToInsert = validLines.map(l => ({
        journal_entry_id: entry.id,
        account_id: l.account_id,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
        description: l.description || null,
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      toast.success(`Journal Entry ${entryNumber} berhasil dibuat`);
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      toast.error(error.message || 'Gagal membuat journal entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Manual Journal Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Balance Warning Alert */}
          {totalDebit > 0 && !isBalanced && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Journal Entry Tidak Balance</AlertTitle>
              <AlertDescription>
                Total Debit ({formatCurrency(totalDebit)}) dan Credit ({formatCurrency(totalCredit)}) harus sama. 
                Selisih: <strong>{formatCurrency(difference)}</strong>. 
                Pastikan journal entry balance sebelum menyimpan.
              </AlertDescription>
            </Alert>
          )}

          {/* Missing Accounts Alert */}
          {totalDebit > 0 && !hasValidLines && (
            <Alert variant="destructive" className="border-warning/50 bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Akun Belum Lengkap</AlertTitle>
              <AlertDescription>
                Minimal 2 baris dengan akun dan nominal yang valid diperlukan untuk membuat journal entry.
              </AlertDescription>
            </Alert>
          )}

          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Entry Date *</label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Journal entry description..."
                className="input-field"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="form-label mb-0">Journal Lines</label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" />
                Add Line
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left w-[40%]">Account *</th>
                    <th className="px-3 py-2 text-right w-[20%]">Debit</th>
                    <th className="px-3 py-2 text-right w-[20%]">Credit</th>
                    <th className="px-3 py-2 text-left w-[15%]">Memo</th>
                    <th className="px-3 py-2 w-[5%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-2 py-2">
                        <Select
                          value={line.account_id}
                          onValueChange={(val) => updateLine(line.id, 'account_id', val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select account..." />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit_amount}
                          onChange={(e) => updateLine(line.id, 'debit_amount', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit_amount}
                          onChange={(e) => updateLine(line.id, 'credit_amount', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          placeholder="Memo..."
                          className="h-9"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {/* Totals */}
                  <tr className={cn(
                    "border-t font-semibold",
                    isBalanced && totalDebit > 0 ? "bg-success/10" : totalDebit > 0 ? "bg-destructive/10" : "bg-muted/50"
                  )}>
                    <td className="px-3 py-2">
                      Total
                      {!isBalanced && totalDebit > 0 && (
                        <span className="ml-2 text-xs text-destructive font-normal flex items-center gap-1 inline-flex">
                          <AlertCircle className="w-3 h-3" />
                          Difference: {formatCurrency(difference)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totalDebit)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totalCredit)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !isBalanced || totalDebit === 0 || !hasValidLines}
              title={!isBalanced ? 'Journal entry harus balance' : !hasValidLines ? 'Minimal 2 baris dengan akun valid' : ''}
            >
              {isSubmitting ? 'Saving...' : 'Create Journal Entry'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualJournalEntryForm;
