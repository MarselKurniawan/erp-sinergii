import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, ChevronRight, FolderOpen, Info, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const recommendedAccounts = [
  {
    category: 'Cash & Bank (1-1xxx)',
    type: 'cash_bank',
    accounts: [
      { code: '1-1001', name: 'Kas', description: 'Uang tunai' },
      { code: '1-1100', name: 'Bank BCA', description: 'Rekening bank' },
    ],
  },
  {
    category: 'Asset/Aset (1-2xxx - 1-3xxx)',
    type: 'asset',
    accounts: [
      { code: '1-2100', name: 'Piutang Usaha', description: 'Accounts Receivable' },
      { code: '1-2600', name: 'Persediaan', description: 'Inventory' },
      { code: '1-3100', name: 'Tanah', description: 'Fixed Asset' },
    ],
  },
  {
    category: 'Liability/Kewajiban (2-xxxx)',
    type: 'liability',
    accounts: [
      { code: '2-1100', name: 'Hutang Usaha', description: 'Accounts Payable' },
      { code: '2-1600', name: 'PPN Keluaran', description: 'VAT Out' },
    ],
  },
  {
    category: 'Equity/Modal (3-xxxx)',
    type: 'equity',
    accounts: [
      { code: '3-1100', name: 'Modal Disetor', description: 'Paid-in Capital' },
      { code: '3-2100', name: 'Laba Ditahan', description: 'Retained Earnings' },
    ],
  },
  {
    category: 'Revenue/Pendapatan (4-xxxx)',
    type: 'revenue',
    accounts: [
      { code: '4-1100', name: 'Penjualan', description: 'Sales Revenue' },
      { code: '4-1200', name: 'Diskon Penjualan', description: 'Sales Discount' },
    ],
  },
  {
    category: 'COGS/HPP (5-xxxx)',
    type: 'expense',
    accounts: [
      { code: '5-1100', name: 'Pembelian', description: 'Purchases / Direct Cost' },
      { code: '5-1200', name: 'Diskon Pembelian', description: 'Purchase Discount' },
    ],
  },
  {
    category: 'Operating Expense/Beban (6-xxxx)',
    type: 'expense',
    accounts: [
      { code: '6-1100', name: 'Beban Gaji', description: 'Salary Expense' },
      { code: '6-1200', name: 'Beban Sewa', description: 'Rent Expense' },
    ],
  },
  {
    category: 'Other Income/Pendapatan Lain (7-xxxx)',
    type: 'other_income',
    accounts: [
      { code: '7-1100', name: 'Pendapatan Bunga', description: 'Interest Income' },
      { code: '7-1200', name: 'Pendapatan Sewa', description: 'Rental Income' },
    ],
  },
  {
    category: 'Other Expense/Beban Lain (8-xxxx)',
    type: 'other_expenses',
    accounts: [
      { code: '8-1100', name: 'Beban Bunga', description: 'Interest Expense' },
      { code: '8-1500', name: 'Beban Pajak', description: 'Tax Expense' },
    ],
  },
];

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
  parent_id: string | null;
}

const accountTypes = [
  { value: 'asset', label: 'Asset', color: 'bg-primary/10 text-primary' },
  { value: 'liability', label: 'Liability', color: 'bg-destructive/10 text-destructive' },
  { value: 'equity', label: 'Equity', color: 'bg-accent/10 text-accent' },
  { value: 'revenue', label: 'Revenue', color: 'bg-success/10 text-success' },
  { value: 'expense', label: 'Expense', color: 'bg-warning/10 text-warning' },
  { value: 'cash_bank', label: 'Cash & Bank', color: 'bg-primary/10 text-primary' },
  { value: 'other_income', label: 'Other Income', color: 'bg-emerald-500/10 text-emerald-600' },
  { value: 'other_expenses', label: 'Other Expenses', color: 'bg-rose-500/10 text-rose-600' },
];

