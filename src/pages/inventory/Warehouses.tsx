import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, MapPin, Warehouse as WarehouseIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  address: string | null;
  pic_user_id: string | null;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
}

const Warehouses: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    location: '',
    address: '',
    pic_user_id: '',
  });

  const fetchWarehouses = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('code');

    if (error) {
      toast.error('Gagal memuat data gudang');
    } else {
      setWarehouses(data || []);
    }
    setIsLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .order('full_name');

    if (!error) {
      setUsers(data || []);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    fetchUsers();
  }, [selectedCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const warehouseData = {
      company_id: selectedCompany.id,
      code: formData.code,
      name: formData.name,
      location: formData.location || null,
      address: formData.address || null,
      pic_user_id: formData.pic_user_id || null,
    };

    if (editingWarehouse) {
      const { error } = await supabase
        .from('warehouses')
        .update(warehouseData)
        .eq('id', editingWarehouse.id);

      if (error) {
        toast.error('Gagal mengupdate gudang');
      } else {
        toast.success('Gudang berhasil diupdate');
        setIsDialogOpen(false);
        fetchWarehouses();
      }
    } else {
      const { error } = await supabase
        .from('warehouses')
        .insert(warehouseData);

      if (error) {
        toast.error('Gagal menambah gudang');
      } else {
        toast.success('Gudang berhasil ditambahkan');
        setIsDialogOpen(false);
        fetchWarehouses();
      }
    }
  };

  const handleDelete = async () => {
    if (!deletingWarehouse) return;

    const { error } = await supabase
      .from('warehouses')
      .update({ is_active: false })
      .eq('id', deletingWarehouse.id);

    if (error) {
      toast.error('Gagal menghapus gudang');
    } else {
      toast.success('Gudang berhasil dihapus');
      setIsDeleteDialogOpen(false);
      fetchWarehouses();
    }
  };

  const openAddDialog = () => {
    setEditingWarehouse(null);
    setFormData({ code: '', name: '', location: '', address: '', pic_user_id: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      code: warehouse.code,
      name: warehouse.name,
      location: warehouse.location || '',
      address: warehouse.address || '',
      pic_user_id: warehouse.pic_user_id || '',
    });
    setIsDialogOpen(true);
  };

  const filteredWarehouses = warehouses.filter(w => 
    w.is_active && (
      w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.location?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const userOptions = users.map(u => ({
    value: u.id,
    label: u.full_name || u.email || u.id,
  }));

  const getPicName = (picUserId: string | null) => {
    if (!picUserId) return null;
    const user = users.find(u => u.id === picUserId);
    return user?.full_name || user?.email || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Warehouses</h1>
          <p className="text-muted-foreground mt-1">Kelola gudang dan lokasi penyimpanan</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Tambah Gudang
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari gudang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/2 mb-4" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <WarehouseIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Belum ada gudang</h3>
            <p className="text-muted-foreground mb-4">Tambahkan gudang pertama untuk mulai mengelola inventory</p>
            <Button onClick={openAddDialog}>Tambah Gudang</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWarehouses.map(warehouse => (
            <Card key={warehouse.id} className="group hover:shadow-lg transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <WarehouseIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">{warehouse.code}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(warehouse)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={() => { setDeletingWarehouse(warehouse); setIsDeleteDialogOpen(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {warehouse.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{warehouse.location}</span>
                  </div>
                )}
                {warehouse.pic_user_id && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>PIC: {getPicName(warehouse.pic_user_id)}</span>
                  </div>
                )}
                {warehouse.address && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{warehouse.address}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? 'Edit Gudang' : 'Tambah Gudang'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="WH001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nama *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Gudang Utama"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Jakarta Barat"
              />
            </div>
            <div className="space-y-2">
              <Label>Alamat Lengkap</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Jl. Industri No. 123..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>PIC (Person In Charge)</Label>
              <SearchableSelect
                options={userOptions}
                value={formData.pic_user_id}
                onChange={(value) => setFormData({ ...formData, pic_user_id: value })}
                placeholder="Pilih PIC"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit">
                {editingWarehouse ? 'Simpan' : 'Tambah'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Gudang?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus gudang "{deletingWarehouse?.name}"? 
              Data inventory terkait akan tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Warehouses;
