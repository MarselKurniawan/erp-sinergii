import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Lock, Unlock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';

interface PeriodClosing {
  id: string;
  period_start: string;
  period_end: string;
  closed_at: string;
  closed_by: string;
  notes: string | null;
  status: string;
}

interface AccountBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
  net_balance: number;
}

const PeriodClosing: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const [closings, setClosings] = useState<PeriodClosing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  
  // Form state
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const fetchClosings = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('period_closings')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('period_end', { ascending: false });

    if (!error) {
      setClosings(data || []);
    }
    setIsLoading(false);
  };

  const fetchBalancesForPreview = async () => {
    if (!selectedCompany) return;
    
    const { data: accounts, error: accountsError } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('code');

    if (accountsError) {
      toast.error('Gagal mengambil data akun');
      return;
    }

    const { data: journalLines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select(`
        account_id,
        debit_amount,
        credit_amount,
        journal_entries!inner (
          company_id,
          entry_date
        )
      `)
      .eq('journal_entries.company_id', selectedCompany.id)
      .lte('journal_entries.entry_date', periodEnd);

    if (linesError) {
      toast.error('Gagal mengambil data jurnal');
      return;
    }

    const balanceMap: Record<string, { debit: number; credit: number }> = {};
    
    journalLines?.forEach((line: any) => {
      const accountId = line.account_id;
      if (!balanceMap[accountId]) {
        balanceMap[accountId] = { debit: 0, credit: 0 };
      }
      balanceMap[accountId].debit += Number(line.debit_amount) || 0;
      balanceMap[accountId].credit += Number(line.credit_amount) || 0;
    });

    const calculatedBalances: AccountBalance[] = accounts?.map(account => {
      const balance = balanceMap[account.id] || { debit: 0, credit: 0 };
      const netBalance = balance.debit - balance.credit;
      
      return {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_type: account.account_type,
        debit_balance: balance.debit,
        credit_balance: balance.credit,
        net_balance: netBalance,
      };
    }).filter(b => b.debit_balance !== 0 || b.credit_balance !== 0) || [];

    setBalances(calculatedBalances);
    setShowPreviewDialog(true);
  };

  const handleClosePeriod = async () => {
    if (!selectedCompany || !user) return;
    
    setIsClosing(true);
    
    try {
      // Create period closing record
      const { data: closing, error: closingError } = await supabase
        .from('period_closings')
        .insert({
          company_id: selectedCompany.id,
          period_start: periodStart,
          period_end: periodEnd,
          closed_by: user.id,
          notes: notes || null,
          status: 'closed',
        })
        .select()
        .single();

      if (closingError) throw closingError;

      // Calculate and store opening balances for each account
      const openingBalanceDate = new Date(periodEnd);
      openingBalanceDate.setDate(openingBalanceDate.getDate() + 1);
      const balanceDateStr = format(openingBalanceDate, 'yyyy-MM-dd');

      const openingBalances = balances.map(b => ({
        company_id: selectedCompany.id,
        account_id: b.account_id,
        period_closing_id: closing.id,
        balance_date: balanceDateStr,
        debit_balance: b.net_balance > 0 ? b.net_balance : 0,
        credit_balance: b.net_balance < 0 ? Math.abs(b.net_balance) : 0,
      }));

      const { error: balanceError } = await supabase
        .from('opening_balances')
        .upsert(openingBalances, { 
          onConflict: 'company_id,account_id,balance_date',
          ignoreDuplicates: false 
        });

      if (balanceError) throw balanceError;

      toast.success('Periode berhasil ditutup dan saldo dipivot');
      setShowConfirmDialog(false);
      setShowPreviewDialog(false);
      setNotes('');
      fetchClosings();
    } catch (error: any) {
      toast.error('Gagal menutup periode: ' + error.message);
    } finally {
      setIsClosing(false);
    }
  };

  useEffect(() => {
    fetchClosings();
  }, [selectedCompany]);

  if (!selectedCompany) {
    return <div className="p-6 text-muted-foreground">Pilih perusahaan terlebih dahulu</div>;
  }

  const totalDebit = balances.reduce((sum, b) => sum + (b.net_balance > 0 ? b.net_balance : 0), 0);
  const totalCredit = balances.reduce((sum, b) => sum + (b.net_balance < 0 ? Math.abs(b.net_balance) : 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Tutup Buku</h1>
          <p className="text-muted-foreground">Pivot saldo akhir periode ke saldo awal periode berikutnya</p>
        </div>
      </div>

      {/* Form Tutup Buku */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Tutup Periode
          </CardTitle>
          <CardDescription>
            Pilih rentang periode yang akan ditutup. Saldo akhir akan menjadi saldo awal periode berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tanggal Mulai Periode</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Tanggal Akhir Periode</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Catatan (opsional)</Label>
            <Textarea
              placeholder="Catatan tutup buku..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button onClick={fetchBalancesForPreview} className="w-full md:w-auto">
            Preview Saldo & Tutup Periode
          </Button>
        </CardContent>
      </Card>

      {/* Riwayat Tutup Buku */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Tutup Buku</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : closings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada riwayat tutup buku
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Ditutup Pada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closings.map((closing) => (
                  <TableRow key={closing.id}>
                    <TableCell>
                      {format(new Date(closing.period_start), 'dd MMM yyyy', { locale: idLocale })} - {' '}
                      {format(new Date(closing.period_end), 'dd MMM yyyy', { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(closing.closed_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        closing.status === 'closed' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {closing.status === 'closed' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {closing.status === 'closed' ? 'Tertutup' : 'Dibuka Kembali'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{closing.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Saldo Akhir Periode</DialogTitle>
            <DialogDescription>
              Periode: {format(new Date(periodStart), 'dd MMM yyyy', { locale: idLocale })} - {format(new Date(periodEnd), 'dd MMM yyyy', { locale: idLocale })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {!isBalanced && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="w-5 h-5" />
                <span>Peringatan: Total Debit dan Kredit tidak seimbang!</span>
              </div>
            )}
            
            {isBalanced && (
              <div className="flex items-center gap-2 p-3 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span>Saldo seimbang, siap untuk ditutup</span>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Akun</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((balance) => (
                  <TableRow key={balance.account_id}>
                    <TableCell className="font-mono">{balance.account_code}</TableCell>
                    <TableCell>{balance.account_name}</TableCell>
                    <TableCell className="capitalize">{balance.account_type.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right">
                      {balance.net_balance > 0 ? formatCurrency(balance.net_balance) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {balance.net_balance < 0 ? formatCurrency(Math.abs(balance.net_balance)) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="font-semibold">Total</div>
              <div className="flex gap-8">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Debit</div>
                  <div className="font-semibold">{formatCurrency(totalDebit)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Kredit</div>
                  <div className="font-semibold">{formatCurrency(totalCredit)}</div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Batal
            </Button>
            <Button 
              onClick={() => setShowConfirmDialog(true)} 
              disabled={!isBalanced}
            >
              Konfirmasi Tutup Periode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Tutup Buku</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menutup periode ini? Saldo akhir akan dipivot menjadi saldo awal periode berikutnya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={isClosing}>
              Batal
            </Button>
            <Button onClick={handleClosePeriod} disabled={isClosing}>
              {isClosing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menutup...
                </>
              ) : (
                'Ya, Tutup Periode'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeriodClosing;
