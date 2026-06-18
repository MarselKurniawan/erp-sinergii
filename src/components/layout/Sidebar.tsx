import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Users,
  Receipt,
  CreditCard,
  Building2,
  LogOut,
  Settings,
  Warehouse,
  Lock,
  Store,
  Landmark,
  Factory,
  Wallet,
  TrendingUp,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { usePermissions } from '@/hooks/usePermissions';
import sinergiLogo from '@/assets/sinergi-logo.png';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  feature?: string;
  children?: { label: string; path: string; feature?: string }[];
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', feature: 'dashboard' },
  {
    icon: ShoppingCart, label: 'Sale',
    children: [
      { label: 'Create New Sale', path: '/sales/invoices?new=1', feature: 'sales/invoices' },
      { label: 'Sale List', path: '/sales/invoices', feature: 'sales/invoices' },
      { label: 'Create New Estimate', path: '/sales/estimates/new', feature: 'sales/estimates' },
      { label: 'Estimate List', path: '/sales/estimates', feature: 'sales/estimates' },
      { label: 'New Sale Order', path: '/sales/orders?new=1', feature: 'sales/orders' },
      { label: 'Sale Order List', path: '/sales/orders', feature: 'sales/orders' },
      { label: 'Sale Return', path: '/sales/returns', feature: 'sales/returns' },
    ],
  },
  {
    icon: Truck, label: 'Purchase',
    children: [
      { label: 'New Purchase', path: '/purchases/bills?new=1', feature: 'purchases/bills' },
      { label: 'Purchase List', path: '/purchases/bills', feature: 'purchases/bills' },
      { label: 'New Purchase Order', path: '/purchases/orders?new=1', feature: 'purchases/orders' },
      { label: 'Purchase Order List', path: '/purchases/orders', feature: 'purchases/orders' },
      { label: 'Purchase Return', path: '/purchases/returns', feature: 'purchases/returns' },
    ],
  },
  {
    icon: Wallet, label: 'Expense',
    children: [
      { label: 'New Expenses', path: '/expenses/new', feature: 'expenses' },
      { label: 'Expenses List', path: '/expenses', feature: 'expenses' },
    ],
  },
  {
    icon: CreditCard, label: 'Payment & Cash/Bank',
    children: [
      { label: 'New Payment', path: '/sales/payments?new=1', feature: 'sales/payments' },
      { label: 'Payment List', path: '/sales/payments', feature: 'sales/payments' },
      { label: 'New Cash/Bank Transfer', path: '/cash-bank/transfers/new', feature: 'cash-bank/transfers' },
      { label: 'Cash/Bank Transfer List', path: '/cash-bank/transfers', feature: 'cash-bank/transfers' },
      { label: 'Show Cash/Bank Balance', path: '/cash-bank', feature: 'cash-bank' },
      { label: 'Fix Payment Mapping Issues', path: '/cash-bank/fix-mapping', feature: 'cash-bank/fix-mapping' },
    ],
  },
  { icon: Receipt, label: 'Receipt', path: '/receipts', feature: 'receipts' },
  {
    icon: TrendingUp, label: 'Capital Transaction',
    children: [
      { label: 'New Transaction', path: '/capital/new', feature: 'capital' },
      { label: 'Transaction List', path: '/capital', feature: 'capital' },
    ],
  },
  {
    icon: BookOpen, label: 'Accounts',
    children: [
      { label: 'New Account', path: '/accounts?new=1', feature: 'accounts' },
      { label: 'Account List', path: '/accounts', feature: 'accounts' },
      { label: 'Manage Opening Balance', path: '/accounts/opening-balance', feature: 'accounts/opening-balance' },
    ],
  },
  {
    icon: FileText, label: 'Journal',
    children: [
      { label: 'New Journal', path: '/journal?new=1', feature: 'journal' },
      { label: 'Journal List', path: '/journal', feature: 'journal' },
    ],
  },
  {
    icon: Users, label: 'Customer & Supplier',
    children: [
      { label: 'New Customer/Supplier', path: '/contacts/new', feature: 'contacts' },
      { label: 'Customer/Supplier List', path: '/contacts', feature: 'contacts' },
      { label: 'Show Receivables/Payables', path: '/contacts/receivables-payables', feature: 'contacts/receivables-payables' },
    ],
  },
  {
    icon: Package, label: 'Product/Services',
    children: [
      { label: 'New Product', path: '/products?new=1', feature: 'products' },
      { label: 'Product List', path: '/products', feature: 'products' },
    ],
  },
  {
    icon: BarChart3, label: 'Reports',
    children: [
      { label: 'Sales / Payment Report', path: '/reports/sales-payment', feature: 'reports/sales-payment' },
      { label: 'Product Sales Report', path: '/reports/product-sales', feature: 'reports/product-sales' },
      { label: 'Sales By Clients - Top 5', path: '/reports/top-clients', feature: 'reports/top-clients' },
      { label: 'Sales By Products - Top 5', path: '/reports/top-products', feature: 'reports/top-products' },
      { label: 'Sale Order Report', path: '/reports/sale-orders', feature: 'reports/sale-orders' },
      { label: 'Invoice Aging Sales', path: '/reports/aged-receivables', feature: 'reports/aged-receivables' },
      { label: 'Detailed Sales Report', path: '/reports/sales', feature: 'reports/sales' },
      { label: 'Sales Return Report', path: '/reports/sales-returns', feature: 'reports/sales-returns' },
      { label: 'Product Purchase Report', path: '/reports/product-purchase', feature: 'reports/product-purchase' },
      { label: 'Purchase Report', path: '/reports/purchases', feature: 'reports/purchases' },
      { label: 'Invoice Aging Supplier', path: '/reports/aged-payables', feature: 'reports/aged-payables' },
      { label: 'Purchase Order Report', path: '/reports/purchase-orders', feature: 'reports/purchase-orders' },
      { label: 'Detailed Purchase Report', path: '/reports/purchases-detailed', feature: 'reports/purchases-detailed' },
      { label: 'Purchase Return Report', path: '/reports/purchase-returns', feature: 'reports/purchase-returns' },
      { label: 'P&L - Periodic (COGS)', path: '/reports/pl-cogs-period', feature: 'reports/pl-cogs-period' },
      { label: 'P&L - Periodic (Stock)', path: '/reports/pl-stock-period', feature: 'reports/pl-stock-period' },
      { label: 'P&L Using COGS', path: '/reports/profit-loss', feature: 'reports/profit-loss' },
      { label: 'P&L Using Opening/Closing Stock', path: '/reports/pl-stock', feature: 'reports/pl-stock' },
      { label: 'Product wise Profit/Loss', path: '/reports/pl-product', feature: 'reports/pl-product' },
      { label: 'Invoice wise Profit/Loss', path: '/reports/pl-invoice', feature: 'reports/pl-invoice' },
      { label: 'Client wise Profit/Loss', path: '/reports/pl-client', feature: 'reports/pl-client' },
      { label: 'Balance Sheet', path: '/reports/balance-sheet', feature: 'reports/balance-sheet' },
      { label: 'Trial Balance', path: '/reports/trial-balance', feature: 'reports/trial-balance' },
      { label: 'Trial Balance Comparative', path: '/reports/trial-balance-comparative', feature: 'reports/trial-balance-comparative' },
      { label: 'Expense Report', path: '/reports/expense', feature: 'reports/expense' },
      { label: 'Detailed Expense Report', path: '/reports/expense-detailed', feature: 'reports/expense-detailed' },
      { label: 'Inventory Report', path: '/reports/inventory', feature: 'reports/inventory' },
      { label: 'Day Book Report', path: '/reports/day-book', feature: 'reports/day-book' },
      { label: 'Cash Flow Statement', path: '/reports/cashflow', feature: 'reports/cashflow' },
      { label: 'Cash Flow (Indirect)', path: '/reports/cashflow-indirect', feature: 'reports/cashflow-indirect' },
      { label: 'Tax Report', path: '/reports/tax', feature: 'reports/tax' },
      { label: 'General Ledger', path: '/reports/general-ledger', feature: 'reports/general-ledger' },
      { label: 'Customer Statement', path: '/reports/customer-statement', feature: 'reports/customer-statement' },
      { label: 'Supplier Statement', path: '/reports/supplier-statement', feature: 'reports/supplier-statement' },
      { label: 'Inventory Valuation', path: '/reports/inventory-valuation', feature: 'reports/inventory-valuation' },
    ],
  },
  {
    icon: Store, label: 'POS',
    children: [
      { label: 'Kasir', path: '/pos', feature: 'pos' },
      { label: 'Riwayat Transaksi', path: '/pos/transactions', feature: 'pos/transactions' },
      { label: 'Open Table', path: '/pos/open-tables', feature: 'pos/open-tables' },
      { label: 'Deposit / DP', path: '/pos/deposits', feature: 'pos/deposits' },
      { label: 'Promosi', path: '/pos/promotions', feature: 'pos/promotions' },
      { label: 'Laporan POS', path: '/pos/reports', feature: 'pos/reports' },
      { label: 'Penutupan Kas', path: '/pos/cash-closing', feature: 'pos/cash-closing' },
      { label: 'Metode Pembayaran', path: '/pos/settings', feature: 'pos/settings' },
      { label: 'Tax & Services', path: '/pos/tax-settings', feature: 'pos/tax-settings' },
      { label: 'Pengaturan Struk', path: '/pos/receipt-settings', feature: 'pos/receipt-settings' },
    ],
  },
  {
    icon: Package, label: 'Inventory',
    children: [
      { label: 'Materials (Purchase)', path: '/inventory/materials', feature: 'inventory/materials' },
      { label: 'Recipe / BOM', path: '/inventory/recipes', feature: 'inventory/recipes' },
      { label: 'Stock per Warehouse', path: '/inventory/stock', feature: 'inventory/stock' },
      { label: 'Kartu Stok', path: '/inventory/stock-card', feature: 'inventory/stock-card' },
      { label: 'Transfers', path: '/inventory/transfers', feature: 'inventory/transfers' },
      { label: 'Stock Opname', path: '/inventory/opname', feature: 'inventory/opname' },
    ],
  },
  { icon: Warehouse, label: 'Warehouses', path: '/inventory/warehouses', feature: 'inventory/warehouses' },
  { icon: Landmark, label: 'Fixed Assets', path: '/assets', feature: 'assets' },
  { icon: Factory, label: 'Production Order', path: '/manufacturing/production', feature: 'manufacturing/production' },
  { icon: Banknote, label: 'Bank Reconciliation', path: '/banking/reconciliation', feature: 'banking/reconciliation' },
  { icon: Building2, label: 'Executive Dashboard', path: '/executive-dashboard', feature: 'executive-dashboard' },
  {
    icon: Lock, label: 'Accounting',
    children: [
      { label: 'Tutup Buku', path: '/accounting/period-closing', feature: 'accounting/period-closing' },
      { label: 'Tag Transaksi', path: '/accounting/tags', feature: 'accounting/tags' },
    ],
  },
  {
    icon: Settings, label: 'Settings',
    children: [
      { label: 'User Profile', path: '/settings/profile', feature: 'settings/profile' },
      { label: 'Discount and Taxes', path: '/settings/discount-tax', feature: 'settings/discount-tax' },
      { label: 'Terms and Conditions', path: '/settings/terms', feature: 'settings/terms' },
      { label: 'Invoice Theme', path: '/settings/invoice-theme', feature: 'settings/invoice-theme' },
      { label: 'Printer Settings', path: '/pos/printer-settings', feature: 'pos/printer-settings' },
      { label: 'Balance Sheet Setting', path: '/settings/balance-sheet', feature: 'settings/balance-sheet' },
      { label: 'Customize Dashboard', path: '/settings/dashboard', feature: 'settings/dashboard' },
      { label: 'Enable / Disable Feature', path: '/settings/features', feature: 'settings/features' },
      { label: 'Show/Hide Fields', path: '/settings/fields', feature: 'settings/fields' },
      { label: 'Inventory Setting', path: '/settings/inventory', feature: 'settings/inventory' },
      { label: 'Payment Tracking', path: '/settings/payment-tracking', feature: 'settings/payment-tracking' },
      { label: 'Banking Details & PayPal.Me', path: '/settings/banking', feature: 'settings/banking' },
      { label: 'Manage Fields in Documents', path: '/settings/document-fields', feature: 'settings/document-fields' },
      { label: 'Users', path: '/settings/users', feature: 'settings/users' },
      { label: 'Companies', path: '/settings/companies', feature: 'settings/companies' },
      { label: 'Permissions', path: '/settings/permissions', feature: 'settings/permissions' },
      { label: 'Log Activity', path: '/settings/activity-log', feature: 'settings/activity-log' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { signOut, profile, isAdmin, isCashier } = useAuth();
  const { selectedCompany } = useCompany();
  const { can, bypass, loading: permsLoading } = usePermissions();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Sale', 'Purchase', 'Payment & Cash/Bank', 'Reports']);

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (path?: string, children?: { path: string }[]) => {
    if (path) {
      return location.pathname === path;
    }
    if (children) {
      return children.some(child => location.pathname === child.path);
    }
    return false;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 gradient-sidebar flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src={sinergiLogo} 
            alt="SINERGI ERP" 
            className="h-10 w-auto"
          />
          <div>
            <h1 className="font-heading font-bold text-lg text-sidebar-foreground">SINERGI</h1>
            <p className="text-xs text-sidebar-muted">ERP System</p>
          </div>
        </div>
      </div>

      {/* Company Selector */}
      {selectedCompany && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <NavLink 
            to="/select-company"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-fast"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {selectedCompany.code.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {selectedCompany.name}
              </p>
              <p className="text-xs text-sidebar-muted">{selectedCompany.code}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-sidebar-muted" />
          </NavLink>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
        <ul className="space-y-1">
          {menuItems
            .filter((item) => {
              // Cashier can only see POS menu
              if (isCashier) {
                return item.label === 'POS';
              }
              // Hide Settings menu for non-admin users
              if (item.label === 'Settings' && !isAdmin) {
                return false;
              }
              return true;
            })
            .map((item) => {
              // For cashier, filter POS children to only show Kasir, Riwayat Transaksi, and Pengaturan Printer
              if (isCashier && item.label === 'POS' && item.children) {
                return {
                  ...item,
                  children: item.children.filter(child => 
                    child.path === '/pos' || 
                    child.path === '/pos/transactions' || 
                    child.path === '/pos/printer-settings'
                  )
                };
              }
              return item;
            })
            .map((item) => {
              // RBAC filter: keep children user can access
              if (bypass || permsLoading) return item;
              if (item.children) {
                const filtered = item.children.filter(c => !c.feature || can(c.feature, 'view'));
                return { ...item, children: filtered };
              }
              return item;
            })
            .filter((item) => {
              if (bypass || permsLoading) return true;
              if (item.path) return !item.feature || can(item.feature, 'view');
              return (item.children?.length ?? 0) > 0;
            })
            .map((item) => (
            <li key={item.label}>
              {item.path ? (
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(
                    'sidebar-item',
                    isActive && 'active'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{item.label}</span>
                </NavLink>
              ) : (
                <>
                  <button
                    onClick={() => toggleExpanded(item.label)}
                    className={cn(
                      'sidebar-item w-full',
                      isActive(undefined, item.children) && 'text-sidebar-foreground'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-xs font-medium flex-1 text-left">{item.label}</span>
                    {expandedItems.includes(item.label) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {expandedItems.includes(item.label) && item.children && (
                    <ul className="mt-1 ml-4 pl-4 border-l border-sidebar-border space-y-1">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <NavLink
                            to={child.path}
                            className={({ isActive }) => cn(
                              'sidebar-item text-xs',
                              isActive && 'active'
                            )}
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <NavLink 
          to="/settings/profile"
          className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-fast"
        >
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-semibold text-sidebar-foreground">
              {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-sidebar-muted truncate">
              {isAdmin ? 'Administrator' : isCashier ? 'Kasir' : 'User'}
            </p>
          </div>
        </NavLink>
        <button
          onClick={signOut}
          className="sidebar-item w-full text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};