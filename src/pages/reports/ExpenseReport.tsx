import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';

const ExpenseReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const def = defaultRange();
  const [from, setFrom] = useState(def.from); const [to, setTo] = useState(def.to);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (!selectedCompany) return;
    supabase.from('expenses').select('expense_account_id, total_amount, expense_account:chart_of_accounts!expenses_expense_account_id_fkey(code, name)')
      .eq('company_id', selectedCompany.id).gte('expense_date', from).lte('expense_date', to)
      .then(({ data }) => {
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
          const k = r.expense_account_id || 'none';
          map[k] = map[k] || { name: r.expense_account ? `${r.expense_account.code} - ${r.expense_account.name}` : '-', total: 0, count: 0 };
          map[k].total += Number(r.total_amount || 0); map[k].count += 1;
        });
        setRows(Object.values(map).sort((a: any, b: any) => b.total - a.total));
      });
  }, [selectedCompany, from, to]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <ReportShell title="Expense Report (Per Akun)" icon={<Wallet className="h-6 w-6" />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <Table>
        <TableHeader><TableRow><TableHead>Akun</TableHead><TableHead className="text-right">Jml Transaksi</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            : rows.map((r, i) => <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{formatCurrency(r.total)}</TableCell></TableRow>)}
          <TableRow className="font-bold border-t-2"><TableCell colSpan={2}>TOTAL</TableCell><TableCell className="text-right">{formatCurrency(total)}</TableCell></TableRow>
        </TableBody>
      </Table>
    </ReportShell>
  );
};
export default ExpenseReport;