import React, { useEffect, useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Warehouse, ArrowLeftRight, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';

interface InventoryStats {
  totalProducts: number;
  totalWarehouses: number;
  totalStockValue: number;
  pendingTransfers: number;
  lowStockItems: number;
  activeOpnames: number;
}

export const InventoryDashboard: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [stats, setStats] = useState<InventoryStats>({
    totalProducts: 0,
    totalWarehouses: 0,
    totalStockValue: 0,
    pendingTransfers: 0,
    lowStockItems: 0,
    activeOpnames: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCompany) return;
      setIsLoading(true);

      // Fetch products count and stock value
      const { data: products } = await supabase
        .from('products')
        .select('stock_quantity, cost_price')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true);

      const totalProducts = products?.length || 0;
      const totalStockValue = products?.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.cost_price || 0)), 0) || 0;
      const lowStockItems = products?.filter(p => (p.stock_quantity || 0) < 10).length || 0;

      // Fetch warehouses count
      const { count: warehouseCount } = await supabase
        .from('warehouses')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true);

      // Fetch pending transfers
      const { count: pendingTransfers } = await supabase
        .from('stock_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .in('status', ['pending', 'approved']);

      // Fetch active opnames
      const { count: activeOpnames } = await supabase
        .from('stock_opname')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .in('status', ['draft', 'in_progress']);

      setStats({
        totalProducts,
        totalWarehouses: warehouseCount || 0,
        totalStockValue,
        pendingTransfers: pendingTransfers || 0,
        lowStockItems,
        activeOpnames: activeOpnames || 0,
      });
      setIsLoading(false);
    };

    fetchStats();
  }, [selectedCompany]);

  const statCards = [
    {
      title: 'Total Products',
      value: formatNumber(stats.totalProducts),
      icon: Package,
      subtitle: `${stats.lowStockItems} low stock`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Warehouses',
      value: stats.totalWarehouses.toString(),
      icon: Warehouse,
      subtitle: 'Active locations',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Stock Value',
      value: formatCurrency(stats.totalStockValue),
      icon: Package,
      subtitle: 'Total inventory value',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Pending Transfers',
      value: stats.pendingTransfers.toString(),
      icon: ArrowLeftRight,
      subtitle: 'Awaiting completion',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Inventory Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your inventory status</p>
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
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockItems > 0 ? (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-800 font-medium">
                  {stats.lowStockItems} product(s) have low stock (less than 10 units)
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  Consider restocking these items soon to avoid stockouts.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  All products have sufficient stock levels
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-500" />
              Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{stats.pendingTransfers}</p>
                <p className="text-sm text-muted-foreground">Pending Transfers</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{stats.activeOpnames}</p>
                <p className="text-sm text-muted-foreground">Active Stock Opname</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InventoryDashboard;