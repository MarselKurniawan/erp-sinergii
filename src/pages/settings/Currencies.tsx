import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Coins, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
}
interface Rate {
  id: string;
  currency_code: string;
  rate_date: string;
  rate_to_base: number;
  source: string | null;
  notes: string | null;
  created_at: string;
}

const Currencies: React.FC = () => {
  const { selectedCompany, refreshCompanies } = useCompany() as any;
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    currency_code: 'USD',
    rate_date: new Date().toISOString().split('T')[0],
    rate_to_base: '',
    notes: '',
  });
  const [savingBase, setSavingBase] = useState(false);

  const base = (selectedCompany as any)?.base_currency || 'IDR';

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const [{ data: curs }, { data: rs }] = await Promise.all([
      supabase.from('currencies' as any).select('*').order('code'),
      supabase
        .from('exchange_rates' as any)
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('rate_date', { ascending: false })
        .limit(500),
    ]);
    setCurrencies((curs as any) || []);
    setRates((rs as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedCompany?.id]);

  const latestByCurrency = useMemo(() => {
    const map: Record<string, Rate> = {};
    for (const r of rates) {
      if (!map[r.currency_code]) map[r.currency_code] = r;
    }
    return map;
  }, [rates]);

  const handleAddRate = async () => {
    if (!selectedCompany) return;
    const rate = parseFloat(form.rate_to_base);
    if (!rate || rate <= 0) {
      toast.error('Kurs harus lebih besar dari 0');
      return;
    }
    if (form.currency_code === base) {
      toast.error(`Tidak perlu input kurs untuk mata uang dasar (${base})`);
      return;
    }
    const { error } = await supabase.from('exchange_rates' as any).insert({
      company_id: selectedCompany.id,
      currency_code: form.currency_code,
      rate_date: form.rate_date,
      rate_to_base: rate,
      notes: form.notes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Kurs berhasil disimpan');
    setDialogOpen(false);
    setForm({ ...form, rate_to_base: '', notes: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kurs ini?')) return;
    const { error } = await supabase.from('exchange_rates' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Kurs dihapus');
    load();
  };

  const handleChangeBase = async (newBase: string) => {
    if (!selectedCompany || newBase === base) return;
    if (
      !confirm(
        `Ubah mata uang dasar ke ${newBase}? Ini mempengaruhi seluruh laporan keuangan.`,
      )
    )
      return;
    setSavingBase(true);
    const { error } = await supabase
      .from('companies')
      .update({ base_currency: newBase } as any)
      .eq('id', selectedCompany.id);
    setSavingBase(false);
    if (error) return toast.error(error.message);
    toast.success('Mata uang dasar diperbarui');
    if (refreshCompanies) await refreshCompanies();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Coins className="w-6 h-6" /> Mata Uang & Kurs
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola mata uang transaksi dan kurs ke mata uang dasar perusahaan.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!selectedCompany}>
          <Plus className="w-4 h-4 mr-2" /> Input Kurs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mata Uang Dasar</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="w-64">
            <SearchableSelect
              value={base}
              onValueChange={handleChangeBase}
              disabled={savingBase || !selectedCompany}
              options={currencies.map((c) => ({
                value: c.code,
                label: `${c.code} — ${c.name}`,
              }))}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            Semua laporan keuangan tampil dalam mata uang ini.
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kurs Terbaru per Mata Uang</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata Uang</TableHead>
                <TableHead>Simbol</TableHead>
                <TableHead>Kurs Terbaru → {base}</TableHead>
                <TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies
                .filter((c) => c.code !== base)
                .map((c) => {
                  const r = latestByCurrency[c.code];
                  return (
                    <TableRow key={c.code}>
                      <TableCell className="font-medium">
                        {c.code} — {c.name}
                      </TableCell>
                      <TableCell>{c.symbol}</TableCell>
                      <TableCell>
                        {r ? (
                          <span>
                            1 {c.code} ={' '}
                            <strong>
                              {Number(r.rate_to_base).toLocaleString('id-ID', {
                                maximumFractionDigits: 6,
                              })}
                            </strong>{' '}
                            {base}
                          </span>
                        ) : (
                          <Badge variant="outline">Belum diset</Badge>
                        )}
                      </TableCell>
                      <TableCell>{r ? formatDate(r.rate_date) : '-'}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Kurs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kurs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Mata Uang</TableHead>
                  <TableHead>Kurs</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.rate_date)}</TableCell>
                    <TableCell>{r.currency_code}</TableCell>
                    <TableCell>
                      {Number(r.rate_to_base).toLocaleString('id-ID', {
                        maximumFractionDigits: 6,
                      })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Input Kurs Baru</DialogTitle>
            <DialogDescription>
              Kurs ini dipakai sebagai default saat membuat dokumen transaksi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mata Uang</Label>
              <SearchableSelect
                value={form.currency_code}
                onValueChange={(v) => setForm({ ...form, currency_code: v })}
                options={currencies
                  .filter((c) => c.code !== base)
                  .map((c) => ({
                    value: c.code,
                    label: `${c.code} — ${c.name}`,
                  }))}
              />
            </div>
            <div>
              <Label>Tanggal Berlaku</Label>
              <Input
                type="date"
                value={form.rate_date}
                onChange={(e) => setForm({ ...form, rate_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Kurs (1 {form.currency_code} = ? {base})</Label>
              <Input
                type="number"
                step="0.000001"
                min="0"
                value={form.rate_to_base}
                placeholder="Contoh: 16250"
                onChange={(e) =>
                  setForm({ ...form, rate_to_base: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Catatan (opsional)</Label>
              <Input
                value={form.notes}
                placeholder="Sumber: BI middle rate / bank X"
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleAddRate}>Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Currencies;