const getAccountTypeStyle = (type: string) => {
  return accountTypes.find(t => t.value === type)?.color || 'bg-muted text-muted-foreground';
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

// Check if account code indicates a header (ends with 000)
const isHeaderAccount = (code: string): boolean => {
  return code.endsWith('000') || code.endsWith('-1000') || code.endsWith('-2000') || code.endsWith('-3000');
};

// Get the prefix to determine parent-child relationship
const getAccountPrefix = (code: string): string => {
  // e.g., "1-1001" -> "1-1", "6-1100" -> "6-1"
  const parts = code.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].substring(0, 1)}`;
  }
  return code.substring(0, 2);
};

export const ChartOfAccounts: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: 'asset',
    is_active: true,
  });

  const fetchAccounts = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('code');

    if (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
      setIsLoading(false);
      return;
    }

    const accountList = (data || []) as Account[];

    // Compute real-time balance from journal entry lines
    const { data: journalLines } = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit_amount, credit_amount, journal_entries!inner(company_id, is_posted)')
      .eq('journal_entries.company_id', selectedCompany.id);

    const totals: Record<string, { debit: number; credit: number }> = {};
    (journalLines || []).forEach((line: any) => {
      const id = line.account_id;
      if (!totals[id]) totals[id] = { debit: 0, credit: 0 };
      totals[id].debit += Number(line.debit_amount || 0);
      totals[id].credit += Number(line.credit_amount || 0);
    });

    const debitNormal = new Set(['asset', 'expense', 'cash_bank', 'other_expenses']);
    const withBalance = accountList.map(acc => {
      const t = totals[acc.id] || { debit: 0, credit: 0 };
      const balance = debitNormal.has(acc.account_type)
        ? t.debit - t.credit
        : t.credit - t.debit;
      return { ...acc, balance };
    });

    setAccounts(withBalance);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedCompany]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const accountType = formData.account_type as "asset" | "liability" | "equity" | "revenue" | "expense" | "cash_bank" | "other_income" | "other_expenses";
    
    if (editingAccount) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({
          code: formData.code,
          name: formData.name,
          account_type: accountType,
          is_active: formData.is_active,
        })
        .eq('id', editingAccount.id);

      if (error) {
        toast.error('Failed to update account');
      } else {
        toast.success('Account updated successfully');
        fetchAccounts();
      }
    } else {
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert([{
          company_id: selectedCompany.id,
          code: formData.code,
          name: formData.name,
          account_type: accountType,
          is_active: formData.is_active,
        }]);

      if (error) {
        if (error.code === '23505') {
          toast.error('Account code already exists');
        } else {
          toast.error('Failed to create account');
        }
      } else {
        toast.success('Account created successfully');
        fetchAccounts();
      }
    }

    setIsDialogOpen(false);
    setEditingAccount(null);
    setFormData({ code: '', name: '', account_type: 'asset', is_active: true });
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      is_active: account.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    const { error } = await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        toast.error('Cannot delete: account is used in transactions');
      } else {
        toast.error('Failed to delete account');
      }
    } else {
      toast.success('Account deleted successfully');
      fetchAccounts();
    }
  };

  const toggleAccountStatus = async (account: Account) => {
    const { error } = await supabase
      .from('chart_of_accounts')
      .update({ is_active: !account.is_active })
      .eq('id', account.id);

    if (error) {
      toast.error('Failed to update account status');
    } else {
      toast.success(`Account ${account.is_active ? 'deactivated' : 'activated'}`);
      fetchAccounts();
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || account.account_type === filterType;
    const matchesActive = showInactive || account.is_active;
    return matchesSearch && matchesType && matchesActive;
  });

  // Group accounts by major category (first digit)
  const groupedByCategory = filteredAccounts.reduce((acc, account) => {
    const firstDigit = account.code.charAt(0);
    if (!acc[firstDigit]) {
      acc[firstDigit] = [];
    }
    acc[firstDigit].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const categoryLabels: Record<string, { label: string; type: string; color: string }> = {
    '1': { label: 'Aset (Assets)', type: 'asset', color: 'bg-blue-500' },
    '2': { label: 'Kewajiban (Liabilities)', type: 'liability', color: 'bg-red-500' },
    '3': { label: 'Modal (Equity)', type: 'equity', color: 'bg-purple-500' },
    '4': { label: 'Pendapatan (Revenue)', type: 'revenue', color: 'bg-green-500' },
    '5': { label: 'Harga Pokok (COGS)', type: 'expense', color: 'bg-orange-500' },
    '6': { label: 'Beban Operasional (Operating Expenses)', type: 'expense', color: 'bg-amber-500' },
    '7': { label: 'Pendapatan Lain-lain (Other Income)', type: 'other_income', color: 'bg-emerald-500' },
    '8': { label: 'Beban Lain-lain (Other Expenses)', type: 'other_expenses', color: 'bg-rose-500' },
  };

  return (
    <div className="space-y-6">
      {/* Account Guide Alert */}
      <Collapsible open={showGuide} onOpenChange={setShowGuide}>
        <Card className="border-primary/20 bg-primary/5">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base font-medium text-primary">
                    Panduan Chart of Accounts (Penomoran 1-8)
                  </CardTitle>
                </div>
                {showGuide ? (
                  <ChevronUp className="w-4 h-4 text-primary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-primary" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground mb-4">
                Sistem penomoran akun berdasarkan standar akuntansi internasional:
              </p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {recommendedAccounts.map((category) => (
                  <div key={category.category} className="space-y-1.5 bg-background/50 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-foreground">
                      {category.category}
                    </h4>
                    <ul className="space-y-0.5">
                      {category.accounts.map((acc) => (
                        <li key={acc.code} className="text-xs text-muted-foreground">
                          <span className="font-mono text-foreground/70">{acc.code}</span> - {acc.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your accounting structure
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="gradient-primary text-primary-foreground shadow-glow"
              onClick={() => {
                setEditingAccount(null);
                setFormData({ code: '', name: '', account_type: 'asset', is_active: true });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Edit Account' : 'Create New Account'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="form-label">Account Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., 1-1001"
                  className="input-field"
                  required
                  disabled={!!editingAccount}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editingAccount
                    ? 'Kode akun tidak bisa diubah untuk menjaga integritas data.'
                    : 'Format: X-XXXX (contoh: 1-1001 untuk Kas, 6-1100 untuk Beban Gaji)'}
                </p>
              </div>
              <div>
                <label className="form-label">Account Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Cash on Hand"
                  className="input-field"
                  required
                  disabled={!!editingAccount}
                />
                {editingAccount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nama akun tidak bisa diubah. Anda hanya dapat mengubah status aktif.
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">Account Type</label>
                <SearchableSelect
                  options={accountTypes.map(type => ({ value: type.value, label: type.label }))}
                  value={formData.account_type}
                  onChange={(value) => setFormData({ ...formData, account_type: value })}
                  placeholder="Select account type"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="form-label mb-0">Active Status</label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  {editingAccount ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="pl-10 input-field"
          />
        </div>
        <div className="w-full sm:w-48">
          <SearchableSelect
            options={[
              { value: 'all', label: 'All Types' },
              ...accountTypes.map(type => ({ value: type.value, label: type.label })),
            ]}
            value={filterType}
            onChange={setFilterType}
            placeholder="Filter by type"
          />
        </div>
        <Button
          variant={showInactive ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
          className="whitespace-nowrap"
        >
          {showInactive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
          {showInactive ? 'Showing All' : 'Show Inactive'}
        </Button>
      </div>

      {/* Accounts List - Grouped by Category (1-8) */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading accounts...</div>
      ) : filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No accounts found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filterType !== 'all' 
                  ? 'Try adjusting your search or filter'
                  : 'Get started by adding your first account'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.keys(groupedByCategory).sort().map((category) => {
            const categoryAccounts = groupedByCategory[category];
            const categoryInfo = categoryLabels[category] || { label: `Category ${category}`, type: 'asset', color: 'bg-gray-500' };

            return (
              <Card key={category} className="animate-fade-in overflow-hidden">
                <CardHeader className="pb-2 bg-muted/30">
                  <CardTitle className="flex items-center gap-3 text-base">
                    <span className={cn('w-3 h-3 rounded-full', categoryInfo.color)} />
                    <span>{category}. {categoryInfo.label}</span>
                    <Badge variant="secondary" className="font-normal">
                      {categoryAccounts.length} akun
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="text-xs">
                          <th className="px-4 py-2 text-left font-medium">Code</th>
                          <th className="px-4 py-2 text-left font-medium">Account Name</th>
                          <th className="px-4 py-2 text-center font-medium">Status</th>
                          <th className="px-4 py-2 text-right font-medium">Balance</th>
                          <th className="px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {categoryAccounts.map((account) => {
                          const isHeader = isHeaderAccount(account.code);
                          
                          return (
                            <tr 
                              key={account.id}
                              className={cn(
                                'text-sm transition-colors hover:bg-muted/30',
                                !account.is_active && 'opacity-50 bg-muted/20',
                                isHeader && 'bg-muted/40 font-semibold'
                              )}
                            >
                              <td className="px-4 py-2.5">
                                <span className={cn(
                                  'font-mono',
                                  isHeader ? 'text-primary font-bold' : 'text-muted-foreground'
                                )}>
                                  {account.code}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {!isHeader && (
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                  )}
                                  <span className={cn(
                                    isHeader && 'text-foreground font-semibold'
                                  )}>
                                    {account.name}
                                  </span>
                                  {isHeader && (
                                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                                      Header
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleAccountStatus(account)}
                                  className={cn(
                                    'h-7 px-2',
                                    account.is_active 
                                      ? 'text-green-600 hover:text-green-700' 
                                      : 'text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  {account.is_active ? (
                                    <ToggleRight className="w-5 h-5" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5" />
                                  )}
                                </Button>
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                {formatCurrency(account.balance || 0)}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(account)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(account.id)}
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
