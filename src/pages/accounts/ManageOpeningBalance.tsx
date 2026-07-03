import React, { useEffect, useMemo, useState } from 'react';
import { Save, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

const ManageOpeningBalance: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { accounts } = useAccounts();
  const [balances, setBalances] = useState<Record<string, { debit: string; credit: string; id?: string }>>({});
  const [balanceDate, setBalanceDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchBalances = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('opening_balances')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('balance_date', balanceDate);
    const map: any = {};
    (data || []).forEach((b: any) => {
      map[b.account_id] = {
        id: b.id,
        debit: String(b.debit_balance || 0),
        credit: String(b.credit_balance || 0),
      };
    });
    setBalances(map);
    setLoading(false);
  };

  useEffect(() => { fetchBalances(); }, [selectedCompany, balanceDate]);

  const setVal = (accountId: string, field: 'debit' | 'credit', value: string) => {
    setBalances(prev => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] || { debit: '0', credit: '0' }),
        [field]: value,
      },
    }));
  };

  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    Object.values(balances).forEach(b => {
      debit += parseFloat(b.debit || '0') || 0;
      credit += parseFloat(b.credit || '0') || 0;
    });
    return { debit, credit, diff: debit - credit };
  }, [balances]);

  const handleSave = async () => {
    if (!selectedCompany) return;
    if (Math.abs(totals.diff) > 0.01) {
      toast.error(`Debit dan Credit harus seimbang (selisih: ${formatCurrency(totals.diff)})`); return;
    }
    setSaving(true);
    try {
      const upserts = Object.entries(balances)
        .filter(([_, b]) => (parseFloat(b.debit || '0') || 0) !== 0 || (parseFloat(b.credit || '0') || 0) !== 0)
        .map(([accountId, b]) => ({
          company_id: selectedCompany.id,
          account_id: accountId,
          balance_date: balanceDate,
          debit_balance: parseFloat(b.debit || '0') || 0,
          credit_balance: parseFloat(b.credit || '0') || 0,
        }));

      // Clear existing for date then insert
      await supabase.from('opening_balances')
        .delete()
        .eq('company_id', selectedCompany.id)
        .eq('balance_date', balanceDate);

      if (upserts.length > 0) {
        const { error } = await supabase.from('opening_balances').insert(upserts as any);
        if (error) throw error;
      }
      toast.success('Opening balance tersimpan');
      fetchBalances();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const filtered = accounts.filter(a =>
    !filter ||
    a.code.toLowerCase().includes(filter.toLowerCase()) ||
    a.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Manage Opening Balance</h1>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Tanggal Saldo Awal</label>
            <Input type="date" value={balanceDate} onChange={(e) => setBalanceDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Cari Akun</label>
            <Input placeholder="Cari kode/nama..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-4 p-3 bg-muted/50 rounded">
          <div>Total Debit: <strong>{formatCurrency(totals.debit)}</strong></div>
          <div>Total Credit: <strong>{formatCurrency(totals.credit)}</strong></div>
          <div>Selisih: <Badge variant={Math.abs(totals.diff) < 0.01 ? 'default' : 'destructive'}>{formatCurrency(totals.diff)}</Badge></div>
        </div>

        <Table>
          <TableHeader><TableRow>
            <TableHead>Kode</TableHead><TableHead>Nama Akun</TableHead><TableHead>Tipe</TableHead>
            <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (<TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>)
              : filtered.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell><Badge variant="outline">{a.account_type}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="text-right max-w-[160px] ml-auto"
                      value={balances[a.id]?.debit || ''}
                      onChange={(e) => setVal(a.id, 'debit', e.target.value)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="text-right max-w-[160px] ml-auto"
                      value={balances[a.id]?.credit || ''}
                      onChange={(e) => setVal(a.id, 'credit', e.target.value)} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default ManageOpeningBalance;