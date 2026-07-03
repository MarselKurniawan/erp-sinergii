import React, { useState, useEffect } from 'react';
import { Search, FileText, Eye, ChevronLeft, ChevronRight, CalendarIcon, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ManualJournalEntryForm } from '@/components/journal/ManualJournalEntryForm';
import { AccountValidationAlert } from '@/components/accounting/AccountValidationAlert';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  reference_type: string | null;
  is_posted: boolean;
}

interface JournalLine {
  id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string | null;
  account_name?: string;
  account_code?: string;
}

const PAGE_SIZE = 10;

export const JournalEntries: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [viewingLines, setViewingLines] = useState<JournalLine[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchEntries = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    
    // Build query with date filters
    let countQuery = supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany.id);
    
    let dataQuery = supabase
      .from('journal_entries')
      .select('*')
      .eq('company_id', selectedCompany.id);

    // Apply date filters
    if (startDate) {
      countQuery = countQuery.gte('entry_date', startDate);
      dataQuery = dataQuery.gte('entry_date', startDate);
    }
    if (endDate) {
      countQuery = countQuery.lte('entry_date', endDate);
      dataQuery = dataQuery.lte('entry_date', endDate);
    }
    
    // Get total count
    const { count } = await countQuery;
    setTotalCount(count || 0);
    
    // Get paginated data - newest first
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data, error } = await dataQuery
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (!error) setEntries(data || []);
    setIsLoading(false);
  };

  useEffect(() => { 
    setCurrentPage(1);
  }, [selectedCompany, startDate, endDate]);

  useEffect(() => { 
    fetchEntries(); 
  }, [selectedCompany, currentPage, startDate, endDate]);

  const handleView = async (entry: JournalEntry) => {
    setViewingEntry(entry);
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        id,
        account_id,
        debit_amount,
        credit_amount,
        description,
        account:chart_of_accounts!journal_entry_lines_account_id_fkey(code, name)
      `)
      .eq('journal_entry_id', entry.id);

    if (error) {
      console.error('Error fetching journal lines:', error);
      setViewingLines([]);
    } else {
      setViewingLines(
        (data || []).map((line: any) => ({
          ...line,
          account_code: line.account?.code,
          account_name: line.account?.name,
        }))
      );
    }
    setIsViewDialogOpen(true);
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredEntries = entries.filter(e => 
    e.entry_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalDebit = viewingLines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
  const totalCredit = viewingLines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <AccountValidationAlert requiredAccountTypes={['cash_bank', 'receivable', 'payable', 'revenue', 'expense']} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Journal Entries</h1>
          <p className="text-muted-foreground mt-1">View and manage accounting transactions</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Manual Entry
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="Search entries..." 
                  className="pl-10 input-field" 
                />
              </div>
            </div>
            <div className="w-full sm:w-40">
              <label className="form-label">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="form-label">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
            {(startDate || endDate) && (
              <Button variant="outline" onClick={clearDateFilters}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No journal entries</h3>
            <p className="text-muted-foreground">Journal entries are created automatically from transactions</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entry #</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map(entry => (
                      <tr key={entry.id}>
                        <td className="font-mono font-medium">{entry.entry_number}</td>
                        <td>{formatDate(entry.entry_date)}</td>
                        <td className="max-w-[300px] truncate">{entry.description || '-'}</td>
                        <td>
                          <span className="badge-status bg-muted text-muted-foreground capitalize">
                            {entry.reference_type || 'manual'}
                          </span>
                        </td>
                        <td>
                          <span className={cn(
                            'badge-status',
                            entry.is_posted ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                          )}>
                            {entry.is_posted ? 'Posted' : 'Draft'}
                          </span>
                        </td>
                        <td className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleView(entry)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
          </DialogHeader>
          {viewingEntry && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Entry Number</p>
                  <p className="font-mono font-semibold">{viewingEntry.entry_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p>{formatDate(viewingEntry.entry_date)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{viewingEntry.description || '-'}</p>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingLines.map((line, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{line.account_code} - {line.account_name}</td>
                        <td className="px-3 py-2 text-right">
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className={cn(
                      "border-t font-semibold",
                      isBalanced ? "bg-muted/50" : "bg-destructive/10"
                    )}>
                      <td className="px-3 py-2">
                        Total
                        {!isBalanced && (
                          <span className="ml-2 text-xs text-destructive font-normal">
                            (Unbalanced: {formatCurrency(Math.abs(totalDebit - totalCredit))})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totalDebit)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totalCredit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Manual Entry Form */}
      <ManualJournalEntryForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchEntries}
      />
    </div>
  );
};

export default JournalEntries;
