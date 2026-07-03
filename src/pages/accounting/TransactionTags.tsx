import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TransactionTag {
  id: string;
  name: string;
  category: string;
  color: string;
  is_system: boolean;
}

const SYSTEM_CATEGORIES = [
  { value: 'operasional', label: 'Operasional', color: '#22c55e' },
  { value: 'investasi', label: 'Investasi', color: '#3b82f6' },
  { value: 'pendanaan', label: 'Pendanaan', color: '#a855f7' },
];

const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', 
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'
];

const TransactionTags: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [tags, setTags] = useState<TransactionTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTag, setEditingTag] = useState<TransactionTag | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('custom');
  const [color, setColor] = useState('#6366f1');

  const fetchTags = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('transaction_tags')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('category')
      .order('name');

    if (!error) {
      setTags(data || []);
    }
    setIsLoading(false);
  };

  const initializeSystemTags = async () => {
    if (!selectedCompany) return;

    // Check if system tags exist
    const { data: existingTags } = await supabase
      .from('transaction_tags')
      .select('id')
      .eq('company_id', selectedCompany.id)
      .eq('is_system', true);

    if (existingTags && existingTags.length > 0) return;

    // Create system tags
    const systemTags = SYSTEM_CATEGORIES.map(cat => ({
      company_id: selectedCompany.id,
      name: cat.label,
      category: cat.value,
      color: cat.color,
      is_system: true,
    }));

    await supabase.from('transaction_tags').insert(systemTags);
    fetchTags();
  };

  const resetForm = () => {
    setName('');
    setCategory('custom');
    setColor('#6366f1');
    setEditingTag(null);
  };

  const handleSubmit = async () => {
    if (!selectedCompany || !name.trim()) {
      toast.error('Nama tag harus diisi');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingTag) {
        const { error } = await supabase
          .from('transaction_tags')
          .update({ name, category, color })
          .eq('id', editingTag.id);

        if (error) throw error;
        toast.success('Tag berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('transaction_tags')
          .insert({
            company_id: selectedCompany.id,
            name,
            category,
            color,
            is_system: false,
          });

        if (error) throw error;
        toast.success('Tag berhasil ditambahkan');
      }

      setShowDialog(false);
      resetForm();
      fetchTags();
    } catch (error: any) {
      toast.error('Gagal menyimpan tag: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (tag: TransactionTag) => {
    setEditingTag(tag);
    setName(tag.name);
    setCategory(tag.category);
    setColor(tag.color);
    setShowDialog(true);
  };

  const handleDelete = async (tag: TransactionTag) => {
    if (tag.is_system) {
      toast.error('Tag sistem tidak dapat dihapus');
      return;
    }

    if (!confirm('Apakah Anda yakin ingin menghapus tag ini?')) return;

    const { error } = await supabase
      .from('transaction_tags')
      .delete()
      .eq('id', tag.id);

    if (error) {
      toast.error('Gagal menghapus tag');
    } else {
      toast.success('Tag berhasil dihapus');
      fetchTags();
    }
  };

  useEffect(() => {
    if (selectedCompany) {
      initializeSystemTags();
      fetchTags();
    }
  }, [selectedCompany]);

  if (!selectedCompany) {
    return <div className="p-6 text-muted-foreground">Pilih perusahaan terlebih dahulu</div>;
  }

  const getCategoryLabel = (cat: string) => {
    const found = SYSTEM_CATEGORIES.find(c => c.value === cat);
    return found ? found.label : 'Custom';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Tag Transaksi</h1>
          <p className="text-muted-foreground">Kelola tag untuk mengkategorikan transaksi jurnal</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Tambah Tag
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Daftar Tag
          </CardTitle>
          <CardDescription>
            Tag sistem (Operasional, Investasi, Pendanaan) tidak dapat dihapus
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada tag
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        style={{ 
                          borderColor: tag.color, 
                          backgroundColor: `${tag.color}20`,
                          color: tag.color 
                        }}
                      >
                        {tag.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{getCategoryLabel(tag.category)}</TableCell>
                    <TableCell>
                      {tag.is_system ? (
                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">Sistem</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">Custom</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(tag)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!tag.is_system && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(tag)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
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
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Tambah Tag Baru'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nama Tag</Label>
              <Input
                placeholder="Contoh: Marketing, Proyek A, dll"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Preview</Label>
              <div className="mt-2">
                <Badge 
                  variant="outline" 
                  style={{ 
                    borderColor: color, 
                    backgroundColor: `${color}20`,
                    color: color 
                  }}
                >
                  {name || 'Nama Tag'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                editingTag ? 'Simpan Perubahan' : 'Tambah Tag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionTags;
