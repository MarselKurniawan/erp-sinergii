import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/formatters';

const ReceivablesPayables: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [receivables, setReceivables] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    (async () => {
      const inv = await supabase.from('invoices')
        .select('id, customer_id, customers(name), total_amount, paid_amount, outstanding_amount')
        .eq('company_id', selectedCompany.id).is('voided_at', null).gt('outstanding_amount', 0);
      const bills = await supabase.from('bills')
        .select('id, supplier_id, suppliers(name), total_amount, paid_amount, outstanding_amount')
        .eq('company_id', selectedCompany.id).is('voided_at', null).gt('outstanding_amount', 0);

      const groupedR: Record<string, any> = {};
      (inv.data || []).forEach((r: any) => {
        const k = r.customer_id || 'none';
        groupedR[k] = groupedR[k] || { name: r.customers?.name || '-', total: 0, paid: 0, outstanding: 0, count: 0 };
        groupedR[k].total += Number(r.total_amount || 0);
        groupedR[k].paid += Number(r.paid_amount || 0);
        groupedR[k].outstanding += Number(r.outstanding_amount || 0);
        groupedR[k].count += 1;
      });
      const groupedP: Record<string, any> = {};
      (bills.data || []).forEach((r: any) => {
        const k = r.supplier_id || 'none';
        groupedP[k] = groupedP[k] || { name: r.suppliers?.name || '-', total: 0, paid: 0, outstanding: 0, count: 0 };
        groupedP[k].total += Number(r.total_amount || 0);
        groupedP[k].paid += Number(r.paid_amount || 0);
        groupedP[k].outstanding += Number(r.outstanding_amount || 0);
        groupedP[k].count += 1;
      });
      setReceivables(Object.values(groupedR).sort((a: any, b: any) => b.outstanding - a.outstanding));
      setPayables(Object.values(groupedP).sort((a: any, b: any) => b.outstanding - a.outstanding));
    })();
  }, [selectedCompany]);

  const totalR = receivables.reduce((s, r) => s + r.outstanding, 0);
  const totalP = payables.reduce((s, r) => s + r.outstanding, 0);

  const renderTable = (rows: any[], label: string) => (
    <Table>
      <TableHeader><TableRow>
        <TableHead>{label}</TableHead>
        <TableHead className="text-right">Jml Dokumen</TableHead>
        <TableHead className="text-right">Total</TableHead>
        <TableHead className="text-right">Dibayar</TableHead>
        <TableHead className="text-right">Outstanding</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada outstanding</TableCell></TableRow>
        ) : rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell className="text-right">{r.count}</TableCell>
            <TableCell className="text-right">{formatCurrency(r.total)}</TableCell>
            <TableCell className="text-right text-green-600">{formatCurrency(r.paid)}</TableCell>
            <TableCell className="text-right font-semibold text-red-600">{formatCurrency(r.outstanding)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Receivables & Payables</h1>
      <div className="grid grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Total Piutang (AR)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(totalR)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total Hutang (AP)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(totalP)}</p></CardContent></Card>
      </div>
      <Tabs defaultValue="receivables">
        <TabsList>
          <TabsTrigger value="receivables">Piutang (AR)</TabsTrigger>
          <TabsTrigger value="payables">Hutang (AP)</TabsTrigger>
        </TabsList>
        <TabsContent value="receivables"><Card><CardContent className="p-4">{renderTable(receivables, 'Customer')}</CardContent></Card></TabsContent>
        <TabsContent value="payables"><Card><CardContent className="p-4">{renderTable(payables, 'Supplier')}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
};

export default ReceivablesPayables;