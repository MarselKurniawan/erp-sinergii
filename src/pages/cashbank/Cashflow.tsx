import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown } from 'lucide-react';
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
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface CashflowItem {
  id: string;
  date: string;
  entryNumber: string;
  type: 'increase' | 'decrease';
  amount: number;
  category: 'beban' | 'non_beban';
  cashAccount: string;
  cashAccountCode: string;
  contraAccount: string;
  contraAccountCode: string;
  contraAccountType: string;
}

export const Cashflow: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [transactions, setTransactions] = useState<CashflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchCashflow = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    // Get all cash/bank accounts first
    const { data: cashAccounts } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('company_id', selectedCompany.id)
      .eq('account_type', 'cash_bank')
      .eq('is_active', true);

    const cashAccountIds = (cashAccounts || []).map(a => a.id);
    const cashAccountMap = Object.fromEntries(
      (cashAccounts || []).map(a => [a.id, { code: a.code, name: a.name }])
    );

    if (cashAccountIds.length === 0) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    // Get journal entry lines for cash accounts
    const { data: cashLines, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        id,
        account_id,
        debit_amount,
        credit_amount,
        journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
          id, entry_date, entry_number, is_posted, company_id
        )
      `)
      .in('account_id', cashAccountIds)
      .eq('journal_entry.is_posted', true)
      .eq('journal_entry.company_id', selectedCompany.id)
      .gte('journal_entry.entry_date', dateFrom)
      .lte('journal_entry.entry_date', dateTo)
      .order('journal_entry(entry_date)', { ascending: false });

    if (error) {
      console.error('Error fetching cashflow:', error);
      setIsLoading(false);
      return;
    }

    // For each cash line, find the contra account(s)
    const items: CashflowItem[] = [];

    for (const line of cashLines || []) {
      if (!line.journal_entry) continue;
      
      const journalEntryId = (line.journal_entry as any).id;
      
      // Get all lines for this journal entry to find contra account
      const { data: allLines } = await supabase
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          account:chart_of_accounts!journal_entry_lines_account_id_fkey(
            id, code, name, account_type
          )
        `)
        .eq('journal_entry_id', journalEntryId)
        .neq('account_id', line.account_id);

      // Find the main contra account (the one with opposite amount)
      const isDebit = (line.debit_amount || 0) > 0;
      const amount = isDebit ? line.debit_amount || 0 : line.credit_amount || 0;
      
      // Get contra accounts
      const contraLines = (allLines || []).filter((l: any) => {
        if (isDebit) return (l.credit_amount || 0) > 0;
        return (l.debit_amount || 0) > 0;
      });

      // Take the first contra account (or combine if multiple)
      const contraAccount = contraLines[0]?.account as any;
      const contraAccountType = contraAccount?.account_type || '';
      
      // Determine category: expense accounts are beban, others are non_beban
      const isBeban = contraAccountType === 'expense' || 
                      (isDebit === false && contraAccountType === 'asset');
      
      const cashAcc = cashAccountMap[line.account_id];
      
      items.push({
        id: line.id,
        date: (line.journal_entry as any).entry_date,
        entryNumber: (line.journal_entry as any).entry_number,
        type: isDebit ? 'increase' : 'decrease',
        amount,
        category: isBeban ? 'beban' : 'non_beban',
        cashAccount: cashAcc?.name || '',
        cashAccountCode: cashAcc?.code || '',
        contraAccount: contraAccount?.name || (contraLines.length > 1 ? `${contraLines.length} accounts` : '-'),
        contraAccountCode: contraAccount?.code || '',
        contraAccountType,
      });
    }

    setTransactions(items);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCashflow();
  }, [selectedCompany, dateFrom, dateTo]);

  const filteredTransactions = transactions.filter(t => 
    filterCategory === 'all' || t.category === filterCategory
  );

  const totalIncrease = filteredTransactions
    .filter(t => t.type === 'increase')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDecrease = filteredTransactions
    .filter(t => t.type === 'decrease')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashflow = totalIncrease - totalDecrease;

  const bebanTotal = filteredTransactions
    .filter(t => t.category === 'beban')
    .reduce((sum, t) => sum + t.amount, 0);

  const nonBebanTotal = filteredTransactions
    .filter(t => t.category === 'non_beban')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Cashflow</h1>
          <p className="text-muted-foreground mt-1">Arus kas masuk dan keluar dengan detail akun</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="form-label">Dari Tanggal</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="form-label">Sampai Tanggal</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="form-label">Kategori</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="beban">Beban</SelectItem>
                  <SelectItem value="non_beban">Non-Beban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <ArrowUpCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pemasukan</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalIncrease)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ArrowDownCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDecrease)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          'border',
          netCashflow >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-warning/5 border-warning/20'
        )}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                netCashflow >= 0 ? 'bg-primary/10' : 'bg-warning/10'
              )}>
                {netCashflow >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-primary" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-warning" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Cashflow</p>
                <p className={cn(
                  'text-2xl font-bold',
                  netCashflow >= 0 ? 'text-primary' : 'text-warning'
                )}>
                  {formatCurrency(netCashflow)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Beban</span>
                <span className="font-medium text-destructive">{formatCurrency(bebanTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Non-Beban</span>
                <span className="font-medium text-success">{formatCurrency(nonBebanTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Transaksi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada transaksi dalam periode ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>No. Jurnal</th>
                    <th>Akun Kas/Bank</th>
                    <th>Akun Lawan</th>
                    <th>Kategori</th>
                    <th className="text-right">Increase</th>
                    <th className="text-right">Decrease</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>{formatDate(txn.date)}</td>
                      <td className="font-mono text-sm">{txn.entryNumber}</td>
                      <td>
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">{txn.cashAccountCode}</span>
                          <p className="font-medium">{txn.cashAccount}</p>
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">{txn.contraAccountCode}</span>
                          <p className="font-medium">{txn.contraAccount}</p>
                          <span className="text-xs text-muted-foreground capitalize">{txn.contraAccountType.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td>
                        <span className={cn(
                          'badge-status',
                          txn.category === 'beban' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                        )}>
                          {txn.category === 'beban' ? 'Beban' : 'Non-Beban'}
                        </span>
                      </td>
                      <td className="text-right">
                        {txn.type === 'increase' ? (
                          <span className="text-success font-medium">
                            +{formatCurrency(txn.amount)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="text-right">
                        {txn.type === 'decrease' ? (
                          <span className="text-destructive font-medium">
                            -{formatCurrency(txn.amount)}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={5}>Total</td>
                    <td className="text-right text-success">{formatCurrency(totalIncrease)}</td>
                    <td className="text-right text-destructive">{formatCurrency(totalDecrease)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Cashflow;
