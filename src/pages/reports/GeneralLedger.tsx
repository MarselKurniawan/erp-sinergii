import React, { useState, useEffect } from 'react';
import { BookOpen, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchableMultiSelect } from '@/components/ui/searchable-select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { exportToCSV, exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface LedgerEntry {
  entry_date: string;
  entry_number: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
}

interface AccountLedger {
  account: Account;
  openingBalance: number;
  entries: LedgerEntry[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export const GeneralLedger: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accountLedgers, setAccountLedgers] = useState<AccountLedger[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    fetchAccounts();
  }, [selectedCompany]);

  const fetchLedger = async () => {
    if (!selectedCompany || selectedAccounts.length === 0) {
      toast.error('Please select at least one account');
      return;
    }

    setIsLoading(true);
    const ledgers: AccountLedger[] = [];

    for (const accountId of selectedAccounts) {
      const account = accounts.find(a => a.id === accountId);
      if (!account) continue;

      const isDebitNormal = account.account_type === 'asset' || 
                            account.account_type === 'cash_bank' || 
                            account.account_type === 'expense';

      // Get opening balance (entries before start date)
      const { data: openingData } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
            entry_date, is_posted, company_id
          )
        `)
        .eq('account_id', accountId)
        .lt('journal_entry.entry_date', startDate)
        .eq('journal_entry.company_id', selectedCompany.id)
        .eq('journal_entry.is_posted', true);

      let opening = 0;
      (openingData || []).forEach((entry: any) => {
        if (!entry.journal_entry) return;
        const debit = entry.debit_amount || 0;
        const credit = entry.credit_amount || 0;
        opening += isDebitNormal ? (debit - credit) : (credit - debit);
      });

      // Get entries within date range
      const { data: entries, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          description,
          journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
            entry_date, entry_number, description, is_posted, company_id
          )
        `)
        .eq('account_id', accountId)
        .gte('journal_entry.entry_date', startDate)
        .lte('journal_entry.entry_date', endDate)
        .eq('journal_entry.company_id', selectedCompany.id)
        .eq('journal_entry.is_posted', true)
        .order('journal_entry(entry_date)', { ascending: true });

      if (error) {
        console.error('Error fetching ledger:', error);
        continue;
      }

      let runningBalance = opening;
      const ledgerEntries: LedgerEntry[] = (entries || [])
        .filter((entry: any) => entry.journal_entry)
        .map((entry: any) => {
          const debit = entry.debit_amount || 0;
          const credit = entry.credit_amount || 0;
          runningBalance += isDebitNormal ? (debit - credit) : (credit - debit);
          
          return {
            entry_date: entry.journal_entry?.entry_date,
            entry_number: entry.journal_entry?.entry_number,
            description: entry.description || entry.journal_entry?.description || '',
            debit_amount: debit,
            credit_amount: credit,
            running_balance: runningBalance,
          };
        });

      const totalDebits = ledgerEntries.reduce((sum, e) => sum + e.debit_amount, 0);
      const totalCredits = ledgerEntries.reduce((sum, e) => sum + e.credit_amount, 0);
      const closingBalance = ledgerEntries.length > 0 
        ? ledgerEntries[ledgerEntries.length - 1].running_balance 
        : opening;

      ledgers.push({
        account,
        openingBalance: opening,
        entries: ledgerEntries,
        totalDebits,
        totalCredits,
        closingBalance,
      });
    }

    setAccountLedgers(ledgers);
    setIsLoading(false);
    
    if (ledgers.length > 0) {
      toast.success(`Loaded ledger for ${ledgers.length} account(s)`);
    }
  };

  const accountOptions = accounts.map(acc => ({
    value: acc.id,
    label: `${acc.code} - ${acc.name}`,
  }));

  const exportMeta = {
    companyName: selectedCompany?.name || '',
    reportTitle: 'General Ledger',
    dateLabel: `Periode: ${startDate} s/d ${endDate}`,
  };

  const handleExportCSV = () => {
    const data: any[] = [];
    accountLedgers.forEach(ledger => {
      data.push({ Account: `${ledger.account.code} - ${ledger.account.name}`, Date: '', 'Entry #': '', Description: 'Opening Balance', Debit: '', Credit: '', Balance: ledger.openingBalance });
      ledger.entries.forEach(e => {
        data.push({
          Account: '',
          Date: e.entry_date,
          'Entry #': e.entry_number,
          Description: e.description,
          Debit: e.debit_amount,
          Credit: e.credit_amount,
          Balance: e.running_balance,
        });
      });
      data.push({ Account: '', Date: '', 'Entry #': '', Description: 'Closing Balance', Debit: ledger.totalDebits, Credit: ledger.totalCredits, Balance: ledger.closingBalance });
    });
    exportToCSV(data, `general-ledger-${startDate}-to-${endDate}`, exportMeta);
    toast.success('Exported to CSV');
  };

  const handleExportExcel = () => {
    const data: any[] = [];
    accountLedgers.forEach(ledger => {
      data.push({ Account: `${ledger.account.code} - ${ledger.account.name}`, Date: '', 'Entry #': '', Description: 'Opening Balance', Debit: '', Credit: '', Balance: ledger.openingBalance });
      ledger.entries.forEach(e => {
        data.push({
          Account: '',
          Date: e.entry_date,
          'Entry #': e.entry_number,
          Description: e.description,
          Debit: e.debit_amount,
          Credit: e.credit_amount,
          Balance: e.running_balance,
        });
      });
      data.push({ Account: '', Date: '', 'Entry #': '', Description: 'Closing Balance', Debit: ledger.totalDebits, Credit: ledger.totalCredits, Balance: ledger.closingBalance });
    });
    exportToExcel(data, `general-ledger-${startDate}-to-${endDate}`, 'General Ledger', exportMeta);
    toast.success('Exported to Excel');
  };

  const handleExportPDF = () => {
    let html = '';
    
    accountLedgers.forEach(ledger => {
      const rows = ledger.entries.map(e => [
        formatDate(e.entry_date),
        e.entry_number,
        e.description,
        e.debit_amount > 0 ? formatCurrency(e.debit_amount) : '-',
        e.credit_amount > 0 ? formatCurrency(e.credit_amount) : '-',
        formatCurrency(e.running_balance),
      ]);
      
      html += `
        <h3>Account: ${ledger.account.code} - ${ledger.account.name}</h3>
        <p>Opening Balance: ${formatCurrency(ledger.openingBalance)}</p>
        ${generatePDFTable(['Date', 'Entry #', 'Description', 'Debit', 'Credit', 'Balance'], rows, { 
          totalRow: ['', '', 'Totals', formatCurrency(ledger.totalDebits), formatCurrency(ledger.totalCredits), ''] 
        })}
        <p><strong>Closing Balance: ${formatCurrency(ledger.closingBalance)}</strong></p>
        <hr/>
      `;
    });
    
    exportToPDF('General Ledger', html, exportMeta);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">General Ledger</h1>
          <p className="text-muted-foreground mt-1">Detailed account transactions</p>
        </div>
        {accountLedgers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border">
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
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Account(s)</label>
              <SearchableMultiSelect
                options={accountOptions}
                value={selectedAccounts}
                onChange={setSelectedAccounts}
                placeholder="Select account(s)..."
                searchPlaceholder="Search accounts..."
                selectAllLabel="Select All Accounts"
              />
            </div>
            <div>
              <label className="form-label">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={fetchLedger} className="gradient-primary text-primary-foreground">
              View Ledger
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading ledger...</div>
      ) : accountLedgers.length > 0 ? (
        <div className="space-y-6">
          {accountLedgers.map((ledger) => (
            <Card key={ledger.account.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3">
                  <span className="font-mono text-primary">{ledger.account.code}</span>
                  <span>{ledger.account.name}</span>
                  <span className="text-sm font-normal text-muted-foreground capitalize">
                    ({ledger.account.account_type.replace('_', ' ')})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Entry #</th>
                        <th>Description</th>
                        <th className="text-right">Debit</th>
                        <th className="text-right">Credit</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-muted/50 font-medium">
                        <td colSpan={5}>Opening Balance</td>
                        <td className="text-right">{formatCurrency(ledger.openingBalance)}</td>
                      </tr>
                      {ledger.entries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center text-muted-foreground py-8">
                            No transactions found for this period
                          </td>
                        </tr>
                      ) : (
                        ledger.entries.map((entry, index) => (
                          <tr key={index}>
                            <td>{formatDate(entry.entry_date)}</td>
                            <td className="font-mono text-sm">{entry.entry_number}</td>
                            <td className="max-w-xs truncate">{entry.description}</td>
                            <td className="text-right">
                              {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : '-'}
                            </td>
                            <td className="text-right">
                              {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : '-'}
                            </td>
                            <td className="text-right font-medium">{formatCurrency(entry.running_balance)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-muted/50 font-semibold">
                        <td colSpan={3}>Totals</td>
                        <td className="text-right">{formatCurrency(ledger.totalDebits)}</td>
                        <td className="text-right">{formatCurrency(ledger.totalCredits)}</td>
                        <td></td>
                      </tr>
                      <tr className="bg-primary/10 font-bold">
                        <td colSpan={5}>Closing Balance</td>
                        <td className="text-right text-primary">{formatCurrency(ledger.closingBalance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Account(s)</h3>
              <p className="text-muted-foreground">Choose one or more accounts to view their ledger transactions</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GeneralLedger;
