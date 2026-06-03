import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Auth from "./pages/Auth";
import SelectCompany from "./pages/SelectCompany";
import Dashboard from "./pages/Dashboard";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import CashBank from "./pages/CashBank";
import Cashflow from "./pages/cashbank/Cashflow";
import Products from "./pages/Products";
import Customers from "./pages/sales/Customers";
import SalesOrders from "./pages/sales/SalesOrders";
import Invoices from "./pages/sales/Invoices";
import SalesPayments from "./pages/sales/Payments";
import SalesDashboard from "./pages/sales/SalesDashboard";
import Suppliers from "./pages/purchases/Suppliers";
import PurchaseOrders from "./pages/purchases/PurchaseOrders";
import GoodsReceipt from "./pages/purchases/GoodsReceipt";
import Bills from "./pages/purchases/Bills";
import PurchasePayments from "./pages/purchases/Payments";
import PurchasesDashboard from "./pages/purchases/PurchasesDashboard";
import InventoryDashboard from "./pages/inventory/InventoryDashboard";
import Materials from "./pages/inventory/Materials";
import Recipes from "./pages/inventory/Recipes";
import Warehouses from "./pages/inventory/Warehouses";
import InventoryStock from "./pages/inventory/InventoryStock";
import StockTransfers from "./pages/inventory/StockTransfers";
import StockOpname from "./pages/inventory/StockOpname";
import JournalEntries from "./pages/JournalEntries";
import ProfitLoss from "./pages/reports/ProfitLoss";
import BalanceSheet from "./pages/reports/BalanceSheet";
import GeneralLedger from "./pages/reports/GeneralLedger";
import TrialBalance from "./pages/reports/TrialBalance";
import AgedReceivables from "./pages/reports/AgedReceivables";
import AgedPayables from "./pages/reports/AgedPayables";
import CashflowReport from "./pages/reports/CashflowReport";
import SalesReport from "./pages/reports/SalesReport";
import PurchaseReport from "./pages/reports/PurchaseReport";
import InventoryReport from "./pages/reports/InventoryReport";
import Users from "./pages/settings/Users";
import Companies from "./pages/settings/Companies";
import Profile from "./pages/settings/Profile";
import Permissions from "./pages/settings/Permissions";
import PeriodClosing from "./pages/accounting/PeriodClosing";
import TransactionTags from "./pages/accounting/TransactionTags";
import ActivityLog from "./pages/accounting/ActivityLog";
import POSDashboard from "./pages/pos/POSDashboard";
import POSTransactions from "./pages/pos/POSTransactions";
import POSSettings from "./pages/pos/POSSettings";
import POSCashClosing from "./pages/pos/POSCashClosing";
import POSReports from "./pages/pos/POSReports";
import ReceiptSettings from "./pages/pos/ReceiptSettings";
import TaxSettings from "./pages/pos/TaxSettings";
import OpenTables from "./pages/pos/OpenTables";
import Deposits from "./pages/pos/Deposits";
import Promotions from "./pages/pos/Promotions";
import PrinterSettings from "./pages/pos/PrinterSettings";
import FixedAssets from "./pages/assets/FixedAssets";
import TaxReport from "./pages/reports/TaxReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/select-company" element={<SelectCompany />} />
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/accounts" element={<ChartOfAccounts />} />
                <Route path="/cash-bank" element={<CashBank />} />
                <Route path="/cash-bank/cashflow" element={<Cashflow />} />
                <Route path="/products" element={<Products />} />
                {/* Sales Routes */}
                <Route path="/sales/dashboard" element={<SalesDashboard />} />
                <Route path="/sales/customers" element={<Customers />} />
                <Route path="/sales/orders" element={<SalesOrders />} />
                <Route path="/sales/invoices" element={<Invoices />} />
                <Route path="/sales/payments" element={<SalesPayments />} />
                {/* Purchases Routes */}
                <Route path="/purchases/dashboard" element={<PurchasesDashboard />} />
                <Route path="/purchases/suppliers" element={<Suppliers />} />
                <Route path="/purchases/orders" element={<PurchaseOrders />} />
                <Route path="/purchases/receipts" element={<GoodsReceipt />} />
                <Route path="/purchases/bills" element={<Bills />} />
                <Route path="/purchases/payments" element={<PurchasePayments />} />
                {/* Inventory Routes */}
                <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
                <Route path="/inventory/materials" element={<Materials />} />
                <Route path="/inventory/warehouses" element={<Warehouses />} />
                <Route path="/inventory/stock" element={<InventoryStock />} />
                <Route path="/inventory/transfers" element={<StockTransfers />} />
                <Route path="/inventory/opname" element={<StockOpname />} />
                <Route path="/inventory/recipes" element={<Recipes />} />
                {/* POS Routes */}
                <Route path="/pos" element={<POSDashboard />} />
                <Route path="/pos/transactions" element={<POSTransactions />} />
                <Route path="/pos/open-tables" element={<OpenTables />} />
                <Route path="/pos/deposits" element={<Deposits />} />
                <Route path="/pos/promotions" element={<Promotions />} />
                <Route path="/pos/settings" element={<POSSettings />} />
                <Route path="/pos/cash-closing" element={<POSCashClosing />} />
                <Route path="/pos/reports" element={<POSReports />} />
                <Route path="/pos/receipt-settings" element={<ReceiptSettings />} />
                <Route path="/pos/tax-settings" element={<TaxSettings />} />
                <Route path="/pos/printer-settings" element={<PrinterSettings />} />
                {/* Fixed Assets */}
                <Route path="/assets" element={<FixedAssets />} />
                {/* Journal & Reports */}
                <Route path="/journal" element={<JournalEntries />} />
                {/* Accounting */}
                <Route path="/accounting/period-closing" element={<PeriodClosing />} />
                <Route path="/accounting/tags" element={<TransactionTags />} />
                <Route path="/accounting/activity-log" element={<ActivityLog />} />
                <Route path="/reports/profit-loss" element={<ProfitLoss />} />
                <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
                <Route path="/reports/general-ledger" element={<GeneralLedger />} />
                <Route path="/reports/trial-balance" element={<TrialBalance />} />
                <Route path="/reports/aged-receivables" element={<AgedReceivables />} />
                <Route path="/reports/aged-payables" element={<AgedPayables />} />
                <Route path="/reports/cashflow" element={<CashflowReport />} />
                <Route path="/reports/sales" element={<SalesReport />} />
                <Route path="/reports/purchases" element={<PurchaseReport />} />
                <Route path="/reports/inventory" element={<InventoryReport />} />
                <Route path="/reports/tax" element={<TaxReport />} />
                {/* Settings */}
                <Route path="/settings/users" element={<Users />} />
                <Route path="/settings/companies" element={<Companies />} />
                <Route path="/settings/profile" element={<Profile />} />
                <Route path="/settings/permissions" element={<Permissions />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CompanyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;