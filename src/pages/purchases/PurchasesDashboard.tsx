import React, { useEffect, useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingDown, Truck, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface PurchaseStats {
  totalPurchases: number;
  totalSuppliers: number;
  totalBills: number;
  outstandingAmount: number;
  paidAmount: number;
  pendingOrders: number;
}

export const PurchasesDashboard: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [stats, setStats] = useState<PurchaseStats>({
    totalPurchases: 0,
    totalSuppliers: 0,
    totalBills: 0,
    outstandingAmount: 0,
    paidAmount: 0,
    pendingOrders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCompany) return;
      setIsLoading(true);

      // Fetch suppliers count
      const { count: supplierCount } = await supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      // Fetch bills stats
      const { data: bills } = await supabase
        .from('bills')
        .select('total_amount, paid_amount, outstanding_amount, status')
        .eq('company_id', selectedCompany.id);

      // Fetch pending purchase orders
      const { count: pendingOrders } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .in('status', ['draft', 'confirmed']);

      const totalPurchases = bills?.reduce((sum, bill) => sum + (bill.total_amount || 0), 0) || 0;
      const paidAmount = bills?.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0) || 0;
      const outstandingAmount = bills?.reduce((sum, bill) => sum + (bill.outstanding_amount || 0), 0) || 0;

      setStats({
        totalPurchases,
        totalSuppliers: supplierCount || 0,
        totalBills: bills?.length || 0,
        outstandingAmount,
        paidAmount,
        pendingOrders: pendingOrders || 0,
      });
      setIsLoading(false);
    };

    fetchStats();
  }, [selectedCompany]);

  const statCards = [
    {
      title: 'Total Purchases',
      value: formatCurrency(stats.totalPurchases),
      icon: DollarSign,
      trend: 'This period',
      trendUp: false,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: 'Total Suppliers',
      value: stats.totalSuppliers.toString(),
      icon: Truck,
      trend: 'Active suppliers',
      trendUp: true,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders.toString(),
      icon: FileText,
      trend: 'Awaiting delivery',
      trendUp: false,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Outstanding Payables',
      value: formatCurrency(stats.outstandingAmount),
      icon: TrendingDown,
      trend: `${stats.totalBills} bills`,
      trendUp: false,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Purchases Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your purchasing activities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-green-600">{formatCurrency(stats.paidAmount)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full" 
                    style={{ width: stats.totalPurchases > 0 ? `${(stats.paidAmount / stats.totalPurchases) * 100}%` : '0%' }} 
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-medium text-orange-600">{formatCurrency(stats.outstandingAmount)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full" 
                    style={{ width: stats.totalPurchases > 0 ? `${(stats.outstandingAmount / stats.totalPurchases) * 100}%` : '0%' }} 
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{stats.totalBills}</p>
                <p className="text-sm text-muted-foreground">Total Bills</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{stats.pendingOrders}</p>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{stats.totalSuppliers}</p>
                <p className="text-sm text-muted-foreground">Active Suppliers</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalPurchases > 0 ? ((stats.paidAmount / stats.totalPurchases) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Payment Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PurchasesDashboard;