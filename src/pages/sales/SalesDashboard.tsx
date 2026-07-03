import React, { useEffect, useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface SalesStats {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  totalCustomers: number;
  totalInvoices: number;
  outstandingAmount: number;
  paidAmount: number;
}

export const SalesDashboard: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [stats, setStats] = useState<SalesStats>({
    totalRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    grossMargin: 0,
    totalCustomers: 0,
    totalInvoices: 0,
    outstandingAmount: 0,
    paidAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCompany) return;
      setIsLoading(true);

      // Fetch customers count
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      // Fetch invoices stats
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount, outstanding_amount, status')
        .eq('company_id', selectedCompany.id);

      const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const paidAmount = invoices?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0;
      const outstandingAmount = invoices?.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0) || 0;

      // Estimate COGS as 60% of revenue (simplified)
      const totalCOGS = totalRevenue * 0.6;
      const grossProfit = totalRevenue - totalCOGS;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      setStats({
        totalRevenue,
        totalCOGS,
        grossProfit,
        grossMargin,
        totalCustomers: customerCount || 0,
        totalInvoices: invoices?.length || 0,
        outstandingAmount,
        paidAmount,
      });
      setIsLoading(false);
    };

    fetchStats();
  }, [selectedCompany]);

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      trend: '+12.5%',
      trendUp: true,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Gross Profit',
      value: formatCurrency(stats.grossProfit),
      icon: TrendingUp,
      trend: `${stats.grossMargin.toFixed(1)}% margin`,
      trendUp: true,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toString(),
      icon: Users,
      trend: '+3 new',
      trendUp: true,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Outstanding',
      value: formatCurrency(stats.outstandingAmount),
      icon: FileText,
      trend: `${stats.totalInvoices} invoices`,
      trendUp: false,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Sales Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your sales performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {stat.trendUp ? (
                    <ArrowUpRight className="w-4 h-4 text-green-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-orange-600" />
                  )}
                  <span className={stat.trendUp ? 'text-green-600' : 'text-orange-600'}>
                    {stat.trend}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Revenue vs COGS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium">{formatCurrency(stats.totalRevenue)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">COGS</span>
                  <span className="font-medium">{formatCurrency(stats.totalCOGS)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Gross Profit</span>
                  <span className="font-medium text-green-600">{formatCurrency(stats.grossProfit)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '40%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    style={{ width: stats.totalRevenue > 0 ? `${(stats.paidAmount / stats.totalRevenue) * 100}%` : '0%' }} 
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
                    style={{ width: stats.totalRevenue > 0 ? `${(stats.outstandingAmount / stats.totalRevenue) * 100}%` : '0%' }} 
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SalesDashboard;