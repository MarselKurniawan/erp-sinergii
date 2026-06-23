import React, { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';

const SalesPaymentReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const def = defaultRange();
  const [from, setFrom] = useState(def.from); const [to, setTo] = useState(def.to);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (!selectedCompany) return;
    supabase.from('invoices').select('id, invoice_number, invoice_date, total_amount, paid_amount, outstanding_amount, status, customers(name)')
      .eq('company_id', selectedCompany.id).is('voided_at', null)
      .gte('invoice_date', from).lte('invoice_date', to).order('invoice_date', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [selectedCompany, from, to]);
  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const paid = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const out = rows.reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);
  return (
    <ReportShell title="Sales / Payment Report" icon={<Receipt className="h-6 w-6" />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Tanggal</TableHead><TableHead>Invoice</TableHead><TableHead>Customer</TableHead>
          <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Dibayar</TableHead><TableHead className="text-right">Outstanding</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{formatDate(r.invoice_date)}</TableCell>
                <TableCell className="font-mono">{r.invoice_number}</TableCell>
                <TableCell>{r.customers?.name || '-'}</TableCell>
                <TableCell><Badge variant={r.status === 'paid' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                <TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(r.paid_amount)}</TableCell>
                <TableCell className="text-right text-red-600">{formatCurrency(r.outstanding_amount)}</TableCell>
              </TableRow>
            ))}
          <TableRow className="font-bold border-t-2">
            <TableCell colSpan={4}>TOTAL</TableCell>
            <TableCell className="text-right">{formatCurrency(total)}</TableCell>
            <TableCell className="text-right">{formatCurrency(paid)}</TableCell>
            <TableCell className="text-right">{formatCurrency(out)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ReportShell>
  );
};
export default SalesPaymentReport;