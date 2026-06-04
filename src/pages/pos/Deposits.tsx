import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, Search, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { generateDocumentNumber } from '@/lib/documentNumber';

interface Deposit {
  id: string;
  deposit_number: string;
  folio_number: string | null;
  company_name: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_id: string | null;
  event_name: string;
  event_date: string;
  deposit_amount: number;
  total_estimated: number;
  remaining_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  account_id: string | null;
}

interface Customer {
  id: string;
  name: string;
  code: string;
  phone: string | null;
}

const Deposits = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { accounts } = useAccounts();
  
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  
  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [totalEstimated, setTotalEstimated] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDeposits = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pos_deposits')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });
    
    if (!error) {
      setDeposits((data || []) as Deposit[]);
    }
    setIsLoading(false);
  };

  const fetchPaymentMethods = async () => {
    if (!selectedCompany) return;
    
    const { data } = await supabase
      .from('pos_payment_methods')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true);
    
    setPaymentMethods(data || []);
  };

  const fetchCustomers = async () => {
    if (!selectedCompany) return;
    
    const { data } = await supabase
      .from('customers')
      .select('id, name, code, phone')
      .eq('company_id', selectedCompany.id)
      .order('name');
    
    setCustomers(data || []);
  };

  useEffect(() => {
    fetchDeposits();
    fetchPaymentMethods();
    fetchCustomers();
  }, [selectedCompany]);

  const generateDepositNumber = async () => {
    const today = format(new Date(), 'yyyyMMdd');
    const { count } = await supabase
      .from('pos_deposits')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany?.id);
    return `DP-${today}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const generateFolioNumber = async () => {
    const today = format(new Date(), 'yyyyMMdd');
    const { count } = await supabase
      .from('pos_deposits')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany?.id);
    return `FOLIO-${today}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone || '');
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setCompanyName('');
    setCustomerName('');
    setCustomerPhone('');
    setEventName('');
    setEventDate('');
    setDepositAmount('');
    setTotalEstimated('');
    setPaymentMethodId('');
    setNotes('');
  };

  const handleCreateDeposit = async () => {
    if (!selectedCompany) return;
    
    // Validation
    if (!customerName.trim() || !eventName.trim() || !eventDate || !depositAmount) {
      toast.error('Mohon lengkapi data yang wajib diisi');
      return;
    }

    const dpAmount = parseFloat(depositAmount);
    const totalEst = parseFloat(totalEstimated) || 0;
    
    if (dpAmount <= 0) {
      toast.error('Jumlah deposit harus lebih dari 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const depositNumber = await generateDepositNumber();
      const folioNumber = await generateFolioNumber();
      const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);
      
      // Create deposit record
      const { data: deposit, error: depositError } = await supabase
        .from('pos_deposits')
        .insert({
          company_id: selectedCompany.id,
          deposit_number: depositNumber,
          folio_number: folioNumber,
          company_name: companyName.trim() || null,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          customer_id: selectedCustomerId || null,
          event_name: eventName.trim(),
          event_date: eventDate,
          deposit_amount: dpAmount,
          total_estimated: totalEst,
          remaining_amount: totalEst - dpAmount,
          payment_method_id: paymentMethodId || null,
          notes: notes.trim() || null,
          status: 'pending',
          created_by: user?.id
        })
        .select()
        .single();

      if (depositError) throw depositError;

      // Create journal entry for deposit
      if (selectedMethod?.account_id) {
        const journalNumber = await generateDocumentNumber(selectedCompany!.id, 'JE');
        
        const { data: journalEntry, error: jeError } = await supabase
          .from('journal_entries')
          .insert({
            company_id: selectedCompany.id,
            entry_number: journalNumber,
            description: `Deposit ${depositNumber} - ${eventName} (${customerName})`,
            reference_type: 'pos_deposit',
            reference_id: deposit.id,
            is_posted: true,
            created_by: user?.id
          })
          .select()
          .single();

        if (!jeError && journalEntry) {
          // Find deposit liability account (Uang Muka Pelanggan)
          const depositLiabilityAccount = accounts.find(a => 
            a.account_type === 'liability' && 
            (a.name.toLowerCase().includes('uang muka') || a.name.toLowerCase().includes('deposit'))
          );

          const journalLines = [
            {
              journal_entry_id: journalEntry.id,
              account_id: selectedMethod.account_id,
              debit_amount: dpAmount,
              credit_amount: 0,
              description: `Penerimaan deposit via ${selectedMethod.name}`
            }
          ];

          if (depositLiabilityAccount) {
            journalLines.push({
              journal_entry_id: journalEntry.id,
              account_id: depositLiabilityAccount.id,
              debit_amount: 0,
              credit_amount: dpAmount,
              description: `Uang muka pelanggan - ${eventName}`
            });
          }

          await supabase.from('journal_entry_lines').insert(journalLines);

          // Update deposit with journal entry id
          await supabase
            .from('pos_deposits')
            .update({ journal_entry_id: journalEntry.id })
            .eq('id', deposit.id);
        }
      }

      toast.success(`Deposit ${depositNumber} berhasil dibuat`);
      setShowCreateDialog(false);
      resetForm();
      fetchDeposits();
    } catch (error: any) {
      toast.error('Gagal membuat deposit: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateDepositStatus = async (depositId: string, newStatus: string) => {
    await supabase
      .from('pos_deposits')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', depositId);
    
    toast.success('Status berhasil diupdate');
    fetchDeposits();
    setShowDetailDialog(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Menunggu</Badge>;
      case 'completed':
        return <Badge variant="default">Selesai</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Dibatalkan</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredDeposits = deposits.filter(d =>
    d.deposit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.event_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPending = deposits.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.deposit_amount, 0);
  const totalCompleted = deposits.filter(d => d.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deposit / Uang Muka</h1>
          <p className="text-muted-foreground">Kelola deposit untuk acara dan reservasi</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Deposit Baru
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposit Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Deposit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{deposits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selesai Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{totalCompleted}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari deposit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Deposits Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Deposit</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Acara</TableHead>
              <TableHead>Tanggal Acara</TableHead>
              <TableHead className="text-right">Jumlah DP</TableHead>
              <TableHead className="text-right">Estimasi Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Memuat...
                </TableCell>
              </TableRow>
            ) : filteredDeposits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'Tidak ada deposit ditemukan' : 'Belum ada data deposit'}
                </TableCell>
              </TableRow>
            ) : (
              filteredDeposits.map(deposit => (
                <TableRow key={deposit.id}>
                  <TableCell className="font-medium">{deposit.deposit_number}</TableCell>
                  <TableCell>
                    <div>
                      <p>{deposit.customer_name}</p>
                      {deposit.customer_phone && (
                        <p className="text-xs text-muted-foreground">{deposit.customer_phone}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{deposit.event_name}</TableCell>
                  <TableCell>{format(new Date(deposit.event_date), 'dd MMM yyyy', { locale: id })}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(deposit.deposit_amount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(deposit.total_estimated)}</TableCell>
                  <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedDeposit(deposit);
                        setShowDetailDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Deposit Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Nama Perusahaan</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nama perusahaan / instansi (opsional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Pilih dari Database Pelanggan</Label>
              <SearchableSelect
                options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                value={selectedCustomerId}
                onChange={handleCustomerSelect}
                placeholder="Cari pelanggan..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nama Pelanggan *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama lengkap"
                />
              </div>
              <div className="space-y-2">
                <Label>No. Telepon</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxx"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nama Acara *</Label>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Contoh: Wedding Reception, Birthday Party"
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Acara *</Label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah Deposit *</Label>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Estimasi Total</Label>
                <Input
                  type="number"
                  value={totalEstimated}
                  onChange={(e) => setTotalEstimated(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(method => (
                    <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
            <Button onClick={handleCreateDeposit} disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Deposit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Deposit</DialogTitle>
          </DialogHeader>
          {selectedDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">No. Deposit</p>
                  <p className="font-medium">{selectedDeposit.deposit_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedDeposit.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Perusahaan</p>
                  <p className="font-medium">{selectedDeposit.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pelanggan</p>
                  <p className="font-medium">{selectedDeposit.customer_name}</p>
                  {selectedDeposit.customer_phone && (
                    <p className="text-sm text-muted-foreground">{selectedDeposit.customer_phone}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Acara</p>
                  <p className="font-medium">{selectedDeposit.event_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Acara</p>
                  <p className="font-medium">{format(new Date(selectedDeposit.event_date), 'dd MMMM yyyy', { locale: id })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dibuat</p>
                  <p className="font-medium">{format(new Date(selectedDeposit.created_at), 'dd MMM yyyy HH:mm', { locale: id })}</p>
                </div>
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah Deposit</span>
                  <span className="font-bold text-primary">{formatCurrency(selectedDeposit.deposit_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimasi Total</span>
                  <span>{formatCurrency(selectedDeposit.total_estimated)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sisa Pembayaran</span>
                  <span className="font-medium">{formatCurrency(selectedDeposit.remaining_amount)}</span>
                </div>
              </div>

              {selectedDeposit.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">Catatan</p>
                  <p>{selectedDeposit.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Tutup</Button>
            {selectedDeposit?.status === 'pending' && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => updateDepositStatus(selectedDeposit.id, 'cancelled')}
                >
                  Batalkan
                </Button>
                <Button onClick={() => updateDepositStatus(selectedDeposit.id, 'completed')}>
                  Tandai Selesai
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deposits;
