import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface AccountBalance {
  account_type: string;
  name: string;
  code: string;
  total_debit: number;
  total_credit: number;
  balance: number;
  is_cogs?: boolean;
}

export const ProfitLoss: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(0, 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [revenueAccounts, setRevenueAccounts] = useState<AccountBalance[]>([]);
  const [cogsAccounts, setCogsAccounts] = useState<AccountBalance[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);

    // Get COGS account IDs from products
    const { data: products } = await supabase
      .from('products')
      .select('cogs_account_id')
      .eq('company_id', selectedCompany.id)
      .not('cogs_account_id', 'is', null);

    const cogsAccountIds = new Set(products?.map(p => p.cogs_account_id).filter(Boolean) || []);

    // Get all journal entry lines within date range
    const { data: entries, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit_amount,
        credit_amount,
        account:chart_of_accounts!journal_entry_lines_account_id_fkey(
          id, code, name, account_type
        ),
        journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
          entry_date, is_posted, company_id
        )
      `)
      .gte('journal_entry.entry_date', startDate)
      .lte('journal_entry.entry_date', endDate)
      .eq('journal_entry.company_id', selectedCompany.id)
      .eq('journal_entry.is_posted', true);

    if (error) {
      console.error('Error fetching P&L data:', error);
      toast.error('Failed to load report data');
      setIsLoading(false);
      return;
    }

    // Group by account - filter entries that match the company (Supabase filter on joined tables can return null)
    const accountMap = new Map<string, AccountBalance>();
    
    (entries || []).forEach((entry: any) => {
      // Skip if no account or journal_entry is null (filtered out by company_id)
      if (!entry.account || !entry.journal_entry) return;
      
      const key = entry.account.id;
      
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          account_type: entry.account.account_type,
          name: entry.account.name,
          code: entry.account.code,
          total_debit: 0,
          total_credit: 0,
          balance: 0,
          is_cogs: cogsAccountIds.has(entry.account.id),
        });
      }
      
      const acc = accountMap.get(key)!;
      acc.total_debit += entry.debit_amount || 0;
      acc.total_credit += entry.credit_amount || 0;
    });

    // Calculate balances
    accountMap.forEach((acc) => {
      if (acc.account_type === 'revenue') {
        acc.balance = acc.total_credit - acc.total_debit;
      } else if (acc.account_type === 'expense') {
        acc.balance = acc.total_debit - acc.total_credit;
      }
    });

    const accounts = Array.from(accountMap.values());
    
    // Separate COGS from other expenses
    const expenses = accounts.filter(a => a.account_type === 'expense');
    const cogs = expenses.filter(a => a.is_cogs || a.name.toLowerCase().includes('cogs') || a.name.toLowerCase().includes('cost of'));
    const otherExpenses = expenses.filter(a => !a.is_cogs && !a.name.toLowerCase().includes('cogs') && !a.name.toLowerCase().includes('cost of'));
    
    setRevenueAccounts(accounts.filter(a => a.account_type === 'revenue').sort((a, b) => a.code.localeCompare(b.code)));
    setCogsAccounts(cogs.sort((a, b) => a.code.localeCompare(b.code)));
    setExpenseAccounts(otherExpenses.sort((a, b) => a.code.localeCompare(b.code)));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany, startDate, endDate]);

  const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalCogs = cogsAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const netIncome = grossProfit - totalExpenses;

  const exportMeta = {
    companyName: selectedCompany?.name || '',
    reportTitle: 'Profit & Loss Statement',
    dateLabel: `Periode: ${startDate} s/d ${endDate}`,
  };

  const handleExportCSV = () => {
    const data = [
      ...revenueAccounts.map(a => ({ Type: 'Revenue', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Total Revenue', Amount: totalRevenue },
      ...cogsAccounts.map(a => ({ Type: 'COGS', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Total COGS', Amount: totalCogs },
      { Type: 'Summary', Code: '', Account: 'Gross Profit', Amount: grossProfit },
      ...expenseAccounts.map(a => ({ Type: 'Expense', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Total Expenses', Amount: totalExpenses },
      { Type: 'Summary', Code: '', Account: 'Net Income', Amount: netIncome }
    ];
    exportToCSV(data, `profit-loss-${startDate}-to-${endDate}`, exportMeta);
    toast.success('Exported to CSV');
  };

  const handleExportExcel = () => {
    const data = [
      ...revenueAccounts.map(a => ({ Type: 'Revenue', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Total Revenue', Amount: totalRevenue },
      ...cogsAccounts.map(a => ({ Type: 'COGS', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Total COGS', Amount: totalCogs },
      { Type: 'Summary', Code: '', Account: 'Gross Profit', Amount: grossProfit },
      ...expenseAccounts.map(a => ({ Type: 'Expense', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Total Expenses', Amount: totalExpenses },
      { Type: 'Summary', Code: '', Account: 'Net Income', Amount: netIncome }
    ];
    exportToExcel(data, `profit-loss-${startDate}-to-${endDate}`, 'Profit & Loss', exportMeta);
    toast.success('Exported to Excel');
  };

  const handleExportPDF = () => {
    const revenueRows = revenueAccounts.map(a => [a.code, a.name, formatCurrency(a.balance)]);
    const cogsRows = cogsAccounts.map(a => [a.code, a.name, formatCurrency(a.balance)]);
    const expenseRows = expenseAccounts.map(a => [a.code, a.name, formatCurrency(a.balance)]);
    
    const html = `
      <h3>Revenue</h3>
      ${generatePDFTable(['Code', 'Account', 'Amount'], revenueRows, { totalRow: ['', 'Total Revenue', formatCurrency(totalRevenue)] })}
      <h3>Cost of Goods Sold</h3>
      ${generatePDFTable(['Code', 'Account', 'Amount'], cogsRows, { totalRow: ['', 'Total COGS', formatCurrency(totalCogs)] })}
      <h3 style="background: #f0f0f0; padding: 8px;">Gross Profit: ${formatCurrency(grossProfit)}</h3>
      <h3>Operating Expenses</h3>
      ${generatePDFTable(['Code', 'Account', 'Amount'], expenseRows, { totalRow: ['', 'Total Expenses', formatCurrency(totalExpenses)] })}
      <h3>Net ${netIncome >= 0 ? 'Profit' : 'Loss'}: ${formatCurrency(netIncome)}</h3>
    `;
    exportToPDF('Profit & Loss Statement', html, exportMeta);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Profit & Loss Statement</h1>
          <p className="text-muted-foreground mt-1">Income and expenses summary</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1">
              <label className="form-label">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
            <Button onClick={fetchData} variant="outline">
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">COGS</p>
            <p className="text-xl font-bold">{formatCurrency(totalCogs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Gross Profit</p>
            <p className="text-xl font-bold">{formatCurrency(grossProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net {netIncome >= 0 ? 'Profit' : 'Loss'}</p>
            <p className={cn("text-xl font-bold", netIncome >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(Math.abs(netIncome))}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading report...</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* Revenue Section */}
                <tr className="bg-muted/50">
                  <td colSpan={3} className="font-bold">REVENUE</td>
                </tr>
                {revenueAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted-foreground py-4">
                      No revenue recorded
                    </td>
                  </tr>
                ) : (
                  revenueAccounts.map((acc) => (
                    <tr key={acc.code}>
                      <td className="font-mono pl-6">{acc.code}</td>
                      <td>{acc.name}</td>
                      <td className="text-right font-medium">{formatCurrency(acc.balance)}</td>
                    </tr>
                  ))
                )}
                <tr className="font-semibold border-t">
                  <td colSpan={2} className="pl-4">Total Revenue</td>
                  <td className="text-right">{formatCurrency(totalRevenue)}</td>
                </tr>

                {/* COGS Section */}
                <tr className="bg-muted/50">
                  <td colSpan={3} className="font-bold">COST OF GOODS SOLD (COGS)</td>
                </tr>
                {cogsAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted-foreground py-4">
                      No COGS recorded
                    </td>
                  </tr>
                ) : (
                  cogsAccounts.map((acc) => (
                    <tr key={acc.code}>
                      <td className="font-mono pl-6">{acc.code}</td>
                      <td>{acc.name}</td>
                      <td className="text-right font-medium">{formatCurrency(acc.balance)}</td>
                    </tr>
                  ))
                )}
                <tr className="font-semibold border-t">
                  <td colSpan={2} className="pl-4">Total COGS</td>
                  <td className="text-right">{formatCurrency(totalCogs)}</td>
                </tr>

                {/* Gross Profit */}
                <tr className="bg-muted font-bold">
                  <td colSpan={2}>GROSS PROFIT</td>
                  <td className="text-right">{formatCurrency(grossProfit)}</td>
                </tr>

                {/* Operating Expenses Section */}
                <tr className="bg-muted/50">
                  <td colSpan={3} className="font-bold">OPERATING EXPENSES</td>
                </tr>
                {expenseAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted-foreground py-4">
                      No expenses recorded
                    </td>
                  </tr>
                ) : (
                  expenseAccounts.map((acc) => (
                    <tr key={acc.code}>
                      <td className="font-mono pl-6">{acc.code}</td>
                      <td>{acc.name}</td>
                      <td className="text-right font-medium">{formatCurrency(acc.balance)}</td>
                    </tr>
                  ))
                )}
                <tr className="font-semibold border-t">
                  <td colSpan={2} className="pl-4">Total Operating Expenses</td>
                  <td className="text-right">{formatCurrency(totalExpenses)}</td>
                </tr>

                {/* Net Income */}
                <tr className="bg-muted font-bold text-lg">
                  <td colSpan={2}>NET {netIncome >= 0 ? 'PROFIT' : 'LOSS'}</td>
                  <td className={cn("text-right", netIncome >= 0 ? "text-success" : "text-destructive")}>
                    {formatCurrency(netIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfitLoss;
