import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Download, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { exportToCSV } from '@/lib/exportUtils';

interface TaxEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  account_name: string;
  account_code: string;
  debit: number;
  credit: number;
  type: 'masukan' | 'keluaran';
}

const TaxReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [entries, setEntries] = useState<TaxEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchTaxData = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    // Get posted journal entries in date range
    const { data: journals } = await supabase
      .from('journal_entries')
      .select('id, entry_date, entry_number, description')
      .eq('company_id', selectedCompany.id)
      .eq('is_posted', true)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date');

    if (!journals || journals.length === 0) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    const journalIds = journals.map(j => j.id);
    const journalMap = new Map(journals.map(j => [j.id, j]));

    // Get journal lines for tax-related accounts
    // PPN Masukan (asset, code starts with 1-25xx) and PPN Keluaran (liability, code starts with 2-16xx)
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select(`
        id,
        journal_entry_id,
        debit_amount,
        credit_amount,
        description,
        account:chart_of_accounts!journal_entry_lines_account_id_fkey(
          id, code, name, account_type
        )
      `)
      .in('journal_entry_id', journalIds);

    const taxEntries: TaxEntry[] = [];

    (lines || []).forEach((line: any) => {
      const account = line.account;
      if (!account) return;

      const name = account.name.toLowerCase();
      const code = account.code;

      // PPN Masukan (VAT In) - usually asset account
      const isMasukan = name.includes('ppn masukan') || name.includes('vat in') || 
                         name.includes('pajak masukan') || code === '1-2500';
      
      // PPN Keluaran (VAT Out) - usually liability account
      const isKeluaran = name.includes('ppn keluaran') || name.includes('vat out') || 
                          name.includes('pajak keluaran') || code === '2-1600';

      // PPh accounts
      const isPPh = name.includes('pph') || name.includes('income tax');

      if (isMasukan || isKeluaran || isPPh) {
        const journal = journalMap.get(line.journal_entry_id);
        if (journal) {
          taxEntries.push({
            id: line.id,
            entry_date: journal.entry_date,
            entry_number: journal.entry_number,
            description: line.description || journal.description || '',
            account_name: account.name,
            account_code: account.code,
            debit: line.debit_amount || 0,
            credit: line.credit_amount || 0,
            type: isMasukan ? 'masukan' : 'keluaran',
          });
        }
      }
    });

    setEntries(taxEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTaxData();
  }, [selectedCompany]);

  const handleFilter = () => {
    fetchTaxData();
  };

  const masukanEntries = entries.filter(e => e.type === 'masukan');
  const keluaranEntries = entries.filter(e => e.type === 'keluaran');

  const totalMasukan = masukanEntries.reduce((sum, e) => sum + e.debit - e.credit, 0);
  const totalKeluaran = keluaranEntries.reduce((sum, e) => sum + e.credit - e.debit, 0);
  const ppnKurangBayar = totalKeluaran - totalMasukan;

  const handleExport = () => {
    exportToCSV(
      entries.map(e => ({
        'Tanggal': e.entry_date,
        'No. Jurnal': e.entry_number,
        'Keterangan': e.description,
        'Akun': `${e.account_code} - ${e.account_name}`,
        'Tipe': e.type === 'masukan' ? 'PPN Masukan' : 'PPN Keluaran',
        'Debit': e.debit,
        'Kredit': e.credit,
      })),
      `rekap-pajak-${startDate}-${endDate}`,
      {
        companyName: selectedCompany?.name || '',
        reportTitle: 'Rekap Pajak (PPN)',
        dateLabel: `Periode: ${startDate} s/d ${endDate}`,
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-8 w-8" />
            Rekap Pajak (PPN)
          </h1>
          <p className="text-muted-foreground">Rekap PPN Masukan & Keluaran untuk pelaporan SPT</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={entries.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-1 flex-1">
              <Label>Dari Tanggal</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label>Sampai Tanggal</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={handleFilter}>Tampilkan</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">PPN Masukan</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(Math.abs(totalMasukan))}</p>
                <p className="text-xs text-muted-foreground mt-1">Dapat dikreditkan</p>
              </div>
              <TrendingDown className="w-10 h-10 text-success/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">PPN Keluaran</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(Math.abs(totalKeluaran))}</p>
                <p className="text-xs text-muted-foreground mt-1">Dipungut dari customer</p>
              </div>
              <TrendingUp className="w-10 h-10 text-warning/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {ppnKurangBayar >= 0 ? 'PPN Kurang Bayar' : 'PPN Lebih Bayar'}
                </p>
                <p className={`text-2xl font-bold ${ppnKurangBayar >= 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency(Math.abs(ppnKurangBayar))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ppnKurangBayar >= 0 ? 'Harus disetor ke negara' : 'Dapat dikompensasi'}
                </p>
              </div>
              <Receipt className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Memuat data pajak...</CardContent></Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tidak ada data pajak</h3>
              <p className="text-muted-foreground">
                Pastikan ada jurnal yang sudah diposting dengan akun PPN Masukan/Keluaran di periode ini
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* PPN Keluaran */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PPN Keluaran (VAT Out)</CardTitle>
              <CardDescription>PPN yang dipungut dari penjualan</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Jurnal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Akun</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keluaranEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">Tidak ada data</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {keluaranEntries.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>{formatDate(e.entry_date)}</TableCell>
                          <TableCell className="font-mono text-sm">{e.entry_number}</TableCell>
                          <TableCell>{e.description}</TableCell>
                          <TableCell className="text-sm">{e.account_code} - {e.account_name}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(e.credit - e.debit)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4}>Total PPN Keluaran</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalKeluaran)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* PPN Masukan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PPN Masukan (VAT In)</CardTitle>
              <CardDescription>PPN yang dibayar atas pembelian</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Jurnal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Akun</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {masukanEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">Tidak ada data</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {masukanEntries.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>{formatDate(e.entry_date)}</TableCell>
                          <TableCell className="font-mono text-sm">{e.entry_number}</TableCell>
                          <TableCell>{e.description}</TableCell>
                          <TableCell className="text-sm">{e.account_code} - {e.account_name}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(e.debit - e.credit)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4}>Total PPN Masukan</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalMasukan)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TaxReport;
