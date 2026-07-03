import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit2, Trash2, Tag, Clock, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { format, differenceInDays, differenceInHours, differenceInMinutes, isPast, isFuture } from 'date-fns';
import { id } from 'date-fns/locale';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  promo_code: string | null;
  discount_type: 'percentage' | 'fixed' | 'buy_x_get_y';
  discount_value: number;
  max_discount: number | null;
  min_purchase: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  applies_to: 'all' | 'category' | 'product';
  usage_limit: number | null;
  used_count: number;
  created_at: string;
}

const Promotions = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [isActive, setIsActive] = useState(true);
  const [usageLimit, setUsageLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPromotions = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pos_promotions')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setPromotions(data as Promotion[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPromotions();
  }, [selectedCompany]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPromoCode('');
    setDiscountType('percentage');
    setDiscountValue('');
    setMaxDiscount('');
    setMinPurchase('');
    setStartDate('');
    setStartTime('00:00');
    setEndDate('');
    setEndTime('23:59');
    setIsActive(true);
    setUsageLimit('');
    setEditingPromo(null);
  };

  const openEditDialog = (promo: Promotion) => {
    setEditingPromo(promo);
    setName(promo.name);
    setDescription(promo.description || '');
    setPromoCode(promo.promo_code || '');
    setDiscountType(promo.discount_type === 'buy_x_get_y' ? 'percentage' : promo.discount_type);
    setDiscountValue(promo.discount_value.toString());
    setMaxDiscount(promo.max_discount?.toString() || '');
    setMinPurchase(promo.min_purchase.toString());
    setStartDate(format(new Date(promo.start_date), 'yyyy-MM-dd'));
    setStartTime(format(new Date(promo.start_date), 'HH:mm'));
    setEndDate(format(new Date(promo.end_date), 'yyyy-MM-dd'));
    setEndTime(format(new Date(promo.end_date), 'HH:mm'));
    setIsActive(promo.is_active);
    setUsageLimit(promo.usage_limit?.toString() || '');
    setShowCreateDialog(true);
  };

  const handleSavePromotion = async () => {
    if (!selectedCompany) return;
    
    if (!name.trim() || !discountValue || !startDate || !endDate) {
      toast.error('Mohon lengkapi data yang wajib diisi');
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      toast.error('Tanggal berakhir harus setelah tanggal mulai');
      return;
    }

    setIsSubmitting(true);
    try {
      const promoData = {
        company_id: selectedCompany.id,
        name: name.trim(),
        description: description.trim() || null,
        promo_code: promoCode.trim().toUpperCase() || null,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        max_discount: maxDiscount ? parseFloat(maxDiscount) : null,
        min_purchase: parseFloat(minPurchase) || 0,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        is_active: isActive,
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
        updated_at: new Date().toISOString()
      };

      if (editingPromo) {
        const { error } = await supabase
          .from('pos_promotions')
          .update(promoData)
          .eq('id', editingPromo.id);
        
        if (error) throw error;
        toast.success('Promosi berhasil diupdate');
      } else {
        const { error } = await supabase
          .from('pos_promotions')
          .insert({
            ...promoData,
            created_by: user?.id
          });
        
        if (error) throw error;
        toast.success('Promosi berhasil dibuat');
      }

      setShowCreateDialog(false);
      resetForm();
      fetchPromotions();
    } catch (error: any) {
      toast.error('Gagal menyimpan promosi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePromoStatus = async (promo: Promotion) => {
    const { error } = await supabase
      .from('pos_promotions')
      .update({ is_active: !promo.is_active, updated_at: new Date().toISOString() })
      .eq('id', promo.id);
    
    if (!error) {
      toast.success(promo.is_active ? 'Promosi dinonaktifkan' : 'Promosi diaktifkan');
      fetchPromotions();
    }
  };

  const deletePromotion = async (promoId: string) => {
    if (!confirm('Hapus promosi ini?')) return;
    
    const { error } = await supabase
      .from('pos_promotions')
      .delete()
      .eq('id', promoId);
    
    if (!error) {
      toast.success('Promosi dihapus');
      fetchPromotions();
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    
    if (isPast(end)) return { text: 'Berakhir', color: 'text-destructive' };
    
    const days = differenceInDays(end, now);
    const hours = differenceInHours(end, now) % 24;
    const minutes = differenceInMinutes(end, now) % 60;
    
    if (days > 0) return { text: `${days} hari ${hours} jam`, color: 'text-primary' };
    if (hours > 0) return { text: `${hours} jam ${minutes} menit`, color: 'text-warning' };
    return { text: `${minutes} menit`, color: 'text-destructive' };
  };

  const getPromoStatus = (promo: Promotion) => {
    const now = new Date();
    const start = new Date(promo.start_date);
    const end = new Date(promo.end_date);
    
    if (!promo.is_active) return <Badge variant="secondary">Nonaktif</Badge>;
    if (isPast(end)) return <Badge variant="destructive">Berakhir</Badge>;
    if (isFuture(start)) return <Badge variant="outline">Terjadwal</Badge>;
    return <Badge variant="default">Aktif</Badge>;
  };

  const filteredPromotions = promotions.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.promo_code && p.promo_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeCount = promotions.filter(p => p.is_active && !isPast(new Date(p.end_date))).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Promosi</h1>
          <p className="text-muted-foreground">Kelola promosi dan diskon dengan batas waktu</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Promosi Baru
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Total Promosi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{promotions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Sedang Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Total Penggunaan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{promotions.reduce((sum, p) => sum + p.used_count, 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari promosi atau kode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Promotions Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Promosi</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Diskon</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Sisa Waktu</TableHead>
              <TableHead>Penggunaan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Memuat...
                </TableCell>
              </TableRow>
            ) : filteredPromotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'Tidak ada promosi ditemukan' : 'Belum ada promosi'}
                </TableCell>
              </TableRow>
            ) : (
              filteredPromotions.map(promo => {
                const remaining = getTimeRemaining(promo.end_date);
                return (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{promo.name}</p>
                        {promo.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-48">{promo.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {promo.promo_code ? (
                        <Badge variant="outline" className="font-mono">{promo.promo_code}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {promo.discount_type === 'percentage' 
                            ? `${promo.discount_value}%` 
                            : formatCurrency(promo.discount_value)}
                        </p>
                        {promo.max_discount && (
                          <p className="text-xs text-muted-foreground">Max {formatCurrency(promo.max_discount)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(promo.start_date), 'dd MMM HH:mm', { locale: id })}</p>
                        <p className="text-muted-foreground">s/d {format(new Date(promo.end_date), 'dd MMM HH:mm', { locale: id })}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${remaining.color}`}>{remaining.text}</span>
                    </TableCell>
                    <TableCell>
                      {promo.usage_limit 
                        ? `${promo.used_count}/${promo.usage_limit}` 
                        : promo.used_count}
                    </TableCell>
                    <TableCell>{getPromoStatus(promo)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Switch 
                          checked={promo.is_active} 
                          onCheckedChange={() => togglePromoStatus(promo)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(promo)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePromotion(promo.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit Promosi' : 'Buat Promosi Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Nama Promosi *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Diskon Akhir Tahun"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi promosi..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Kode Promo</Label>
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Contoh: NEWYEAR30"
                className="uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipe Diskon *</Label>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Persentase (%)</SelectItem>
                    <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nilai Diskon *</Label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '30' : '50000'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Diskon (Rp)</Label>
                <Input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  placeholder="Contoh: 50000"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Pembelian (Rp)</Label>
                <Input
                  type="number"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Periode Berlaku *</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mulai</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-24"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Berakhir</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Batas Penggunaan</Label>
                <Input
                  type="number"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  placeholder="Tidak terbatas"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Aktifkan langsung</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>Batal</Button>
            <Button onClick={handleSavePromotion} disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : (editingPromo ? 'Update' : 'Simpan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Promotions;
