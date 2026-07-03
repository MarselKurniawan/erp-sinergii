import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';

const DayBookReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const def = defaultRange();
  const [from, setFrom] = useState(def.from); const [to, setTo] = useState(def.to);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (!selectedCompany) return; (async () => {
    const je = await supabase.from('journal_entries')
      .select('id, entry_number, entry_date, description, status, journal_entry_lines(debit, credit)')
      .eq('company_id', selectedCompany.id).gte('entry_date', from).lte('entry_date', to)
      .order('entry_date', { ascending: false });
    const mapped = (je.data || []).map((j: any) => {
      const totalDebit = (j.journal_entry_lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      return { ...j, total: totalDebit };
    });
    setRows(mapped);
  })(); }, [selectedCompany, from, to]);
  const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  return (
    <ReportShell title="Day Book Report" icon={<BookOpen className="h-6 w-6" />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <Table>
        <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No JE</TableHead><TableHead>Deskripsi</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Nilai</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            : rows.map(r => <TableRow key={r.id}><TableCell>{formatDate(r.entry_date)}</TableCell><TableCell className="font-mono">{r.entry_number}</TableCell><TableCell>{r.description || '-'}</TableCell><TableCell>{r.status}</TableCell><TableCell className="text-right">{formatCurrency(r.total)}</TableCell></TableRow>)}
          <TableRow className="font-bold border-t-2"><TableCell colSpan={4}>TOTAL</TableCell><TableCell className="text-right">{formatCurrency(total)}</TableCell></TableRow>
        </TableBody>
      </Table>
    </ReportShell>
  );
};
export default DayBookReport;