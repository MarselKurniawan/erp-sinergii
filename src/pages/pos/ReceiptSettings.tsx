import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Receipt, ChefHat, Upload, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptSetting {
  id: string;
  receipt_type: string;
  name: string;
  logo_url: string | null;
  header_text: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_company_name: boolean;
  show_company_address: boolean;
  show_company_phone: boolean;
  show_customer_info: boolean;
  show_item_details: boolean;
  show_payment_info: boolean;
  paper_size: string;
  is_active: boolean;
}

interface SplitRule {
  id: string;
  receipt_setting_id: string;
  category_id: string | null;
  category_name: string | null;
}

interface Category {
  id: string;
  name: string;
}

const defaultReceiptSettings: Omit<ReceiptSetting, 'id'> = {
  receipt_type: 'customer',
  name: 'Struk Pelanggan',
  logo_url: null,
  header_text: null,
  footer_text: 'Terima kasih atas kunjungan Anda\nBarang yang sudah dibeli tidak dapat dikembalikan',
  show_logo: true,
  show_company_name: true,
  show_company_address: true,
  show_company_phone: true,
  show_customer_info: true,
  show_item_details: true,
  show_payment_info: true,
  paper_size: '80mm',
  is_active: true
};

const ReceiptSettings = () => {
  const { selectedCompany } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSetting[]>([]);
  const [splitRules, setSplitRules] = useState<SplitRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [editingSetting, setEditingSetting] = useState<ReceiptSetting | null>(null);
  const [selectedSettingForSplit, setSelectedSettingForSplit] = useState<ReceiptSetting | null>(null);
  
  const [formData, setFormData] = useState<Omit<ReceiptSetting, 'id'>>(defaultReceiptSettings);
  const [tempLogoPreview, setTempLogoPreview] = useState<string | null>(null);

  const fetchData = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    const [settingsRes, rulesRes, categoriesRes] = await Promise.all([
      supabase
        .from('receipt_settings')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('receipt_type', { ascending: true }),
      supabase
        .from('receipt_split_rules')
        .select('*')
        .eq('company_id', selectedCompany.id),
      supabase
        .from('product_categories')
        .select('id, name')
        .eq('company_id', selectedCompany.id)
        .order('name')
    ]);

    setReceiptSettings(settingsRes.data || []);
    setSplitRules(rulesRes.data || []);
    setCategories(categoriesRes.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany]);

  const createDefaultSettings = async () => {
    if (!selectedCompany) return;

    const defaults = [
      {
        ...defaultReceiptSettings,
        company_id: selectedCompany.id,
        receipt_type: 'customer',
        name: 'Struk Pelanggan',
        footer_text: 'Terima kasih atas kunjungan Anda\nBarang yang sudah dibeli tidak dapat dikembalikan'
      },
      {
        ...defaultReceiptSettings,
        company_id: selectedCompany.id,
        receipt_type: 'kitchen',
        name: 'Order Dapur',
        show_payment_info: false,
        footer_text: null
      }
    ];

    const { error } = await supabase.from('receipt_settings').insert(defaults);

    if (error) {
      toast.error('Gagal membuat pengaturan default');
      return;
    }

    toast.success('Pengaturan struk default berhasil dibuat');
    fetchData();
  };

  const handleOpenDialog = (setting?: ReceiptSetting) => {
    if (setting) {
      setEditingSetting(setting);
      setFormData({
        receipt_type: setting.receipt_type,
        name: setting.name,
        logo_url: setting.logo_url,
        header_text: setting.header_text,
        footer_text: setting.footer_text,
        show_logo: setting.show_logo,
        show_company_name: setting.show_company_name,
        show_company_address: setting.show_company_address,
        show_company_phone: setting.show_company_phone,
        show_customer_info: setting.show_customer_info,
        show_item_details: setting.show_item_details,
        show_payment_info: setting.show_payment_info,
        paper_size: setting.paper_size,
        is_active: setting.is_active
      });
      setTempLogoPreview(setting.logo_url);
    } else {
      setEditingSetting(null);
      setFormData(defaultReceiptSettings);
      setTempLogoPreview(null);
    }
    setShowDialog(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error('Ukuran logo maksimal 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setFormData({ ...formData, logo_url: base64 });
      setTempLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setFormData({ ...formData, logo_url: null });
    setTempLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!selectedCompany || !formData.name) {
      toast.error('Nama struk harus diisi');
      return;
    }

    if (editingSetting) {
      const { error } = await supabase
        .from('receipt_settings')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSetting.id);

      if (error) {
        toast.error('Gagal mengupdate pengaturan');
        return;
      }
      toast.success('Pengaturan struk berhasil diupdate');
    } else {
      const { error } = await supabase
        .from('receipt_settings')
        .insert({
          ...formData,
          company_id: selectedCompany.id
        });

      if (error) {
        toast.error('Gagal menambah pengaturan');
        return;
      }
      toast.success('Pengaturan struk berhasil ditambah');
    }

    setShowDialog(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pengaturan struk ini?')) return;

    const { error } = await supabase
      .from('receipt_settings')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Gagal menghapus pengaturan');
      return;
    }

    toast.success('Pengaturan struk berhasil dihapus');
    fetchData();
  };

  const handleToggleActive = async (setting: ReceiptSetting) => {
    const { error } = await supabase
      .from('receipt_settings')
      .update({ is_active: !setting.is_active })
      .eq('id', setting.id);

    if (!error) {
      fetchData();
    }
  };

  const openSplitDialog = (setting: ReceiptSetting) => {
    setSelectedSettingForSplit(setting);
    setShowSplitDialog(true);
  };

  const addSplitRule = async (categoryId: string) => {
    if (!selectedCompany || !selectedSettingForSplit) return;

    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    // Check if already exists
    const exists = splitRules.some(
      r => r.receipt_setting_id === selectedSettingForSplit.id && r.category_id === categoryId
    );
    if (exists) {
      toast.error('Kategori sudah ditambahkan');
      return;
    }

    const { error } = await supabase.from('receipt_split_rules').insert({
      company_id: selectedCompany.id,
      receipt_setting_id: selectedSettingForSplit.id,
      category_id: categoryId,
      category_name: category.name
    });

    if (error) {
      toast.error('Gagal menambah aturan split');
      return;
    }

    toast.success('Kategori berhasil ditambahkan');
    fetchData();
  };

  const removeSplitRule = async (ruleId: string) => {
    const { error } = await supabase
      .from('receipt_split_rules')
      .delete()
      .eq('id', ruleId);

    if (!error) {
      fetchData();
    }
  };

  const getSettingRules = (settingId: string) => {
    return splitRules.filter(r => r.receipt_setting_id === settingId);
  };

  const getTypeIcon = (type: string) => {
    return type === 'kitchen' ? <ChefHat className="h-4 w-4" /> : <Receipt className="h-4 w-4" />;
  };

  const getTypeBadge = (type: string) => {
    return type === 'kitchen' 
      ? <Badge variant="secondary" className="flex items-center gap-1"><ChefHat className="h-3 w-3" /> Dapur</Badge>
      : <Badge variant="outline" className="flex items-center gap-1"><Receipt className="h-3 w-3" /> Pelanggan</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pengaturan Struk</h1>
        <p className="text-muted-foreground">Kustomisasi format struk untuk pelanggan dan dapur</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Template Struk</CardTitle>
              <CardDescription>
                Atur header, footer, logo, dan opsi tampilan untuk setiap jenis struk
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {receiptSettings.length === 0 && (
                <Button variant="outline" onClick={createDefaultSettings}>
                  Buat Default
                </Button>
              )}
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Memuat...</p>
          ) : receiptSettings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Belum ada pengaturan struk</p>
              <Button onClick={createDefaultSettings}>
                Buat Pengaturan Default
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Ukuran Kertas</TableHead>
                  <TableHead>Split Kategori</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptSettings.map(setting => (
                  <TableRow key={setting.id}>
                    <TableCell className="font-medium">{setting.name}</TableCell>
                    <TableCell>{getTypeBadge(setting.receipt_type)}</TableCell>
                    <TableCell>{setting.paper_size}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getSettingRules(setting.id).length > 0 ? (
                          getSettingRules(setting.id).map(rule => (
                            <Badge key={rule.id} variant="secondary" className="text-xs">
                              {rule.category_name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">Semua kategori</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={setting.is_active}
                        onCheckedChange={() => handleToggleActive(setting)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setEditingSetting(setting);
                            setShowPreviewDialog(true);
                          }}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openSplitDialog(setting)} title="Atur Kategori Split">
                          <ChefHat className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(setting)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(setting.id)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSetting ? 'Edit' : 'Tambah'} Template Struk</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Umum</TabsTrigger>
              <TabsTrigger value="display">Tampilan</TabsTrigger>
              <TabsTrigger value="content">Konten</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nama Template</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Struk Pelanggan, Order Dapur"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipe Struk</Label>
                <Select value={formData.receipt_type} onValueChange={(v) => setFormData({ ...formData, receipt_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">
                      <span className="flex items-center gap-2">
                        <Receipt className="h-4 w-4" /> Struk Pelanggan (Nota)
                      </span>
                    </SelectItem>
                    <SelectItem value="kitchen">
                      <span className="flex items-center gap-2">
                        <ChefHat className="h-4 w-4" /> Order Dapur (Kitchen)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ukuran Kertas</Label>
                <Select value={formData.paper_size} onValueChange={(v) => setFormData({ ...formData, paper_size: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm (Thermal Kecil)</SelectItem>
                    <SelectItem value="80mm">80mm (Thermal Standar)</SelectItem>
                    <SelectItem value="A4">A4 (PDF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Aktif</Label>
              </div>
            </TabsContent>

            <TabsContent value="display" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {tempLogoPreview ? (
                    <div className="relative">
                      <img src={tempLogoPreview} alt="Logo" className="h-16 w-auto border rounded" />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Maksimal 500KB. Format: JPG, PNG</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.show_logo}
                    onCheckedChange={(v) => setFormData({ ...formData, show_logo: v })}
                  />
                  <Label>Tampilkan Logo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.show_customer_info}
                    onCheckedChange={(v) => setFormData({ ...formData, show_customer_info: v })}
                  />
                  <Label>Info Pelanggan</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.show_item_details}
                    onCheckedChange={(v) => setFormData({ ...formData, show_item_details: v })}
                  />
                  <Label>Detail Item</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.show_payment_info}
                    onCheckedChange={(v) => setFormData({ ...formData, show_payment_info: v })}
                  />
                  <Label>Info Pembayaran</Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Nama toko dan alamat tidak ditampilkan. Gunakan Header untuk informasi toko.
              </p>
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Header (Nama Toko, Alamat, dll)</Label>
                <Textarea
                  value={formData.header_text || ''}
                  onChange={(e) => setFormData({ ...formData, header_text: e.target.value })}
                  placeholder="Contoh:\nNama Toko Anda\nJl. Contoh No. 123\nTelp: 08123456789"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Footer</Label>
                <Textarea
                  value={formData.footer_text || ''}
                  onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                  placeholder="Terima kasih atas kunjungan Anda"
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Category Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Split Kategori - {selectedSettingForSplit?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pilih kategori produk yang akan dicetak pada struk ini. 
              Jika tidak ada kategori dipilih, semua produk akan dicetak.
            </p>
            
            <div className="space-y-2">
              <Label>Tambah Kategori</Label>
              <Select onValueChange={addSplitRule}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kategori Terpilih</Label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                {selectedSettingForSplit && getSettingRules(selectedSettingForSplit.id).length > 0 ? (
                  getSettingRules(selectedSettingForSplit.id).map(rule => (
                    <Badge key={rule.id} variant="secondary" className="flex items-center gap-1">
                      {rule.category_name}
                      <button onClick={() => removeSplitRule(rule.id)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">Semua kategori (tidak ada filter)</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSplitDialog(false)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview Struk</DialogTitle>
          </DialogHeader>
          {editingSetting && (
            <div 
              className="border rounded p-4 bg-white text-black font-mono text-xs"
              style={{ width: editingSetting.paper_size === '80mm' ? '300px' : editingSetting.paper_size === '58mm' ? '220px' : '100%' }}
            >
              <div className="text-center space-y-1">
                {editingSetting.show_logo && editingSetting.logo_url && (
                  <img src={editingSetting.logo_url} alt="Logo" className="h-12 mx-auto" />
                )}
                {editingSetting.show_company_name && (
                  <div className="font-bold text-sm">{selectedCompany?.name}</div>
                )}
                {editingSetting.show_company_address && (
                  <div>{selectedCompany?.address || 'Jl. Contoh No. 123'}</div>
                )}
                {editingSetting.show_company_phone && (
                  <div>{selectedCompany?.phone || '021-1234567'}</div>
                )}
                {editingSetting.header_text && (
                  <div className="whitespace-pre-line mt-1">{editingSetting.header_text}</div>
                )}
              </div>
              <hr className="my-2 border-dashed border-gray-400" />
              <div className="text-xs">
                <div>No: POS-20260109-0001</div>
                <div>Tgl: 09/01/2026 14:30</div>
                {editingSetting.show_customer_info && <div>Pelanggan: Walk-in Customer</div>}
              </div>
              <hr className="my-2 border-dashed border-gray-400" />
              {editingSetting.show_item_details && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Produk Contoh A</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>2 x Rp 50.000</span>
                    <span>Rp 100.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Produk Contoh B</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>1 x Rp 75.000</span>
                    <span>Rp 75.000</span>
                  </div>
                </div>
              )}
              <hr className="my-2 border-dashed border-gray-400" />
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rp 175.000</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span>Rp 175.000</span>
                </div>
              </div>
              {editingSetting.show_payment_info && (
                <>
                  <hr className="my-2 border-dashed border-gray-400" />
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Tunai</span>
                      <span>Rp 200.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kembali</span>
                      <span>Rp 25.000</span>
                    </div>
                  </div>
                </>
              )}
              {editingSetting.footer_text && (
                <>
                  <hr className="my-2 border-dashed border-gray-400" />
                  <div className="text-center whitespace-pre-line">{editingSetting.footer_text}</div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPreviewDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceiptSettings;
