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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Percent, Receipt, Calculator } from 'lucide-react';
import { toast } from 'sonner';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  account_id: string | null;
  is_default: boolean;
  is_active: boolean;
  display_name: string | null;
  show_on_receipt: boolean;
  calculation_method: string;
  apply_order: number;
  category: 'tax' | 'service';
}

const TaxSettings = () => {
  const { selectedCompany } = useCompany();
  const { accounts } = useAccounts();

  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rate: 11,
    account_id: '',
    is_default: false,
    is_active: true,
    display_name: '',
    show_on_receipt: true,
    calculation_method: 'add_to_subtotal',
    apply_order: 1,
    category: 'tax' as 'tax' | 'service'
  });

  const fetchTaxRates = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('pos_tax_rates')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('name');
    
    if (!error && data) {
      setTaxRates(data.map(d => ({ ...d, category: (d.category || 'tax') as 'tax' | 'service' })));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTaxRates();
  }, [selectedCompany]);

  const createDefaultTaxRates = async () => {
    if (!selectedCompany) return;
    
    const defaults = [
      { name: 'PPN 11%', rate: 11, is_default: true, display_name: 'PPN 11%', apply_order: 1, category: 'tax' },
      { name: 'PPN 12%', rate: 12, is_default: false, display_name: 'PPN 12%', apply_order: 1, category: 'tax' },
      { name: 'Service Charge', rate: 5, is_default: false, display_name: 'Service 5%', apply_order: 2, category: 'service' },
    ];

    const { error } = await supabase
      .from('pos_tax_rates')
      .insert(defaults.map(d => ({
        ...d,
        company_id: selectedCompany.id,
        is_active: true,
        show_on_receipt: true,
        calculation_method: 'add_to_subtotal'
      })));

    if (error) {
      toast.error('Gagal membuat tarif default');
      return;
    }

    toast.success('Tarif Tax & Services default berhasil dibuat');
    fetchTaxRates();
  };

  const handleOpenDialog = (tax?: TaxRate) => {
    if (tax) {
      setEditingTax(tax);
      setFormData({
        name: tax.name,
        rate: tax.rate,
        account_id: tax.account_id || '',
        is_default: tax.is_default,
        is_active: tax.is_active,
        display_name: tax.display_name || '',
        show_on_receipt: tax.show_on_receipt,
        calculation_method: tax.calculation_method || 'add_to_subtotal',
        apply_order: tax.apply_order || 1,
        category: tax.category || 'tax'
      });
    } else {
      setEditingTax(null);
      setFormData({
        name: '',
        rate: 11,
        account_id: '',
        is_default: false,
        is_active: true,
        display_name: '',
        show_on_receipt: true,
        calculation_method: 'add_to_subtotal',
        apply_order: 1,
        category: 'tax'
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!selectedCompany || !formData.name) {
      toast.error('Nama harus diisi');
      return;
    }

    // If setting as default, unset other defaults first
    if (formData.is_default) {
      await supabase
        .from('pos_tax_rates')
        .update({ is_default: false })
        .eq('company_id', selectedCompany.id);
    }

    const saveData = {
      name: formData.name,
      rate: formData.rate,
      account_id: formData.account_id || null,
      is_default: formData.is_default,
      is_active: formData.is_active,
      display_name: formData.display_name || null,
      show_on_receipt: formData.show_on_receipt,
      calculation_method: formData.calculation_method,
      apply_order: formData.apply_order,
      category: formData.category
    };

    if (editingTax) {
      const { error } = await supabase
        .from('pos_tax_rates')
        .update(saveData)
        .eq('id', editingTax.id);

      if (error) {
        toast.error('Gagal mengupdate');
        return;
      }
      toast.success('Berhasil diupdate');
    } else {
      const { error } = await supabase
        .from('pos_tax_rates')
        .insert({
          ...saveData,
          company_id: selectedCompany.id
        });

      if (error) {
        toast.error('Gagal menambah');
        return;
      }
      toast.success('Berhasil ditambah');
    }

    setShowDialog(false);
    fetchTaxRates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus tarif pajak ini?')) return;

    const { error } = await supabase
      .from('pos_tax_rates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Gagal menghapus tarif pajak');
      return;
    }

    toast.success('Tarif pajak berhasil dihapus');
    fetchTaxRates();
  };

  const handleToggleActive = async (tax: TaxRate) => {
    const { error } = await supabase
      .from('pos_tax_rates')
      .update({ is_active: !tax.is_active })
      .eq('id', tax.id);

    if (!error) {
      fetchTaxRates();
    }
  };

  const handleSetDefault = async (tax: TaxRate) => {
    if (!selectedCompany) return;
    
    // Unset all defaults first
    await supabase
      .from('pos_tax_rates')
      .update({ is_default: false })
      .eq('company_id', selectedCompany.id);
    
    // Set new default
    const { error } = await supabase
      .from('pos_tax_rates')
      .update({ is_default: true })
      .eq('id', tax.id);

    if (!error) {
      toast.success(`${tax.name} dijadikan default`);
      fetchTaxRates();
    }
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return '-';
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : '-';
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'add_to_subtotal': return 'Tambah ke Subtotal';
      case 'add_to_total': return 'Tambah ke Total';
      case 'included_in_price': return 'Termasuk Harga';
      default: return method;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tax & Services</h1>
        <p className="text-muted-foreground">Konfigurasi pajak dan biaya layanan untuk transaksi POS</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Tarif Tax & Services
              </CardTitle>
              <CardDescription>
                Atur berbagai tarif pajak (PPN, PPh) dan biaya layanan (Service Charge). 
                Setiap tarif bisa dikustomisasi tampilan di struk dan metode perhitungannya.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {taxRates.length === 0 && (
                <Button variant="outline" onClick={createDefaultTaxRates}>
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
          ) : taxRates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Belum ada tarif pajak</p>
              <Button onClick={createDefaultTaxRates}>
                Buat Tarif Pajak Default
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-center">Kategori</TableHead>
                  <TableHead className="text-center">Tarif (%)</TableHead>
                  <TableHead>Di Struk</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-center">Default</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.map(tax => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                          {tax.name}
                        </div>
                        {tax.display_name && tax.display_name !== tax.name && (
                          <span className="text-xs text-muted-foreground ml-6">
                            Tampil: {tax.display_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={tax.category === 'tax' ? 'default' : 'secondary'}>
                        {tax.category === 'tax' ? 'Pajak' : 'Service'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{tax.rate}%</TableCell>
                    <TableCell>
                      {tax.show_on_receipt ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Receipt className="h-3 w-3 mr-1" />
                          Ya
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Tidak</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{getMethodLabel(tax.calculation_method)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {tax.is_default ? (
                        <Badge>Default</Badge>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSetDefault(tax)}
                          className="text-xs"
                        >
                          Set Default
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={tax.is_active}
                        onCheckedChange={() => handleToggleActive(tax)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(tax)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tax.id)}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTax ? 'Edit' : 'Tambah'} Tax/Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v: 'tax' | 'service') => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax">Pajak (Tax)</SelectItem>
                  <SelectItem value="service">Service Charge</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pilih kategori untuk pengelompokan di laporan penutupan kas
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nama *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: PPN 11%, Service Charge"
                />
              </div>
              <div className="space-y-2">
                <Label>Tarif (%) *</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                  placeholder="11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nama Tampilan di Struk</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Kosongkan jika sama dengan nama"
              />
              <p className="text-xs text-muted-foreground">
                Jika diisi, nama ini akan ditampilkan di struk
              </p>
            </div>

            <div className="space-y-2">
              <Label>Metode Perhitungan</Label>
              <Select 
                value={formData.calculation_method} 
                onValueChange={(v) => setFormData({ ...formData, calculation_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add_to_subtotal">
                    Tambah ke Subtotal (Harga × Tarif)
                  </SelectItem>
                  <SelectItem value="add_to_total">
                    Tambah ke Total (Setelah Tax lain)
                  </SelectItem>
                  <SelectItem value="included_in_price">
                    Termasuk dalam Harga
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground space-y-3 bg-muted/50 rounded-lg p-3 mt-2">
                {formData.category === 'service' && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-2 mb-1">
                    <p className="font-medium text-blue-700 dark:text-blue-400">ℹ️ Aturan Service Charge</p>
                    <p className="text-blue-600 dark:text-blue-300 mt-1">
                      Service charge biasanya dihitung dari <strong>subtotal (harga makanan/minuman)</strong>, 
                      bukan dari total setelah pajak. Gunakan <strong>"Tambah ke Subtotal"</strong>.
                    </p>
                  </div>
                )}
                {formData.category === 'tax' && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2 mb-1">
                    <p className="font-medium text-amber-700 dark:text-amber-400">ℹ️ Aturan Pajak (PPN)</p>
                    <p className="text-amber-600 dark:text-amber-300 mt-1">
                      PPN dihitung dari <strong>Dasar Pengenaan Pajak (DPP)</strong> = Subtotal + Service Charge. 
                      Jika ada service charge, gunakan <strong>"Tambah ke Total"</strong> agar PPN dihitung setelah service.
                    </p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">• Tambah ke Subtotal</p>
                  <p>Dihitung langsung dari subtotal (harga item saja).</p>
                  <p className="italic">Contoh: Subtotal Rp 100.000 × 5% Service = Rp 5.000 → Total Rp 105.000</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">• Tambah ke Total</p>
                  <p>Dihitung setelah tarif lain diterapkan (bertumpuk/cascading).</p>
                  <p className="italic">Contoh: Subtotal Rp 100.000 + Service Rp 5.000 = Rp 105.000, lalu PPN 11% = Rp 11.550 → Total Rp 116.550</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">• Termasuk dalam Harga</p>
                  <p>Sudah termasuk di harga jual, tidak menambah total. Hanya ditampilkan sebagai info.</p>
                  <p className="italic">Contoh: Harga Rp 111.000 sudah termasuk PPN 11% → Harga asli Rp 100.000, PPN Rp 11.000</p>
                </div>

                <div className="border-t pt-2 mt-2">
                  <p className="font-semibold text-foreground">📋 Contoh Kasus Restoran:</p>
                  <div className="mt-1 space-y-0.5">
                    <p>Subtotal makanan: <strong>Rp 100.000</strong></p>
                    <p>+ Service 5% (dari subtotal): <strong>Rp 5.000</strong></p>
                    <p>+ PPN 11% (dari 100.000 + 5.000): <strong>Rp 11.550</strong></p>
                    <p className="font-semibold text-foreground">= Total: Rp 116.550</p>
                  </div>
                  <p className="mt-1 italic">→ Service pakai "Tambah ke Subtotal", PPN pakai "Tambah ke Total"</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Urutan Penerapan</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.apply_order}
                  onChange={(e) => setFormData({ ...formData, apply_order: parseInt(e.target.value) || 1 })}
                />
                <p className="text-xs text-muted-foreground">
                  Urutan penerapan jika ada beberapa tax
                </p>
              </div>
              <div className="space-y-2">
                <Label>Akun Pencatatan</Label>
                <Select 
                  value={formData.account_id || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, account_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih akun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.show_on_receipt}
                  onCheckedChange={(v) => setFormData({ ...formData, show_on_receipt: v })}
                />
                <Label>Tampilkan di Struk</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(v) => setFormData({ ...formData, is_default: v })}
                />
                <Label>Jadikan Default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Aktif</Label>
              </div>
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

export default TaxSettings;
