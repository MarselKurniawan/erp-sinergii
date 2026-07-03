import React, { useState, useEffect } from 'react';
import { TrendingDown, Truck, FileText, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/formatters';

export const PurchaseReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalPurchases: 0,
    totalOrders: 0,
    totalBilled: 0,
    totalPaid: 0,
  });

  const fetchPurchaseData = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    const { data: orders } = await supabase
      .from('purchase_orders')
      .select(`
        id, order_number, order_date, status, total_amount,
        supplier:suppliers(name)
      `)
      .eq('company_id', selectedCompany.id)
      .gte('order_date', dateFrom)
      .lte('order_date', dateTo)
      .order('order_date', { ascending: false });

    const { data: bills } = await supabase
      .from('bills')
      .select('total_amount, paid_amount')
      .eq('company_id', selectedCompany.id)
      .gte('bill_date', dateFrom)
      .lte('bill_date', dateTo);

    setPurchaseData(orders || []);
    setSummary({
      totalPurchases: (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0),
      totalOrders: (orders || []).length,
      totalBilled: (bills || []).reduce((sum, b) => sum + (b.total_amount || 0), 0),
      totalPaid: (bills || []).reduce((sum, b) => sum + (b.paid_amount || 0), 0),
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPurchaseData();
  }, [selectedCompany, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Purchase Report</h1>
        <p className="text-muted-foreground mt-1">Laporan pembelian per periode</p>
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
              <TrendingDown className="w-10 h-10 text-destructive/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Purchases</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalPurchases)}</p>
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
              <DollarSign className="w-10 h-10 text-warning/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Billed</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalBilled)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <DollarSign className="w-10 h-10 text-destructive/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : purchaseData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada data pembelian dalam periode ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>No. Order</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseData.map((order) => (
                    <tr key={order.id}>
                      <td>{formatDate(order.order_date)}</td>
                      <td className="font-mono">{order.order_number}</td>
                      <td>{order.supplier?.name}</td>
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
                    <td className="text-right">{formatCurrency(summary.totalPurchases)}</td>
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

export default PurchaseReport;
