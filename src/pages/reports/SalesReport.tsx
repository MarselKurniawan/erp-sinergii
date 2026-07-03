import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, FileText, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/formatters';

export const SalesReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalInvoiced: 0,
    totalPaid: 0,
  });

  const fetchSalesData = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    const { data: orders } = await supabase
      .from('sales_orders')
      .select(`
        id, order_number, order_date, status, total_amount,
        customer:customers(name)
      `)
      .eq('company_id', selectedCompany.id)
      .gte('order_date', dateFrom)
      .lte('order_date', dateTo)
      .order('order_date', { ascending: false });

    const { data: invoices } = await supabase
      .from('invoices')
      .select('total_amount, paid_amount')
      .eq('company_id', selectedCompany.id)
      .gte('invoice_date', dateFrom)
      .lte('invoice_date', dateTo);

    setSalesData(orders || []);
    setSummary({
      totalSales: (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0),
      totalOrders: (orders || []).length,
      totalInvoiced: (invoices || []).reduce((sum, i) => sum + (i.total_amount || 0), 0),
      totalPaid: (invoices || []).reduce((sum, i) => sum + (i.paid_amount || 0), 0),
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSalesData();
  }, [selectedCompany, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Sales Report</h1>
        <p className="text-muted-foreground mt-1">Laporan penjualan per periode</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-[200px]">
              <label className="form-label">Dari Tanggal</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex-1 max-w-[200px]">
              <label className="form-label">Sampai Tanggal</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="w-10 h-10 text-primary/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <FileText className="w-10 h-10 text-primary/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{summary.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <DollarSign className="w-10 h-10 text-success/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Invoiced</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalInvoiced)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <DollarSign className="w-10 h-10 text-success/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(summary.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Sales Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : salesData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada data penjualan dalam periode ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>No. Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map((order) => (
                    <tr key={order.id}>
                      <td>{formatDate(order.order_date)}</td>
                      <td className="font-mono">{order.order_number}</td>
                      <td>{order.customer?.name}</td>
                      <td>
                        <span className="badge-status capitalize">{order.status}</span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(order.total_amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={4}>Total</td>
                    <td className="text-right">{formatCurrency(summary.totalSales)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesReport;
