import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ReportShell, defaultRange } from '@/components/reports/ReportShell';

const ExpenseDetailedReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const def = defaultRange();
  const [from, setFrom] = useState(def.from); const [to, setTo] = useState(def.to);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (!selectedCompany) return;
    supabase.from('expenses').select('id, expense_number, expense_date, description, total_amount, expense_account:chart_of_accounts!expenses_expense_account_id_fkey(code, name), payment_account:chart_of_accounts!expenses_payment_account_id_fkey(code, name)')
      .eq('company_id', selectedCompany.id).gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [selectedCompany, from, to]);
  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  return (
    <ReportShell title="Detailed Expense Report" icon={<Wallet className="h-6 w-6" />} from={from} to={to} setFrom={setFrom} setTo={setTo}>
      <Table>
        <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>No</TableHead><TableHead>Deskripsi</TableHead><TableHead>Akun Expense</TableHead><TableHead>Dibayar Via</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            : rows.map(r => <TableRow key={r.id}><TableCell>{formatDate(r.expense_date)}</TableCell><TableCell className="font-mono">{r.expense_number}</TableCell><TableCell>{r.description || '-'}</TableCell><TableCell>{r.expense_account ? `${r.expense_account.code} - ${r.expense_account.name}` : '-'}</TableCell><TableCell>{r.payment_account ? `${r.payment_account.code} - ${r.payment_account.name}` : '-'}</TableCell><TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell></TableRow>)}
          <TableRow className="font-bold border-t-2"><TableCell colSpan={5}>TOTAL</TableCell><TableCell className="text-right">{formatCurrency(total)}</TableCell></TableRow>
        </TableBody>
      </Table>
    </ReportShell>
  );
};
export default ExpenseDetailedReport;