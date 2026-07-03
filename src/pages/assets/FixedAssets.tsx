import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Plus, Calculator, Building2, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface FixedAsset {
  id: string;
  asset_code: string;
  name: string;
  description: string | null;
  purchase_date: string;
  purchase_price: number;
  useful_life_months: number;
  salvage_value: number;
  depreciation_method: 'straight_line' | 'declining_balance';
  current_value: number | null;
  accumulated_depreciation: number;
  status: 'active' | 'disposed' | 'fully_depreciated';
  asset_account_id: string | null;
  depreciation_expense_account_id: string | null;
  accumulated_depreciation_account_id: string | null;
}

const FixedAssets = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { getAssetAccounts, getExpenseAccounts } = useAccounts();

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepreciateDialogOpen, setIsDepreciateDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [depreciationDate, setDepreciationDate] = useState(new Date().toISOString().slice(0, 10));

  const assetAccounts = getAssetAccounts();
  const expenseAccounts = getExpenseAccounts();

  const [formData, setFormData] = useState({
    asset_code: '',
    name: '',
    description: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_price: 0,
    useful_life_months: 60,
    salvage_value: 0,
    depreciation_method: 'straight_line' as 'straight_line' | 'declining_balance',
    asset_account_id: '',
    depreciation_expense_account_id: '',
    accumulated_depreciation_account_id: ''
  });

  const fetchAssets = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (!error) {
      setAssets(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, [selectedCompany]);

  const generateAssetCode = async () => {
    const { count } = await supabase
      .from('fixed_assets')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany?.id);
    return `AST-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const handleOpenDialog = async () => {
    const code = await generateAssetCode();
    setFormData({
      ...formData,
      asset_code: code,
      purchase_date: new Date().toISOString().slice(0, 10)
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedCompany || !formData.name || !formData.purchase_price) {
      toast.error('Lengkapi data aset');
      return;
    }

    try {
      const currentValue = formData.purchase_price;

      const { error } = await supabase
        .from('fixed_assets')
        .insert({
          company_id: selectedCompany.id,
          ...formData,
          current_value: currentValue,
          accumulated_depreciation: 0,
          status: 'active',
          created_by: user?.id
        });

      if (error) throw error;

      toast.success('Aset tetap berhasil ditambahkan');
      setIsDialogOpen(false);
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal menyimpan aset: ' + error.message);
    }
  };

  const calculateMonthlyDepreciation = (asset: FixedAsset) => {
    if (asset.depreciation_method === 'straight_line') {
      return (asset.purchase_price - asset.salvage_value) / asset.useful_life_months;
    }
    // Declining balance (double)
    const rate = (2 / asset.useful_life_months);
    const currentValue = asset.current_value || asset.purchase_price;
    return Math.max(currentValue * rate, 0);
  };

  const handleDepreciate = async () => {
    if (!selectedAsset || !selectedCompany) return;

    const monthlyDepreciation = calculateMonthlyDepreciation(selectedAsset);
    const currentValue = selectedAsset.current_value || selectedAsset.purchase_price;
    const newAccumulated = selectedAsset.accumulated_depreciation + monthlyDepreciation;
    const newCurrentValue = Math.max(currentValue - monthlyDepreciation, selectedAsset.salvage_value);

    try {
      // Create journal entry for depreciation
      const journalNumber = `JV-DEP-${selectedAsset.asset_code}-${depreciationDate.replace(/-/g, '')}`;
      
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: selectedCompany.id,
          entry_number: journalNumber,
          entry_date: depreciationDate,
          description: `Penyusutan ${selectedAsset.name}`,
          reference_type: 'depreciation',
          reference_id: selectedAsset.id,
          is_posted: true,
          created_by: user?.id
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal lines
      if (selectedAsset.depreciation_expense_account_id && selectedAsset.accumulated_depreciation_account_id) {
        const journalLines = [
          { 
            journal_entry_id: journalEntry.id, 
            account_id: selectedAsset.depreciation_expense_account_id, 
            debit_amount: monthlyDepreciation, 
            credit_amount: 0, 
            description: `Beban penyusutan ${selectedAsset.name}` 
          },
          { 
            journal_entry_id: journalEntry.id, 
            account_id: selectedAsset.accumulated_depreciation_account_id, 
            debit_amount: 0, 
            credit_amount: monthlyDepreciation, 
            description: `Akumulasi penyusutan ${selectedAsset.name}` 
          }
        ];

        const { error: linesError } = await supabase
          .from('journal_entry_lines')
          .insert(journalLines);

        if (linesError) throw linesError;
      }

      // Record depreciation
      const { error: depError } = await supabase
        .from('asset_depreciations')
        .insert({
          asset_id: selectedAsset.id,
          depreciation_date: depreciationDate,
          amount: monthlyDepreciation,
          accumulated_total: newAccumulated,
          journal_entry_id: journalEntry.id
        });

      if (depError) throw depError;

      // Update asset
      const newStatus = newCurrentValue <= selectedAsset.salvage_value ? 'fully_depreciated' : 'active';
      
      const { error: updateError } = await supabase
        .from('fixed_assets')
        .update({
          current_value: newCurrentValue,
          accumulated_depreciation: newAccumulated,
          status: newStatus
        })
        .eq('id', selectedAsset.id);

      if (updateError) throw updateError;

      toast.success(`Penyusutan ${formatCurrency(monthlyDepreciation)} berhasil dicatat`);
      setIsDepreciateDialogOpen(false);
      setSelectedAsset(null);
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal mencatat penyusutan: ' + error.message);
    }
  };

  const totalAssetValue = assets.reduce((sum, a) => sum + (a.current_value || a.purchase_price), 0);
  const totalAccumulatedDep = assets.reduce((sum, a) => sum + a.accumulated_depreciation, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Aktif</Badge>;
      case 'disposed':
        return <Badge variant="destructive">Dilepas</Badge>;
      case 'fully_depreciated':
        return <Badge variant="secondary">Habis Susut</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aset Tetap</h1>
          <p className="text-muted-foreground">Kelola aset tetap dan penyusutan</p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Aset
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Total Nilai Aset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalAssetValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Total Akumulasi Penyusutan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalAccumulatedDep)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nilai Buku</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalAssetValue - totalAccumulatedDep)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Aset</TableHead>
                <TableHead>Tgl Beli</TableHead>
                <TableHead className="text-right">Harga Perolehan</TableHead>
                <TableHead className="text-right">Akum. Penyusutan</TableHead>
                <TableHead className="text-right">Nilai Buku</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Memuat...</TableCell>
                </TableRow>
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Belum ada aset tetap
                  </TableCell>
                </TableRow>
              ) : (
                assets.map(asset => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono">{asset.asset_code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        {asset.description && (
                          <p className="text-xs text-muted-foreground">{asset.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(asset.purchase_date), 'dd MMM yyyy', { locale: id })}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(asset.purchase_price)}</TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(asset.accumulated_depreciation)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency((asset.current_value || asset.purchase_price) - asset.accumulated_depreciation)}
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(asset.status)}</TableCell>
                    <TableCell className="text-center">
                      {asset.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAsset(asset);
                            setIsDepreciateDialogOpen(true);
                          }}
                        >
                          <Calculator className="mr-1 h-3 w-3" /> Susutkan
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Asset Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Aset Tetap</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kode Aset</Label>
              <Input value={formData.asset_code} disabled />
            </div>
            <div className="space-y-2">
              <Label>Nama Aset *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama aset"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi aset"
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Pembelian *</Label>
              <Input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Harga Perolehan *</Label>
              <Input
                type="number"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Umur Ekonomis (bulan) *</Label>
              <Input
                type="number"
                value={formData.useful_life_months}
                onChange={(e) => setFormData({ ...formData, useful_life_months: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nilai Residu</Label>
              <Input
                type="number"
                value={formData.salvage_value}
                onChange={(e) => setFormData({ ...formData, salvage_value: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Metode Penyusutan</Label>
              <Select 
                value={formData.depreciation_method} 
                onValueChange={(v: 'straight_line' | 'declining_balance') => setFormData({ ...formData, depreciation_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">Garis Lurus</SelectItem>
                  <SelectItem value="declining_balance">Saldo Menurun</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Akun Aset</Label>
              <Select 
                value={formData.asset_account_id} 
                onValueChange={(v) => setFormData({ ...formData, asset_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Akun Beban Penyusutan</Label>
              <Select 
                value={formData.depreciation_expense_account_id} 
                onValueChange={(v) => setFormData({ ...formData, depreciation_expense_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Akun Akumulasi Penyusutan</Label>
              <Select 
                value={formData.accumulated_depreciation_account_id} 
                onValueChange={(v) => setFormData({ ...formData, accumulated_depreciation_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Depreciate Dialog */}
      <Dialog open={isDepreciateDialogOpen} onOpenChange={setIsDepreciateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Penyusutan</DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedAsset.name}</p>
                <p className="text-sm text-muted-foreground">{selectedAsset.asset_code}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nilai Buku Saat Ini:</span>
                  <p className="font-medium">{formatCurrency(selectedAsset.current_value || selectedAsset.purchase_price)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Penyusutan per Bulan:</span>
                  <p className="font-medium text-red-600">{formatCurrency(calculateMonthlyDepreciation(selectedAsset))}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Penyusutan</Label>
                <Input
                  type="date"
                  value={depreciationDate}
                  onChange={(e) => setDepreciationDate(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDepreciateDialogOpen(false)}>Batal</Button>
            <Button onClick={handleDepreciate}>Proses Penyusutan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixedAssets;
