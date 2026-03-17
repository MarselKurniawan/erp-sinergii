import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileDown, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/lib/formatters';
import { exportToCSV, exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface AccountBalance {
  code: string;
  name: string;
  account_type: string;
  debit: number;
  credit: number;
}

const TrialBalance: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);

    // Fetch all journal entry lines up to the as-of date
    const { data: entries, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit_amount,
        credit_amount,
        account:chart_of_accounts!inner(id, code, name, account_type, company_id),
        journal_entry:journal_entries!inner(entry_date, is_posted, company_id)
      `)
      .eq('journal_entry.company_id', selectedCompany.id)
      .eq('journal_entry.is_posted', true)
      .lte('journal_entry.entry_date', asOfDate);

    if (error) {
      console.error('Error fetching trial balance:', error);
      setIsLoading(false);
      return;
    }

    // Group by account and calculate balances
    const accountMap = new Map<string, AccountBalance>();
    
    (entries || []).forEach((entry: any) => {
      // Skip if no account or journal_entry is null (filtered out by company_id)
      if (!entry.account || !entry.journal_entry) return;
      
      const key = entry.account.id;
      const debit = entry.debit_amount || 0;
      const credit = entry.credit_amount || 0;
      
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          code: entry.account.code,
          name: entry.account.name,
          account_type: entry.account.account_type,
          debit: 0,
          credit: 0,
        });
      }
      
      const account = accountMap.get(key)!;
      account.debit += debit;
      account.credit += credit;
    });

    // Convert to array and calculate net balance position
    const accountList = Array.from(accountMap.values()).map(acc => {
      const netDebit = acc.debit - acc.credit;
      // For debit-normal accounts (asset, expense), positive net = debit balance
      // For credit-normal accounts (liability, equity, revenue), positive net = credit balance shown as negative
      const isDebitNormal = ['asset', 'expense', 'cash_bank'].includes(acc.account_type);
      
      if (isDebitNormal) {
        return {
          ...acc,
          debit: netDebit > 0 ? netDebit : 0,
          credit: netDebit < 0 ? Math.abs(netDebit) : 0,
        };
      } else {
        return {
          ...acc,
          debit: netDebit > 0 ? netDebit : 0,
          credit: netDebit < 0 ? Math.abs(netDebit) : 0,
        };
      }
    });

    // Sort by account code
    accountList.sort((a, b) => a.code.localeCompare(b.code));

    setAccounts(accountList);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany, asOfDate]);

  const totalDebit = accounts.reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredit = accounts.reduce((sum, acc) => sum + acc.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01;

  const exportMeta = {
    companyName: selectedCompany?.name || '',
    reportTitle: 'Trial Balance',
    dateLabel: `Per tanggal: ${asOfDate}`,
  };

  const handleExportCSV = () => {
    const data = accounts.map(acc => ({
      'Kode Akun': acc.code,
      'Nama Akun': acc.name,
      'Tipe': acc.account_type,
      'Debit': acc.debit,
      'Credit': acc.credit,
    }));
    data.push({
      'Kode Akun': '',
      'Nama Akun': 'TOTAL',
      'Tipe': '',
      'Debit': totalDebit,
      'Credit': totalCredit,
    });
    exportToCSV(data, `trial-balance-${asOfDate}`, exportMeta);
  };

  const handleExportExcel = () => {
    const data = accounts.map(acc => ({
      'Kode Akun': acc.code,
      'Nama Akun': acc.name,
      'Tipe': acc.account_type,
      'Debit': acc.debit,
      'Credit': acc.credit,
    }));
    data.push({
      'Kode Akun': '',
      'Nama Akun': 'TOTAL',
      'Tipe': '',
      'Debit': totalDebit,
      'Credit': totalCredit,
    });
    exportToExcel(data, `trial-balance-${asOfDate}`, 'Trial Balance', exportMeta);
  };

  const handleExportPDF = () => {
    const headers = ['Kode Akun', 'Nama Akun', 'Tipe', 'Debit', 'Credit'];
    const data = accounts.map(acc => [
      acc.code,
      acc.name,
      acc.account_type,
      formatCurrency(acc.debit),
      formatCurrency(acc.credit),
    ]);
    const tableHtml = generatePDFTable(headers, data, {
      totalRow: ['', 'TOTAL', '', formatCurrency(totalDebit), formatCurrency(totalCredit)],
    });
    exportToPDF('Trial Balance', tableHtml, exportMeta);
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Silakan pilih perusahaan terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Trial Balance</h1>
          <p className="text-muted-foreground">Neraca saldo semua akun</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
              <FileText className="w-4 h-4" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
              <FileDown className="w-4 h-4" />
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Per Tanggal:</label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Status */}
      <Card className={isBalanced ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-success' : 'bg-destructive'}`} />
              <span className="font-medium">
                {isBalanced ? 'Balanced' : 'Not Balanced'}
              </span>
            </div>
            {!isBalanced && (
              <span className="text-destructive font-medium">
                Selisih: {formatCurrency(difference)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trial Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Neraca Saldo per {asOfDate}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading report...</p>
          ) : accounts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Tidak ada transaksi yang sudah diposting sampai tanggal ini.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode Akun</TableHead>
                  <TableHead>Nama Akun</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{acc.code}</TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell className="capitalize">{acc.account_type.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right font-mono">
                      {acc.debit > 0 ? formatCurrency(acc.debit) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {acc.credit > 0 ? formatCurrency(acc.credit) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalCredit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialBalance;
