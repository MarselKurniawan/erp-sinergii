import React, { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';

const PurchaseOrderReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const def = defaultRange();
  const [from, setFrom] = useState(def.from); const [to, setTo] = useState(def.to);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (!selectedCompany) return;
    supabase.from('purchase_orders').select('id, order_number, order_date, status, total_amount, suppliers(name)')
      .eq('company_id', selectedCompany.id).gte('order_date', from).lte('order_date', to)
      .order('order_date', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [selectedCompany, from, to]);
  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  return (
    <ReportShell title="Purchase Order Report" icon={<Truck className="h-6 w-6" />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <Table>
        <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No PO</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            : rows.map(r => <TableRow key={r.id}><TableCell>{formatDate(r.order_date)}</TableCell><TableCell className="font-mono">{r.order_number}</TableCell><TableCell>{r.suppliers?.name || '-'}</TableCell><TableCell><Badge variant="secondary">{r.status}</Badge></TableCell><TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell></TableRow>)}
          <TableRow className="font-bold border-t-2"><TableCell colSpan={4}>TOTAL</TableCell><TableCell className="text-right">{formatCurrency(total)}</TableCell></TableRow>
        </TableBody>
      </Table>
    </ReportShell>
  );
};
export default PurchaseOrderReport;