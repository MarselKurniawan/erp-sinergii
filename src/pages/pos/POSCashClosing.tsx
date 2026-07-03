import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Lock, Unlock, Eye, Calculator, Printer, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface CashSession {
  id: string;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  status: string;
}

interface PaymentSummary {
  method_name: string;
  total: number;
}

interface TaxServiceBreakdown {
  name: string;
  category: 'tax' | 'service';
  total: number;
}

interface SessionStats {
  totalSales: number;
  totalTransactions: number;
  paymentSummary: PaymentSummary[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceAmount: number;
  roundingAmount: number;
  totalGuests: number;
  avgPerGuest: number;
  totalInvoices: number;
  avgPerInvoice: number;
  complimentTotal: number;
  complimentCount: number;
  taxServiceBreakdown: TaxServiceBreakdown[];
}

const POSCashClosing = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
  
  const [closingBalance, setClosingBalance] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [openTablesCount, setOpenTablesCount] = useState(0);

  const fetchSessions = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('pos_cash_sessions')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('opened_at', { ascending: false });
    
    if (!error) {
      setSessions(data || []);
      const open = data?.find(s => s.status === 'open');
      setCurrentSession(open || null);
    }
    setIsLoading(false);
  };

  const checkOpenTables = async () => {
    if (!selectedCompany) return;
    
    const { count } = await supabase
      .from('pos_open_tables')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany.id)
      .eq('status', 'open');
    
    setOpenTablesCount(count || 0);
  };

  useEffect(() => {
    fetchSessions();
    checkOpenTables();
  }, [selectedCompany]);

  const fetchSessionStats = async (sessionId: string) => {
    // Get transactions for this session with full details
    const { data: transactions } = await supabase
      .from('pos_transactions')
      .select('id, total_amount, subtotal, discount_amount, tax_amount, service_amount, rounding_amount, guest_count, status')
      .eq('cash_session_id', sessionId)
      .eq('status', 'completed');
    
    const completedTransactions = transactions || [];
    const totalSales = completedTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const totalTransactions = completedTransactions.length;
    const subtotal = completedTransactions.reduce((sum, t) => sum + (t.subtotal || 0), 0);
    const discountAmount = completedTransactions.reduce((sum, t) => sum + (t.discount_amount || 0), 0);
    const taxAmount = completedTransactions.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
    const serviceAmount = completedTransactions.reduce((sum, t) => sum + ((t as any).service_amount || 0), 0);
    const roundingAmount = completedTransactions.reduce((sum, t) => sum + ((t as any).rounding_amount || 0), 0);

    // Fetch tax rates configuration for breakdown labels
    const { data: taxRates } = await supabase
      .from('pos_tax_rates')
      .select('name, display_name, category, rate')
      .eq('company_id', selectedCompany?.id || '')
      .eq('is_active', true)
      .order('apply_order');

    // Build dynamic tax/service breakdown
    const taxServiceBreakdown: TaxServiceBreakdown[] = [];
    
    // Group by category and use actual names from settings
    const taxes = taxRates?.filter(r => r.category === 'tax') || [];
    const services = taxRates?.filter(r => r.category === 'service') || [];
    
    // For taxes, sum them up with names
    if (taxes.length > 0 && taxAmount > 0) {
      // If there's only one tax, show it with its name
      if (taxes.length === 1) {
        taxServiceBreakdown.push({
          name: taxes[0].display_name || taxes[0].name,
          category: 'tax',
          total: taxAmount
        });
      } else {
        // Multiple taxes - show combined with generic label or first one
        taxServiceBreakdown.push({
          name: taxes.map(t => t.display_name || t.name).join(' + '),
          category: 'tax',
          total: taxAmount
        });
      }
    } else if (taxAmount > 0) {
      taxServiceBreakdown.push({ name: 'Pajak', category: 'tax', total: taxAmount });
    }

    // For services, sum them up with names
    if (services.length > 0 && serviceAmount > 0) {
      if (services.length === 1) {
        taxServiceBreakdown.push({
          name: services[0].display_name || services[0].name,
          category: 'service',
          total: serviceAmount
        });
      } else {
        taxServiceBreakdown.push({
          name: services.map(s => s.display_name || s.name).join(' + '),
          category: 'service',
          total: serviceAmount
        });
      }
    } else if (serviceAmount > 0) {
      taxServiceBreakdown.push({ name: 'Service', category: 'service', total: serviceAmount });
    }

    // Get payment breakdown
    const { data: payments } = await supabase
      .from('pos_transaction_payments')
      .select(`
        amount,
        pos_payment_methods(name)
      `)
      .in('pos_transaction_id', completedTransactions.map(t => t.id));

    const paymentMap = new Map<string, number>();
    payments?.forEach(p => {
      const name = (p.pos_payment_methods as any)?.name || 'Unknown';
      paymentMap.set(name, (paymentMap.get(name) || 0) + p.amount);
    });

    const paymentSummary: PaymentSummary[] = Array.from(paymentMap.entries()).map(([name, total]) => ({
      method_name: name,
      total
    }));

    // Guest stats
    const totalGuests = completedTransactions.reduce((sum, t) => sum + ((t as any).guest_count || 1), 0);
    const avgPerGuest = totalGuests > 0 ? totalSales / totalGuests : 0;

    // Invoice stats
    const totalInvoices = totalTransactions;
    const avgPerInvoice = totalInvoices > 0 ? totalSales / totalInvoices : 0;

    // Compliment (void/cancelled transactions)
    const { data: voidTransactions } = await supabase
      .from('pos_transactions')
      .select('total_amount')
      .eq('cash_session_id', sessionId)
      .eq('status', 'void');
    
    const complimentTotal = voidTransactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;
    const complimentCount = voidTransactions?.length || 0;

    setSessionStats({ 
      totalSales, 
      totalTransactions, 
      paymentSummary,
      subtotal,
      discountAmount,
      taxAmount,
      serviceAmount,
      roundingAmount,
      totalGuests,
      avgPerGuest,
      totalInvoices,
      avgPerInvoice,
      complimentTotal,
      complimentCount,
      taxServiceBreakdown
    });
  };

  const openCloseDialog = async () => {
    if (!currentSession) return;
    
    // Check for open tables first
    await checkOpenTables();
    
    if (openTablesCount > 0) {
      toast.error(`Masih ada ${openTablesCount} meja yang masih buka. Tutup semua meja terlebih dahulu.`);
      return;
    }
    
    await fetchSessionStats(currentSession.id);
    setShowCloseDialog(true);
  };

  useEffect(() => {
    if (showCloseDialog && currentSession && sessionStats) {
      // Calculate expected cash balance
      const cashPayments = sessionStats.paymentSummary.find(p => 
        p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
      )?.total || 0;
      
      const expected = currentSession.opening_balance + cashPayments;
      setClosingBalance(expected.toString());
    }
  }, [showCloseDialog, sessionStats, currentSession]);

  const closeSession = async (shouldPrint: boolean = false) => {
    if (!currentSession || !sessionStats) return;
    
    const closing = parseFloat(closingBalance) || 0;
    const cashPayments = sessionStats.paymentSummary.find(p => 
      p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
    )?.total || 0;
    const expected = currentSession.opening_balance + cashPayments;
    const diff = closing - expected;

    const { error } = await supabase
      .from('pos_cash_sessions')
      .update({
        closing_balance: closing,
        expected_balance: expected,
        difference: diff,
        closed_at: new Date().toISOString(),
        closed_by: user?.id,
        notes: closingNotes || null,
        status: 'closed'
      })
      .eq('id', currentSession.id);

    if (error) {
      toast.error('Gagal menutup sesi kasir');
      return;
    }

    if (shouldPrint) {
      printClosingReport({
        openedAt: currentSession.opened_at,
        closedAt: new Date().toISOString(),
        openingBalance: currentSession.opening_balance,
        closingBalance: closing,
        expectedBalance: expected,
        difference: diff,
        ...sessionStats
      });
    }

    toast.success('Sesi kasir berhasil ditutup');
    setShowCloseDialog(false);
    setClosingBalance('');
    setClosingNotes('');
    fetchSessions();
  };

  const printClosingReport = (data: SessionStats & {
    openedAt: string;
    closedAt: string;
    openingBalance: number;
    closingBalance: number;
    expectedBalance: number;
    difference: number;
  }) => {
    const formatNumber = (num: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Penutupan Kas</title>
        <style>
          body { font-family: monospace; font-size: 11px; width: 80mm; margin: 0 auto; padding: 8px; line-height: 1.3; }
          .header { margin-bottom: 8px; }
          .header p { margin: 2px 0; }
          .section-title { font-weight: bold; margin: 8px 0 4px 0; text-decoration: underline; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .row-label { flex: 1; }
          .row-value { text-align: right; min-width: 100px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .total { font-weight: bold; }
          @media print { 
            body { width: 80mm; margin: 0; padding: 5px; } 
            @page { margin: 0; size: 80mm auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <p>Date: ${format(new Date(data.closedAt), 'MM/dd/yyyy')}</p>
          <p>Company: ${selectedCompany?.name || 'Company'}</p>
          <p>Report Time: ${format(new Date(data.closedAt), 'MM/dd/yyyy HH:mm:ss')}</p>
        </div>
        
        <div class="section-title">Revenue</div>
        <div class="row"><span class="row-label">Subtotal</span></div>
        <div class="row"><span></span><span class="row-value">${formatNumber(data.subtotal)}</span></div>
        <div class="row"><span class="row-label">Discount</span></div>
        <div class="row"><span></span><span class="row-value">${formatNumber(data.discountAmount)}</span></div>
        ${data.taxServiceBreakdown.map(item => `
          <div class="row"><span class="row-label">${item.name.toUpperCase()}</span></div>
          <div class="row"><span></span><span class="row-value">${formatNumber(item.total)}</span></div>
        `).join('')}
        <div class="row"><span class="row-label">ROUNDING</span></div>
        <div class="row"><span></span><span class="row-value">${formatNumber(data.roundingAmount)}</span></div>
        <div class="divider"></div>
        <div class="row total"><span class="row-label">Total</span></div>
        <div class="row total"><span></span><span class="row-value">${formatNumber(data.totalSales)}</span></div>
        
        <div style="margin-top: 10px;">
          <div class="row"><span class="row-label">Total Guest</span><span class="row-value">${data.totalGuests}</span></div>
          <div class="row"><span class="row-label">Avg. per Guest</span></div>
          <div class="row"><span></span><span class="row-value">${formatNumber(data.avgPerGuest)}</span></div>
        </div>
        
        <div style="margin-top: 6px;">
          <div class="row"><span class="row-label">No. of Inv.</span><span class="row-value">${data.totalInvoices}</span></div>
          <div class="row"><span class="row-label">Avg. per Inv.</span></div>
          <div class="row"><span></span><span class="row-value">${formatNumber(data.avgPerInvoice)}</span></div>
        </div>
        
        <div class="section-title">Payments</div>
        ${data.paymentSummary.map(p => `
          <div class="row"><span class="row-label">${p.method_name.toUpperCase()}</span></div>
          <div class="row"><span></span><span class="row-value">${formatNumber(p.total)}</span></div>
        `).join('')}
        <div class="divider"></div>
        <div class="row total"><span class="row-label">Total</span></div>
        <div class="row total"><span></span><span class="row-value">${formatNumber(data.paymentSummary.reduce((sum, p) => sum + p.total, 0))}</span></div>
        
        <div class="section-title">Compliment</div>
        <div class="row"><span class="row-label">Total Compliment</span><span class="row-value">${formatNumber(data.complimentTotal)}</span></div>
        <div class="row"><span class="row-label">No. of Inv</span><span class="row-value">${data.complimentCount}</span></div>
        <div class="row"><span class="row-label">Avg per Inv</span><span class="row-value">${formatNumber(data.complimentCount > 0 ? data.complimentTotal / data.complimentCount : 0)}</span></div>
        
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const printSessionReport = (session: CashSession) => {
    if (!sessionStats) return;
    
    printClosingReport({
      openedAt: session.opened_at,
      closedAt: session.closed_at || new Date().toISOString(),
      openingBalance: session.opening_balance,
      closingBalance: session.closing_balance || 0,
      expectedBalance: session.expected_balance || 0,
      difference: session.difference || 0,
      ...sessionStats
    });
  };

  const viewDetails = async (session: CashSession) => {
    setSelectedSession(session);
    await fetchSessionStats(session.id);
    setShowDetailsDialog(true);
  };

  const totalPayments = sessionStats?.paymentSummary.reduce((sum, p) => sum + p.total, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Penutupan Kas</h1>
        <p className="text-muted-foreground">Rekonsiliasi dan penutupan sesi kasir harian</p>
      </div>

      {/* Open Tables Warning */}
      {openTablesCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Terdapat <strong>{openTablesCount} meja</strong> yang masih aktif. Tutup semua meja terlebih dahulu sebelum menutup kasir.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Session Card */}
      {currentSession && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Unlock className="h-5 w-5 text-primary" />
                  Sesi Aktif
                </CardTitle>
                <CardDescription>
                  Dibuka: {format(new Date(currentSession.opened_at), 'dd MMMM yyyy HH:mm', { locale: id })}
                </CardDescription>
              </div>
              <Button onClick={openCloseDialog} disabled={openTablesCount > 0}>
                <Lock className="h-4 w-4 mr-2" />
                Tutup Sesi
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Awal</p>
                <p className="text-xl font-bold">{formatCurrency(currentSession.opening_balance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Sesi</CardTitle>
          <CardDescription>Daftar semua sesi kasir yang sudah ditutup</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Memuat...</p>
          ) : sessions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Belum ada riwayat sesi</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Saldo Awal</TableHead>
                  <TableHead className="text-right">Saldo Akhir</TableHead>
                  <TableHead className="text-right">Total Penjualan</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(session => (
                  <TableRow key={session.id}>
                    <TableCell>
                      {format(new Date(session.opened_at), 'dd MMM yyyy', { locale: id })}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(session.opening_balance)}</TableCell>
                    <TableCell className="text-right">
                      {session.closing_balance !== null ? formatCurrency(session.closing_balance) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.expected_balance !== null 
                        ? formatCurrency((session.expected_balance || 0) - session.opening_balance) 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.difference !== null ? (
                        <span className={session.difference === 0 ? 'text-primary' : session.difference > 0 ? 'text-primary' : 'text-destructive'}>
                          {session.difference > 0 ? '+' : ''}{formatCurrency(session.difference)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                        {session.status === 'open' ? 'Aktif' : 'Ditutup'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => viewDetails(session)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Close Session Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tutup Sesi Kasir</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {sessionStats && (
              <>
                {/* Revenue Section */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Revenue</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium">{formatCurrency(sessionStats.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span className="font-medium text-destructive">-{formatCurrency(sessionStats.discountAmount)}</span>
                    </div>
                    {sessionStats.taxServiceBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span>Rounding</span>
                      <span className="font-medium">{formatCurrency(sessionStats.roundingAmount)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(sessionStats.totalSales)}</span>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Total Guest</p>
                      <p className="text-xl font-bold">{sessionStats.totalGuests}</p>
                      <p className="text-xs text-muted-foreground">Avg: {formatCurrency(sessionStats.avgPerGuest)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">No. of Invoice</p>
                      <p className="text-xl font-bold">{sessionStats.totalInvoices}</p>
                      <p className="text-xs text-muted-foreground">Avg: {formatCurrency(sessionStats.avgPerInvoice)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Payments Section */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Payments</h3>
                  <div className="space-y-2 text-sm">
                    {sessionStats.paymentSummary.map((p, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{p.method_name.toUpperCase()}</span>
                        <span className="font-medium">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(totalPayments)}</span>
                    </div>
                  </div>
                </div>

                {/* Compliment Section */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Compliment (Void)</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Compliment</span>
                      <span className="font-medium">{formatCurrency(sessionStats.complimentTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>No. of Inv</span>
                      <span className="font-medium">{sessionStats.complimentCount}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Calculation */}
                <div className="border-t pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Saldo Awal</span>
                    <span>{formatCurrency(currentSession?.opening_balance || 0)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">+ Penerimaan Tunai</span>
                    <span>
                      {formatCurrency(
                        sessionStats.paymentSummary.find(p => 
                          p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
                        )?.total || 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>= Kas Seharusnya</span>
                    <span>
                      {formatCurrency(
                        (currentSession?.opening_balance || 0) + 
                        (sessionStats.paymentSummary.find(p => 
                          p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
                        )?.total || 0)
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Saldo Akhir Aktual (Hitung Fisik)</Label>
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  placeholder="Masukkan hasil hitung fisik"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan (Opsional)</Label>
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Catatan penutupan kas..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Batal</Button>
            <Button variant="secondary" onClick={() => closeSession(true)}>
              <Printer className="h-4 w-4 mr-2" />
              Tutup & Cetak
            </Button>
            <Button onClick={() => closeSession(false)}>
              <Lock className="h-4 w-4 mr-2" />
              Tutup Sesi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Sesi</DialogTitle>
          </DialogHeader>
          {selectedSession && sessionStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Dibuka</p>
                  <p className="font-medium">{format(new Date(selectedSession.opened_at), 'dd MMM yyyy HH:mm', { locale: id })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ditutup</p>
                  <p className="font-medium">
                    {selectedSession.closed_at 
                      ? format(new Date(selectedSession.closed_at), 'dd MMM yyyy HH:mm', { locale: id })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Revenue Section */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Revenue</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(sessionStats.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span className="font-medium">-{formatCurrency(sessionStats.discountAmount)}</span>
                  </div>
                  {sessionStats.taxServiceBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span>Rounding</span>
                    <span className="font-medium">{formatCurrency(sessionStats.roundingAmount)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(sessionStats.totalSales)}</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Guest</p>
                    <p className="text-xl font-bold">{sessionStats.totalGuests}</p>
                    <p className="text-xs text-muted-foreground">Avg: {formatCurrency(sessionStats.avgPerGuest)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">No. of Invoice</p>
                    <p className="text-xl font-bold">{sessionStats.totalInvoices}</p>
                    <p className="text-xs text-muted-foreground">Avg: {formatCurrency(sessionStats.avgPerInvoice)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Payments */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Payments</h3>
                <div className="space-y-2 text-sm">
                  {sessionStats.paymentSummary.map((p, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{p.method_name.toUpperCase()}</span>
                      <span className="font-medium">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(sessionStats.paymentSummary.reduce((sum, p) => sum + p.total, 0))}</span>
                  </div>
                </div>
              </div>

              {/* Rekonsiliasi Kas */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Rekonsiliasi Kas</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Saldo Awal Kas</span>
                    <span>{formatCurrency(selectedSession.opening_balance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Penerimaan Tunai</span>
                    <span>{formatCurrency((selectedSession.expected_balance || 0) - selectedSession.opening_balance)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>Kas Seharusnya</span>
                    <span>{formatCurrency(selectedSession.expected_balance || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kas Aktual (Hitung Fisik)</span>
                    <span>{formatCurrency(selectedSession.closing_balance || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Selisih</span>
                  <span className={
                    selectedSession.difference === 0 ? 'text-primary' : 
                    (selectedSession.difference || 0) > 0 ? 'text-primary' : 'text-destructive'
                  }>
                    {(selectedSession.difference || 0) > 0 ? '+' : ''}
                    {formatCurrency(selectedSession.difference || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedSession.notes && (
                <div>
                  <Label className="text-sm text-muted-foreground">Catatan</Label>
                  <p className="text-sm">{selectedSession.notes}</p>
                </div>
              )}

              {selectedSession.status === 'closed' && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => printSessionReport(selectedSession)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Laporan
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSCashClosing;
