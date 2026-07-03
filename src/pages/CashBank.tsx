import React, { useState, useEffect } from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface CashAccount {
  id: string;
  code: string;
  name: string;
  balance: number;
}

interface CashTransaction {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  reference_type: string | null;
}

export const CashBank: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch cash/bank accounts
  const fetchAccounts = async () => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('company_id', selectedCompany.id)
      .eq('account_type', 'cash_bank')
      .eq('is_active', true)
      .order('code');

    if (data && data.length > 0) {
      // Calculate balance for each account
      const accountsWithBalance: CashAccount[] = [];
      
      for (const acc of data) {
        const { data: entries } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
              is_posted, company_id
            )
          `)
          .eq('account_id', acc.id)
          .eq('journal_entry.is_posted', true)
          .eq('journal_entry.company_id', selectedCompany.id);

        let balance = 0;
        (entries || []).forEach((entry: any) => {
          balance += (entry.debit_amount || 0) - (entry.credit_amount || 0);
        });

        accountsWithBalance.push({
          ...acc,
          balance,
        });
      }

      setAccounts(accountsWithBalance);
      if (accountsWithBalance.length > 0) {
        setSelectedAccount(accountsWithBalance[0].id);
      }
    }
    setIsLoading(false);
  };

  // Fetch transactions for selected account
  const fetchTransactions = async () => {
    if (!selectedCompany || !selectedAccount) return;

    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        id,
        debit_amount,
        credit_amount,
        description,
        journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
          entry_date, entry_number, description, reference_type, is_posted, company_id
        )
      `)
      .eq('account_id', selectedAccount)
      .eq('journal_entry.is_posted', true)
      .eq('journal_entry.company_id', selectedCompany.id)
      .order('journal_entry(entry_date)', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
      return;
    }

    // Calculate running balance (from oldest to newest, then reverse for display)
    const sorted = [...(data || [])].sort((a: any, b: any) => 
      new Date(a.journal_entry?.entry_date).getTime() - new Date(b.journal_entry?.entry_date).getTime()
    );

    let runningBalance = 0;
    const txns: CashTransaction[] = sorted.map((entry: any) => {
      const debit = entry.debit_amount || 0;
      const credit = entry.credit_amount || 0;
      runningBalance += debit - credit;
      
      return {
        id: entry.id,
        entry_date: entry.journal_entry?.entry_date,
        entry_number: entry.journal_entry?.entry_number,
        description: entry.description || entry.journal_entry?.description || '',
        debit_amount: debit,
        credit_amount: credit,
        running_balance: runningBalance,
        reference_type: entry.journal_entry?.reference_type,
      };
    }).reverse();

    setTransactions(txns);
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedCompany]);

  useEffect(() => {
    fetchTransactions();
  }, [selectedAccount]);

  const selectedAccountData = accounts.find(a => a.id === selectedAccount);
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const totalIn = transactions.reduce((sum, t) => sum + t.debit_amount, 0);
  const totalOut = transactions.reduce((sum, t) => sum + t.credit_amount, 0);

  const filteredTransactions = transactions.filter(t =>
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.entry_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Cash & Bank</h1>
        <p className="text-muted-foreground mt-1">Manage your cash and bank accounts</p>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className={cn(
                  'text-2xl font-bold',
                  totalBalance >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <Wallet className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        
        {accounts.map((acc) => (
          <Card 
            key={acc.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              selectedAccount === acc.id && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedAccount(acc.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-mono">{acc.code}</p>
                  <p className="font-medium text-sm">{acc.name}</p>
                  <p className={cn(
                    'text-lg font-bold mt-1',
                    acc.balance >= 0 ? 'text-foreground' : 'text-destructive'
                  )}>
                    {formatCurrency(acc.balance)}
                  </p>
                </div>
                <Wallet className="w-8 h-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedAccountData && (
        <>
          {/* Transaction Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total In</p>
                    <p className="font-semibold text-success">{formatCurrency(totalIn)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <ArrowDownRight className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Out</p>
                    <p className="font-semibold text-destructive">{formatCurrency(totalOut)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Balance</p>
                    <p className="font-semibold">{formatCurrency(selectedAccountData.balance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg">
                  Transactions - {selectedAccountData.name}
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search transactions..."
                    className="pl-10 input-field"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No transactions found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Entry #</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th className="text-right">In</th>
                        <th className="text-right">Out</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((txn) => (
                        <tr key={txn.id}>
                          <td>{formatDate(txn.entry_date)}</td>
                          <td className="font-mono text-sm">{txn.entry_number}</td>
                          <td className="max-w-xs truncate">{txn.description}</td>
                          <td>
                            {txn.reference_type && (
                              <span className="badge-status bg-muted capitalize">
                                {txn.reference_type}
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            {txn.debit_amount > 0 ? (
                              <span className="text-success font-medium">
                                +{formatCurrency(txn.debit_amount)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="text-right">
                            {txn.credit_amount > 0 ? (
                              <span className="text-destructive font-medium">
                                -{formatCurrency(txn.credit_amount)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="text-right font-medium">
                            {formatCurrency(txn.running_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {accounts.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Cash/Bank Accounts</h3>
              <p className="text-muted-foreground">
                Create cash or bank accounts in Chart of Accounts with type "Cash & Bank"
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CashBank;
