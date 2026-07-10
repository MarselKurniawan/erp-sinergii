import React, { useEffect, useState } from 'react';
import { Plus, Percent, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { toast } from 'sonner';

interface WHT {
  id: string;
  code: string;
  name: string;
  rate: number;
  liability_account_id: string | null;
  is_active: boolean;
  notes: string | null;
}

const empty = {
  id: '',
  code: '',
  name: '',
  rate: '',
  liability_account_id: '',
  is_active: true,
  notes: '',
};

const WithholdingTax: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { accounts } = useAccounts();
  const [rows, setRows] = useState<WHT[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const liabilityAccounts = accounts.filter((a: any) => a.account_type === 'liability');

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('withholding_tax_types' as any)
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('code');
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedCompany?.id]);

  const openNew = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r: WHT) => {
    setForm({
      id: r.id,
      code: r.code,
      name: r.name,
      rate: String(r.rate * 100),
      liability_account_id: r.liability_account_id || '',
      is_active: r.is_active,
      notes: r.notes || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!selectedCompany) return;
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Kode dan nama wajib diisi');
      return;
    }
    const ratePct = parseFloat(form.rate);
    if (isNaN(ratePct) || ratePct < 0) {
      toast.error('Tarif tidak valid');
      return;
    }
    const payload = {
      company_id: selectedCompany.id,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      rate: ratePct / 100,
      liability_account_id: form.liability_account_id || null,
      is_active: form.is_active,
      notes: form.notes || null,
    };
    const { error } = form.id
      ? await supabase.from('withholding_tax_types' as any).update(payload).eq('id', form.id)
      : await supabase.from('withholding_tax_types' as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Tersimpan');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus jenis PPh ini?')) return;
    const { error } = await supabase.from('withholding_tax_types' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Dihapus');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Percent className="w-6 h-6" /> Withholding Tax (PPh)
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola jenis PPh Potong yang tersedia untuk perusahaan ini (PPh 23, 22, 4(2), dll).
          </p>
        </div>
        <Button onClick={openNew} disabled={!selectedCompany}>
          <Plus className="w-4 h-4 mr-2" /> Jenis PPh Baru
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Jenis PPh</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada jenis PPh.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Akun Hutang PPh</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const acc = accounts.find((a: any) => a.id === r.liability_account_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{(r.rate * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-sm">
                        {acc ? `${acc.code} — ${acc.name}` : <Badge variant="outline">Belum diset</Badge>}
                      </TableCell>
                      <TableCell>
                        {r.is_active ? (
                          <Badge>Aktif</Badge>
                        ) : (
                          <Badge variant="secondary">Nonaktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Ubah' : 'Tambah'} Jenis PPh</DialogTitle>
            <DialogDescription>
              Tarif dinyatakan dalam persen. Contoh: 2 untuk PPh 23 jasa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kode</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="PPH23_JASA"
                />
              </div>
              <div>
                <Label>Tarif (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="2"
                />
              </div>
            </div>
            <div>
              <Label>Nama</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="PPh 23 - Jasa Konsultan"
              />
            </div>
            <div>
              <Label>Akun Hutang PPh</Label>
              <SearchableSelect
                value={form.liability_account_id}
                onChange={(v) => setForm({ ...form, liability_account_id: v })}
                options={liabilityAccounts.map((a: any) => ({
                  value: a.id,
                  label: `${a.code} — ${a.name}`,
                }))}
              />
            </div>
            <div>
              <Label>Catatan</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Aktif</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={save}>Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WithholdingTax;
