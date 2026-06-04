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
  ArrowLeftRight,
  ClipboardCheck,
  Boxes,
  Lock,
  Tag,
  Store,
  Landmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import sinergiLogo from '@/assets/sinergi-logo.png';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  children?: { label: string; path: string }[];
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: BookOpen, label: 'Chart of Accounts', path: '/accounts' },
  { 
    icon: CreditCard, 
    label: 'Cash & Bank',
    children: [
      { label: 'Overview', path: '/cash-bank' },
      { label: 'Cashflow', path: '/cash-bank/cashflow' },
      { label: 'Cashflow Report', path: '/reports/cashflow' },
    ]
  },
  { 
    icon: Store, 
    label: 'POS',
    children: [
      { label: 'Kasir', path: '/pos' },
      { label: 'Riwayat Transaksi', path: '/pos/transactions' },
      { label: 'Open Table', path: '/pos/open-tables' },
      { label: 'Deposit / DP', path: '/pos/deposits' },
      { label: 'Promosi', path: '/pos/promotions' },
      { label: 'Laporan POS', path: '/pos/reports' },
      { label: 'Penutupan Kas', path: '/pos/cash-closing' },
      { label: 'Metode Pembayaran', path: '/pos/settings' },
      { label: 'Tax & Services', path: '/pos/tax-settings' },
      { label: 'Pengaturan Struk', path: '/pos/receipt-settings' },
      { label: 'Pengaturan Printer', path: '/pos/printer-settings' },
    ]
  },
  { 
    icon: Package, 
    label: 'Inventory',
    children: [
      { label: 'Products (Sales)', path: '/products' },
      { label: 'Materials (Purchase)', path: '/inventory/materials' },
      { label: 'Recipe / BOM', path: '/inventory/recipes' },
      { label: 'Stock per Warehouse', path: '/inventory/stock' },
      { label: 'Transfers', path: '/inventory/transfers' },
      { label: 'Stock Opname', path: '/inventory/opname' },
      { label: 'Inventory Report', path: '/reports/inventory' },
    ]
  },
  { 
    icon: ShoppingCart, 
    label: 'Sales',
    children: [
      { label: 'Dashboard', path: '/sales/dashboard' },
      { label: 'Customers', path: '/sales/customers' },
      { label: 'Sales Orders', path: '/sales/orders' },
      { label: 'Invoices', path: '/sales/invoices' },
      { label: 'Payments', path: '/sales/payments' },
      { label: 'Sales Report', path: '/reports/sales' },
    ]
  },
  { 
    icon: Truck, 
    label: 'Purchases',
    children: [
      { label: 'Dashboard', path: '/purchases/dashboard' },
      { label: 'Suppliers', path: '/purchases/suppliers' },
      { label: 'Purchase Orders', path: '/purchases/orders' },
      { label: 'Goods Receipt', path: '/purchases/receipts' },
      { label: 'Bills', path: '/purchases/bills' },
      { label: 'Payments', path: '/purchases/payments' },
      { label: 'Purchase Report', path: '/reports/purchases' },
    ]
  },
  { icon: Landmark, label: 'Aset Tetap', path: '/assets' },
  { icon: Warehouse, label: 'Warehouses', path: '/inventory/warehouses' },
  { icon: FileText, label: 'Journal Entries', path: '/journal' },
  { 
    icon: Lock, 
    label: 'Accounting',
    children: [
      { label: 'Tutup Buku', path: '/accounting/period-closing' },
      { label: 'Tag Transaksi', path: '/accounting/tags' },
    ]
  },
  {
    icon: BarChart3, 
    label: 'Financial Reports',
    children: [
      { label: 'Profit & Loss', path: '/reports/profit-loss' },
      { label: 'Balance Sheet', path: '/reports/balance-sheet' },
      { label: 'Trial Balance', path: '/reports/trial-balance' },
      { label: 'General Ledger', path: '/reports/general-ledger' },
      { label: 'Aged Receivables', path: '/reports/aged-receivables' },
      { label: 'Aged Payables', path: '/reports/aged-payables' },
      { label: 'Rekap Pajak (PPN)', path: '/reports/tax' },
    ]
  },
  { 
    icon: Settings, 
    label: 'Settings',
    children: [
      { label: 'Users', path: '/settings/users' },
      { label: 'Companies', path: '/settings/companies' },
      { label: 'Log Activity', path: '/settings/activity-log' },
    ]
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { signOut, profile, isAdmin, isCashier } = useAuth();
  const { selectedCompany } = useCompany();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Sales', 'Purchases', 'Inventory', 'Financial Reports', 'POS']);

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