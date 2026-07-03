import React, { useState, useEffect } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface CashflowSummary {
  account: string;
  accountCode: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

export const CashflowReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [summaryData, setSummaryData] = useState<CashflowSummary[]>([]);

  const fetchCashflowReport = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    // Get all cash/bank accounts
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('company_id', selectedCompany.id)
      .eq('account_type', 'cash_bank')
      .eq('is_active', true)
      .order('code');

    const summaries: CashflowSummary[] = [];

    for (const acc of accounts || []) {
      // Get opening balance (entries before dateFrom)
      const { data: openingEntries } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount, credit_amount,
          journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
            entry_date, is_posted, company_id
          )
        `)
        .eq('account_id', acc.id)
        .eq('journal_entry.is_posted', true)
        .eq('journal_entry.company_id', selectedCompany.id)
        .lt('journal_entry.entry_date', dateFrom);

      let openingBalance = 0;
      (openingEntries || []).forEach((e: any) => {
        openingBalance += (e.debit_amount || 0) - (e.credit_amount || 0);
      });

      // Get period movements
      const { data: periodEntries } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount, credit_amount,
          journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
            entry_date, is_posted, company_id
          )
        `)
        .eq('account_id', acc.id)
        .eq('journal_entry.is_posted', true)
        .eq('journal_entry.company_id', selectedCompany.id)
        .gte('journal_entry.entry_date', dateFrom)
        .lte('journal_entry.entry_date', dateTo);

      let totalIn = 0;
      let totalOut = 0;
      (periodEntries || []).forEach((e: any) => {
        totalIn += e.debit_amount || 0;
        totalOut += e.credit_amount || 0;
      });

      summaries.push({
        account: acc.name,
        accountCode: acc.code,
        openingBalance,
        totalIn,
        totalOut,
        closingBalance: openingBalance + totalIn - totalOut,
      });
    }

    setSummaryData(summaries);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCashflowReport();
  }, [selectedCompany, dateFrom, dateTo]);

  const totals = summaryData.reduce(
    (acc, item) => ({
      openingBalance: acc.openingBalance + item.openingBalance,
      totalIn: acc.totalIn + item.totalIn,
      totalOut: acc.totalOut + item.totalOut,
      closingBalance: acc.closingBalance + item.closingBalance,
    }),
    { openingBalance: 0, totalIn: 0, totalOut: 0, closingBalance: 0 }
  );

  const netChange = totals.totalIn - totals.totalOut;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Cashflow Statement</h1>
          <p className="text-muted-foreground mt-1">Laporan arus kas per akun</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-[200px]">
              <label className="form-label">Dari Tanggal</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex-1 max-w-[200px]">
              <label className="form-label">Sampai Tanggal</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Wallet className="w-10 h-10 text-muted-foreground/20" />
              <div>
                <p className="text-sm text-muted-foreground">Saldo Awal</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.openingBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <ArrowUpCircle className="w-10 h-10 text-success/30" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pemasukan</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totals.totalIn)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <ArrowDownCircle className="w-10 h-10 text-destructive/30" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totals.totalOut)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(
          netChange >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-warning/5 border-warning/20'
        )}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <TrendingUp className={cn(
                'w-10 h-10',
                netChange >= 0 ? 'text-primary/30' : 'text-warning/30'
              )} />
              <div>
                <p className="text-sm text-muted-foreground">Saldo Akhir</p>
                <p className={cn(
                  'text-2xl font-bold',
                  totals.closingBalance >= 0 ? 'text-primary' : 'text-destructive'
                )}>
                  {formatCurrency(totals.closingBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail per Akun</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : summaryData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada akun kas/bank
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Akun</th>
                    <th className="text-right">Saldo Awal</th>
                    <th className="text-right">Pemasukan</th>
                    <th className="text-right">Pengeluaran</th>
                    <th className="text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((item) => (
                    <tr key={item.accountCode}>
                      <td className="font-mono text-sm">{item.accountCode}</td>
                      <td className="font-medium">{item.account}</td>
                      <td className="text-right">{formatCurrency(item.openingBalance)}</td>
                      <td className="text-right text-success">{formatCurrency(item.totalIn)}</td>
                      <td className="text-right text-destructive">{formatCurrency(item.totalOut)}</td>
                      <td className={cn(
                        'text-right font-bold',
                        item.closingBalance >= 0 ? 'text-foreground' : 'text-destructive'
                      )}>
                        {formatCurrency(item.closingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 bg-muted/50">
                    <td colSpan={2}>TOTAL</td>
                    <td className="text-right">{formatCurrency(totals.openingBalance)}</td>
                    <td className="text-right text-success">{formatCurrency(totals.totalIn)}</td>
                    <td className="text-right text-destructive">{formatCurrency(totals.totalOut)}</td>
                    <td className={cn(
                      'text-right',
                      totals.closingBalance >= 0 ? 'text-primary' : 'text-destructive'
                    )}>
                      {formatCurrency(totals.closingBalance)}
                    </td>
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

export default CashflowReport;
