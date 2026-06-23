import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';

const TopClientsReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const def = defaultRange();
  const [from, setFrom] = useState(def.from); const [to, setTo] = useState(def.to);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (!selectedCompany) return;
    supabase.from('invoices').select('customer_id, total_amount, customers(name)')
      .eq('company_id', selectedCompany.id).is('voided_at', null).gte('invoice_date', from).lte('invoice_date', to)
      .then(({ data }) => {
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
          const k = r.customer_id || 'none';
          map[k] = map[k] || { name: r.customers?.name || '-', total: 0, count: 0 };
          map[k].total += Number(r.total_amount || 0); map[k].count += 1;
        });
        setRows(Object.values(map).sort((a: any, b: any) => b.total - a.total).slice(0, 5));
      });
  }, [selectedCompany, from, to]);
  return (
    <ReportShell title="Top 5 Customers" icon={<Trophy className="h-6 w-6" />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <Table>
        <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Jml Invoice</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            : rows.map((r, i) => <TableRow key={i}><TableCell>#{i + 1}</TableCell><TableCell className="font-medium">{r.name}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{formatCurrency(r.total)}</TableCell></TableRow>)}
        </TableBody>
      </Table>
    </ReportShell>
  );
};
export default TopClientsReport;