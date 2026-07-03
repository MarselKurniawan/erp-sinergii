import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { FileSpreadsheet, FileText, TrendingUp, Package, DollarSign, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface SalesData {
  date: string;
  transactions: number;
  revenue: number;
  cogs: number;
  profit: number;
}

interface ProductSales {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
}

interface PaymentBreakdown {
  method_name: string;
  total: number;
  count: number;
}

const POSReports = () => {
  const { selectedCompany } = useCompany();
  
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    totalCogs: 0,
    totalProfit: 0,
    totalTransactions: 0,
    avgTransaction: 0
  });

  const fetchReports = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    // Fetch transactions within date range
    const { data: transactions } = await supabase
      .from('pos_transactions')
      .select(`
        id,
        transaction_date,
        total_amount,
        total_cogs,
        status
      `)
      .eq('company_id', selectedCompany.id)
      .eq('status', 'completed')
      .gte('transaction_date', dateFrom)
      .lte('transaction_date', dateTo);

    // Calculate summary
    const totalRevenue = transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;
    const totalCogs = transactions?.reduce((sum, t) => sum + (t.total_cogs || 0), 0) || 0;
    const totalProfit = totalRevenue - totalCogs;
    const totalTransactions = transactions?.length || 0;
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    setSummaryStats({
      totalRevenue,
      totalCogs,
      totalProfit,
      totalTransactions,
      avgTransaction
    });

    // Group by date for daily sales
    const dailyMap = new Map<string, { transactions: number; revenue: number; cogs: number }>();
    transactions?.forEach(t => {
      const date = t.transaction_date;
      const existing = dailyMap.get(date) || { transactions: 0, revenue: 0, cogs: 0 };
      dailyMap.set(date, {
        transactions: existing.transactions + 1,
        revenue: existing.revenue + (t.total_amount || 0),
        cogs: existing.cogs + (t.total_cogs || 0)
      });
    });

    const daily: SalesData[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        transactions: data.transactions,
        revenue: data.revenue,
        cogs: data.cogs,
        profit: data.revenue - data.cogs
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    setSalesData(daily);

    // Fetch product sales
    const transactionIds = transactions?.map(t => t.id) || [];
    if (transactionIds.length > 0) {
      const { data: items } = await supabase
        .from('pos_transaction_items')
        .select(`
          product_id,
          quantity,
          total,
          cost_price,
          products(name)
        `)
        .in('pos_transaction_id', transactionIds);

      const productMap = new Map<string, ProductSales>();
      items?.forEach(item => {
        const existing = productMap.get(item.product_id) || {
          product_id: item.product_id,
          product_name: (item.products as any)?.name || 'Unknown',
          quantity: 0,
          revenue: 0,
          cogs: 0,
          profit: 0
        };
        
        const cogs = item.cost_price * item.quantity;
        productMap.set(item.product_id, {
          ...existing,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.total,
          cogs: existing.cogs + cogs,
          profit: existing.profit + (item.total - cogs)
        });
      });

      const products = Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity);
      setProductSales(products);

      // Fetch payment breakdown
      const { data: payments } = await supabase
        .from('pos_transaction_payments')
        .select(`
          amount,
          pos_payment_methods(name)
        `)
        .in('pos_transaction_id', transactionIds);

      const paymentMap = new Map<string, { total: number; count: number }>();
      payments?.forEach(p => {
        const name = (p.pos_payment_methods as any)?.name || 'Unknown';
        const existing = paymentMap.get(name) || { total: 0, count: 0 };
        paymentMap.set(name, {
          total: existing.total + p.amount,
          count: existing.count + 1
        });
      });

      setPaymentBreakdown(
        Array.from(paymentMap.entries())
          .map(([name, data]) => ({
            method_name: name,
            total: data.total,
            count: data.count
          }))
          .sort((a, b) => b.total - a.total)
      );
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [selectedCompany, dateFrom, dateTo]);

  const setPresetRange = (days: number) => {
    const to = new Date();
    const from = subDays(to, days);
    setDateFrom(format(from, 'yyyy-MM-dd'));
    setDateTo(format(to, 'yyyy-MM-dd'));
  };

  const exportSalesReport = (type: 'excel' | 'pdf') => {
    const data = salesData.map(s => ({
      Tanggal: format(new Date(s.date), 'dd MMM yyyy', { locale: id }),
      Transaksi: s.transactions,
      Pendapatan: formatCurrency(s.revenue),
      HPP: formatCurrency(s.cogs),
      Laba: formatCurrency(s.profit)
    }));

    if (type === 'excel') {
      exportToExcel(data, `Laporan-Penjualan-POS-${dateFrom}-${dateTo}`);
    } else {
      const headers = ['Tanggal', 'Transaksi', 'Pendapatan', 'HPP', 'Laba'];
      const rows = salesData.map(s => [
        format(new Date(s.date), 'dd MMM yyyy', { locale: id }),
        s.transactions.toString(),
        formatCurrency(s.revenue),
        formatCurrency(s.cogs),
        formatCurrency(s.profit)
      ]);
      const totalRow = [
        'TOTAL',
        summaryStats.totalTransactions.toString(),
        formatCurrency(summaryStats.totalRevenue),
        formatCurrency(summaryStats.totalCogs),
        formatCurrency(summaryStats.totalProfit)
      ];
      const html = generatePDFTable(headers, rows, { 
        totalRow, 
        subtitle: `Periode: ${format(new Date(dateFrom), 'dd MMM yyyy', { locale: id })} - ${format(new Date(dateTo), 'dd MMM yyyy', { locale: id })}` 
      });
      exportToPDF('Laporan Penjualan POS', html);
    }
  };

  const exportProductReport = (type: 'excel' | 'pdf') => {
    const data = productSales.map(p => ({
      Produk: p.product_name,
      'Qty Terjual': p.quantity,
      Pendapatan: formatCurrency(p.revenue),
      HPP: formatCurrency(p.cogs),
      Laba: formatCurrency(p.profit)
    }));

    if (type === 'excel') {
      exportToExcel(data, `Laporan-Produk-Terlaris-${dateFrom}-${dateTo}`);
    } else {
      const headers = ['Produk', 'Qty Terjual', 'Pendapatan', 'HPP', 'Laba'];
      const rows = productSales.map(p => [
        p.product_name,
        p.quantity.toString(),
        formatCurrency(p.revenue),
        formatCurrency(p.cogs),
        formatCurrency(p.profit)
      ]);
      const html = generatePDFTable(headers, rows, { 
        subtitle: `Periode: ${format(new Date(dateFrom), 'dd MMM yyyy', { locale: id })} - ${format(new Date(dateTo), 'dd MMM yyyy', { locale: id })}` 
      });
      exportToPDF('Laporan Produk Terlaris', html);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Laporan POS</h1>
        <p className="text-muted-foreground">Analisis penjualan dan performa POS</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Dari Tanggal</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sampai Tanggal</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPresetRange(7)}>7 Hari</Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange(30)}>30 Hari</Button>
              <Button variant="outline" size="sm" onClick={() => {
                setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
              }}>Bulan Ini</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summaryStats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total HPP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summaryStats.totalCogs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Laba Kotor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(summaryStats.totalProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryStats.totalTransactions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rata-rata/Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summaryStats.avgTransaction)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">
            <TrendingUp className="h-4 w-4 mr-2" />
            Penjualan Harian
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" />
            Produk Terlaris
          </TabsTrigger>
          <TabsTrigger value="payments">
            <DollarSign className="h-4 w-4 mr-2" />
            Metode Pembayaran
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Penjualan Harian</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportSalesReport('excel')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportSalesReport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Memuat...</p>
              ) : salesData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Tidak ada data</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-center">Transaksi</TableHead>
                      <TableHead className="text-right">Pendapatan</TableHead>
                      <TableHead className="text-right">HPP</TableHead>
                      <TableHead className="text-right">Laba</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.map(row => (
                      <TableRow key={row.date}>
                        <TableCell>{format(new Date(row.date), 'dd MMM yyyy', { locale: id })}</TableCell>
                        <TableCell className="text-center">{row.transactions}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(row.revenue)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(row.cogs)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Produk Terlaris</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportProductReport('excel')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportProductReport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Memuat...</p>
              ) : productSales.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Tidak ada data</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-center">Qty Terjual</TableHead>
                      <TableHead className="text-right">Pendapatan</TableHead>
                      <TableHead className="text-right">HPP</TableHead>
                      <TableHead className="text-right">Laba</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productSales.map((product, index) => (
                      <TableRow key={product.product_id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell className="text-center">{product.quantity}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(product.revenue)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(product.cogs)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(product.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rincian Metode Pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Memuat...</p>
              ) : paymentBreakdown.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Tidak ada data</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {paymentBreakdown.map(payment => (
                    <Card key={payment.method_name}>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">{payment.method_name}</p>
                        <p className="text-2xl font-bold">{formatCurrency(payment.total)}</p>
                        <p className="text-xs text-muted-foreground">{payment.count} transaksi</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default POSReports;
