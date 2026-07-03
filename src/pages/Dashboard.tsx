import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Users,
  Wallet,
  Building2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  cashBalance: number;
  totalCustomers: number;
  totalSuppliers: number;
  invoiceCount: number;
  billCount: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expense: number;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

const formatCompactCurrency = (value: number) => {
  if (value >= 1000000000) {
    return `Rp ${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}M`;
  }
  return formatCurrency(value);
};

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  valueColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon: Icon, iconBg, valueColor }) => {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className={`text-2xl font-heading font-bold ${valueColor || 'text-foreground'}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    outstandingReceivables: 0,
    outstandingPayables: 0,
    cashBalance: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    invoiceCount: 0,
    billCount: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [arAging, setArAging] = useState<AgingBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany) return;

    const fetchDashboardData = async () => {
      setIsLoading(true);

      // Fetch invoices for receivables
      const { data: invoices } = await supabase
        .from('invoices')
        .select('outstanding_amount, total_amount')
        .eq('company_id', selectedCompany.id)
        .neq('status', 'cancelled');

      // Fetch bills for payables
      const { data: bills } = await supabase
        .from('bills')
        .select('outstanding_amount, total_amount')
        .eq('company_id', selectedCompany.id)
        .neq('status', 'cancelled');

      // Fetch customers count
      const { count: customerCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      // Fetch suppliers count
      const { count: supplierCount } = await supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      // Get posted journal entries for this company first
      const { data: postedJournals } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('is_posted', true);

      const postedJournalIds = (postedJournals || []).map(j => j.id);

      // Calculate cash balance from journal entries
      let cashBalance = 0;
      if (postedJournalIds.length > 0) {
        const { data: cashEntries } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            account:chart_of_accounts!journal_entry_lines_account_id_fkey(
              account_type
            )
          `)
          .in('journal_entry_id', postedJournalIds);

        (cashEntries || []).forEach((entry: any) => {
          if (entry.account?.account_type === 'cash_bank') {
            cashBalance += (entry.debit_amount || 0) - (entry.credit_amount || 0);
          }
        });
      }

      // Calculate revenue and expenses from journal entries (current year)
      const startOfYear = new Date();
      startOfYear.setMonth(0, 1);
      
      // Get posted journals for this year
      const { data: yearJournals } = await supabase
        .from('journal_entries')
        .select('id, entry_date')
        .eq('company_id', selectedCompany.id)
        .eq('is_posted', true)
        .gte('entry_date', startOfYear.toISOString().split('T')[0]);

      const yearJournalIds = (yearJournals || []).map(j => j.id);
      const journalDateMap = new Map((yearJournals || []).map(j => [j.id, j.entry_date]));

      let totalRevenue = 0;
      let totalExpenses = 0;
      
      // Get monthly data for chart
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const monthlyStats: MonthlyData[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        monthlyStats.push({
          month: months[monthIndex],
          revenue: 0,
          expense: 0,
        });
      }

      if (yearJournalIds.length > 0) {
        const { data: plEntries } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            journal_entry_id,
            account:chart_of_accounts!journal_entry_lines_account_id_fkey(
              account_type
            )
          `)
          .in('journal_entry_id', yearJournalIds);

        (plEntries || []).forEach((entry: any) => {
          if (entry.account?.account_type === 'revenue') {
            totalRevenue += (entry.credit_amount || 0) - (entry.debit_amount || 0);
          } else if (entry.account?.account_type === 'expense') {
            totalExpenses += (entry.debit_amount || 0) - (entry.credit_amount || 0);
          }
          
          // Monthly chart data
          const entryDate = journalDateMap.get(entry.journal_entry_id);
          if (entryDate) {
            const entryMonth = new Date(entryDate).getMonth();
            const monthData = monthlyStats.find((m, idx) => {
              const targetMonth = (currentMonth - (5 - idx) + 12) % 12;
              return targetMonth === entryMonth;
            });
            if (monthData) {
              if (entry.account?.account_type === 'revenue') {
                monthData.revenue += (entry.credit_amount || 0) - (entry.debit_amount || 0);
              } else if (entry.account?.account_type === 'expense') {
                monthData.expense += (entry.debit_amount || 0) - (entry.credit_amount || 0);
              }
            }
          }
        });
      }

      setMonthlyData(monthlyStats);

      // Get recent transactions (payments)
      const { data: payments } = await supabase
        .from('payments')
        .select('id, payment_number, payment_date, amount, payment_type, customers(name), suppliers(name)')
        .eq('company_id', selectedCompany.id)
        .order('payment_date', { ascending: false })
        .limit(5);

      const transactions: Transaction[] = (payments || []).map((p: any) => ({
        id: p.id,
        type: p.payment_type === 'incoming' ? 'income' : 'expense',
        description: p.payment_type === 'incoming' 
          ? `Payment from ${p.customers?.name || 'Customer'}`
          : `Payment to ${p.suppliers?.name || 'Supplier'}`,
        amount: p.amount,
        date: p.payment_date,
      }));

      setRecentTransactions(transactions);

      // Fetch top products from POS transactions (current month)
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      const { data: posTransactions } = await supabase
        .from('pos_transactions')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'completed')
        .gte('transaction_date', firstOfMonth.toISOString().split('T')[0]);

      if (posTransactions && posTransactions.length > 0) {
        const txIds = posTransactions.map(t => t.id);
        const { data: posItems } = await supabase
          .from('pos_transaction_items')
          .select('quantity, total, product:products!pos_transaction_items_product_id_fkey(name)')
          .in('pos_transaction_id', txIds);

        const productMap = new Map<string, TopProduct>();
        (posItems || []).forEach((item: any) => {
          const name = item.product?.name || 'Unknown';
          const existing = productMap.get(name) || { name, quantity: 0, revenue: 0 };
          existing.quantity += item.quantity || 0;
          existing.revenue += item.total || 0;
          productMap.set(name, existing);
        });
        setTopProducts(
          Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
        );
      }

      // Calculate AR Aging buckets
      const today = new Date();
      const agingBuckets: AgingBucket[] = [
        { label: 'Belum Jatuh Tempo', amount: 0, count: 0 },
        { label: '1-30 Hari', amount: 0, count: 0 },
        { label: '31-60 Hari', amount: 0, count: 0 },
        { label: '61-90 Hari', amount: 0, count: 0 },
        { label: '> 90 Hari', amount: 0, count: 0 },
      ];

      (invoices || []).forEach((inv: any) => {
        if (!inv.outstanding_amount || inv.outstanding_amount <= 0) return;
        const dueDate = new Date(inv.due_date || inv.invoice_date);
        const daysPast = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        let bucket: number;
        if (daysPast <= 0) bucket = 0;
        else if (daysPast <= 30) bucket = 1;
        else if (daysPast <= 60) bucket = 2;
        else if (daysPast <= 90) bucket = 3;
        else bucket = 4;

        agingBuckets[bucket].amount += inv.outstanding_amount;
        agingBuckets[bucket].count += 1;
      });

      setArAging(agingBuckets);

      // Set stats
      setStats({
        totalRevenue,
        totalExpenses,
        outstandingReceivables: (invoices || []).reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0),
        outstandingPayables: (bills || []).reduce((sum, bill) => sum + (bill.outstanding_amount || 0), 0),
        cashBalance,
        totalCustomers: customerCount || 0,
        totalSuppliers: supplierCount || 0,
        invoiceCount: (invoices || []).filter(i => i.outstanding_amount > 0).length,
        billCount: (bills || []).filter(b => b.outstanding_amount > 0).length,
      });

      setIsLoading(false);
    };

    fetchDashboardData();
  }, [selectedCompany]);

  const netProfit = stats.totalRevenue - stats.totalExpenses;

  const pieData = [
    { name: 'Revenue', value: stats.totalRevenue, color: 'hsl(142, 71%, 45%)' },
    { name: 'Expenses', value: stats.totalExpenses, color: 'hsl(38, 92%, 50%)' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's what's happening with {selectedCompany?.name}
        </p>
      </div>

      {/* Stats Grid - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Cash & Bank"
          value={formatCompactCurrency(stats.cashBalance)}
          subtitle="Current balance"
          icon={Wallet}
          iconBg="gradient-primary"
          valueColor={stats.cashBalance >= 0 ? 'text-success' : 'text-destructive'}
        />
        <StatCard
          title="Accounts Receivable"
          value={formatCompactCurrency(stats.outstandingReceivables)}
          subtitle={`${stats.invoiceCount} unpaid invoices`}
          icon={TrendingUp}
          iconBg="bg-success"
        />
        <StatCard
          title="Accounts Payable"
          value={formatCompactCurrency(stats.outstandingPayables)}
          subtitle={`${stats.billCount} unpaid bills`}
          icon={TrendingDown}
          iconBg="bg-warning"
        />
        <StatCard
          title="Net Profit (YTD)"
          value={formatCompactCurrency(netProfit)}
          subtitle={`Revenue: ${formatCompactCurrency(stats.totalRevenue)}`}
          icon={DollarSign}
          iconBg={netProfit >= 0 ? 'bg-success' : 'bg-destructive'}
          valueColor={netProfit >= 0 ? 'text-success' : 'text-destructive'}
        />
      </div>

      {/* Stats Grid - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue (YTD)"
          value={formatCompactCurrency(stats.totalRevenue)}
          icon={TrendingUp}
          iconBg="bg-success"
        />
        <StatCard
          title="Total Expenses (YTD)"
          value={formatCompactCurrency(stats.totalExpenses)}
          icon={CreditCard}
          iconBg="bg-warning"
        />
        <StatCard
          title="Customers"
          value={stats.totalCustomers.toString()}
          icon={Users}
          iconBg="bg-primary"
        />
        <StatCard
          title="Suppliers"
          value={stats.totalSuppliers.toString()}
          icon={Building2}
          iconBg="bg-accent"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Revenue vs Expenses (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading chart data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(0)}M` : value.toString()}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(142, 71%, 45%)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      name="Revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      stroke="hsl(38, 92%, 50%)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorExpense)"
                      name="Expense"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profit Summary */}
        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Profit Summary (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Revenue</span>
                </div>
                <span className="font-medium text-success">{formatCurrency(stats.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-sm text-muted-foreground">Expenses</span>
                </div>
                <span className="font-medium text-warning">{formatCurrency(stats.totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-semibold">Net Profit</span>
                <span className={`font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products & AR Aging Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card className="animate-fade-in" style={{ animationDelay: '175ms' }}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Top Produk (Bulan Ini)</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Belum ada data POS bulan ini</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.quantity} terjual</p>
                    </div>
                    <span className="font-medium text-sm">{formatCompactCurrency(product.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AR Aging */}
        <Card className="animate-fade-in" style={{ animationDelay: '175ms' }}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Aging Piutang (AR)</CardTitle>
          </CardHeader>
          <CardContent>
            {arAging.every(b => b.amount === 0) ? (
              <p className="text-center text-muted-foreground py-8">Tidak ada piutang outstanding</p>
            ) : (
              <div className="space-y-3">
                {arAging.map((bucket, index) => {
                  const maxAmount = Math.max(...arAging.map(b => b.amount), 1);
                  const percentage = (bucket.amount / maxAmount) * 100;
                  const colors = ['bg-success', 'bg-blue-500', 'bg-warning', 'bg-orange-500', 'bg-destructive'];
                  return (
                    <div key={bucket.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{bucket.label}</span>
                        <span className="font-medium">
                          {formatCompactCurrency(bucket.amount)}
                          {bucket.count > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">({bucket.count})</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${colors[index]} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent payments</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="font-medium">{transaction.description}</td>
                      <td className="text-muted-foreground">{formatDate(transaction.date)}</td>
                      <td>
                        <span className={`badge-status ${
                          transaction.type === 'income' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {transaction.type === 'income' ? 'Received' : 'Paid'}
                        </span>
                      </td>
                      <td className={`text-right font-medium ${
                        transaction.type === 'income' ? 'text-success' : 'text-destructive'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
