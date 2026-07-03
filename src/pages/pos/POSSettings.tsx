import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, CreditCard, Banknote, Smartphone, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  account_id: string | null;
  is_active: boolean;
}

const defaultMethods = [
  { name: 'Tunai', code: 'CASH', icon: Banknote },
  { name: 'QRIS', code: 'QRIS', icon: QrCode },
  { name: 'Transfer Bank', code: 'TRANSFER', icon: CreditCard },
  { name: 'E-Wallet', code: 'EWALLET', icon: Smartphone },
];

const POSSettings = () => {
  const { selectedCompany } = useCompany();
  const { getCashBankAccounts } = useAccounts();
  const cashAccounts = getCashBankAccounts();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    account_id: '',
    is_active: true
  });

  const fetchPaymentMethods = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('pos_payment_methods')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('name');
    
    if (!error) {
      setPaymentMethods(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, [selectedCompany]);

  const createDefaultMethods = async () => {
    if (!selectedCompany) return;
    
    // Check if there's at least one cash account
    if (cashAccounts.length === 0) {
      toast.error('Buat akun Kas/Bank terlebih dahulu di Chart of Accounts');
      return;
    }

    const defaultAccountId = cashAccounts[0].id;
    
    const methods = defaultMethods.map(m => ({
      company_id: selectedCompany.id,
      name: m.name,
      code: m.code,
      account_id: defaultAccountId,
      is_active: true
    }));

    const { error } = await supabase
      .from('pos_payment_methods')
      .insert(methods);

    if (error) {
      toast.error('Gagal membuat metode pembayaran default');
      return;
    }

    toast.success('Metode pembayaran default berhasil dibuat');
    fetchPaymentMethods();
  };

  const handleOpenDialog = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        name: method.name,
        code: method.code,
        account_id: method.account_id || '',
        is_active: method.is_active
      });
    } else {
      setEditingMethod(null);
      setFormData({
        name: '',
        code: '',
        account_id: cashAccounts[0]?.id || '',
        is_active: true
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!selectedCompany || !formData.name || !formData.code) {
      toast.error('Lengkapi semua field yang diperlukan');
      return;
    }

    if (editingMethod) {
      const { error } = await supabase
        .from('pos_payment_methods')
        .update({
          name: formData.name,
          code: formData.code,
          account_id: formData.account_id || null,
          is_active: formData.is_active
        })
        .eq('id', editingMethod.id);

      if (error) {
        toast.error('Gagal mengupdate metode pembayaran');
        return;
      }
      toast.success('Metode pembayaran berhasil diupdate');
    } else {
      const { error } = await supabase
        .from('pos_payment_methods')
        .insert({
          company_id: selectedCompany.id,
          name: formData.name,
          code: formData.code,
          account_id: formData.account_id || null,
          is_active: formData.is_active
        });

      if (error) {
        toast.error('Gagal menambah metode pembayaran');
        return;
      }
      toast.success('Metode pembayaran berhasil ditambah');
    }

    setShowDialog(false);
    fetchPaymentMethods();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus metode pembayaran ini?')) return;

    const { error } = await supabase
      .from('pos_payment_methods')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Gagal menghapus metode pembayaran');
      return;
    }

    toast.success('Metode pembayaran berhasil dihapus');
    fetchPaymentMethods();
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    const { error } = await supabase
      .from('pos_payment_methods')
      .update({ is_active: !method.is_active })
      .eq('id', method.id);

    if (!error) {
      fetchPaymentMethods();
    }
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return '-';
    const account = cashAccounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pengaturan POS</h1>
        <p className="text-muted-foreground">Konfigurasi metode pembayaran dan akun terkait</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Metode Pembayaran</CardTitle>
              <CardDescription>Atur metode pembayaran yang tersedia di POS dan akun kas/bank masing-masing</CardDescription>
            </div>
            <div className="flex gap-2">
              {paymentMethods.length === 0 && (
                <Button variant="outline" onClick={createDefaultMethods}>
                  Buat Default
                </Button>
              )}
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Memuat...</p>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Belum ada metode pembayaran</p>
              <Button onClick={createDefaultMethods}>
                Buat Metode Pembayaran Default
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Akun Kas/Bank</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods.map(method => (
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell>{method.code}</TableCell>
                    <TableCell>{getAccountName(method.account_id)}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={method.is_active}
                        onCheckedChange={() => handleToggleActive(method)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(method)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(method.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMethod ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Tunai, QRIS, Transfer BCA"
              />
            </div>
            <div className="space-y-2">
              <Label>Kode</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Contoh: CASH, QRIS, TF_BCA"
              />
            </div>
            <div className="space-y-2">
              <Label>Akun Kas/Bank</Label>
              <Select value={formData.account_id} onValueChange={(v) => setFormData({ ...formData, account_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pembayaran dengan metode ini akan otomatis dicatat ke akun yang dipilih
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSSettings;
