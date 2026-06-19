import React from "react";
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
import StockCard from "./pages/inventory/StockCard";
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
import InventoryValuation from "./pages/reports/InventoryValuation";
import CustomerStatement from "./pages/reports/CustomerStatement";
import SupplierStatement from "./pages/reports/SupplierStatement";
import TrialBalanceComparative from "./pages/reports/TrialBalanceComparative";
import CashflowIndirect from "./pages/reports/CashflowIndirect";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import BankReconciliation from "./pages/banking/BankReconciliation";
import ProductionOrders from "./pages/manufacturing/ProductionOrders";
import Users from "./pages/settings/Users";
import Companies from "./pages/settings/Companies";
import Profile from "./pages/settings/Profile";
import PeriodClosing from "./pages/accounting/PeriodClosing";
import TransactionTags from "./pages/accounting/TransactionTags";
import ActivityLog from "./pages/settings/ActivityLog";
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
import Permissions from "./pages/settings/Permissions";
import { RequireFeature } from "@/components/RequireFeature";
import ComingSoon from "./pages/ComingSoon";
import Expenses from "./pages/expenses/Expenses";
import CashBankTransfers from "./pages/cashbank/CashBankTransfers";
import FixPaymentMapping from "./pages/cashbank/FixPaymentMapping";
import PurchaseReturns from "./pages/purchases/PurchaseReturns";

const Guard = ({ f, children }: { f: string; children: React.ReactNode }) => (
  <RequireFeature feature={f}>{children}</RequireFeature>
);

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
                <Route path="/dashboard" element={<Guard f="dashboard"><Dashboard /></Guard>} />
                <Route path="/accounts" element={<Guard f="accounts"><ChartOfAccounts /></Guard>} />
                <Route path="/cash-bank" element={<Guard f="cash-bank"><CashBank /></Guard>} />
                <Route path="/cash-bank/cashflow" element={<Guard f="cash-bank/cashflow"><Cashflow /></Guard>} />
                <Route path="/products" element={<Guard f="products"><Products /></Guard>} />
                <Route path="/sales/dashboard" element={<Guard f="sales/dashboard"><SalesDashboard /></Guard>} />
                <Route path="/sales/customers" element={<Guard f="sales/customers"><Customers /></Guard>} />
                <Route path="/sales/orders" element={<Guard f="sales/orders"><SalesOrders /></Guard>} />
                <Route path="/sales/invoices" element={<Guard f="sales/invoices"><Invoices /></Guard>} />
                <Route path="/sales/payments" element={<Guard f="sales/payments"><SalesPayments /></Guard>} />
                <Route path="/purchases/dashboard" element={<Guard f="purchases/dashboard"><PurchasesDashboard /></Guard>} />
                <Route path="/purchases/suppliers" element={<Guard f="purchases/suppliers"><Suppliers /></Guard>} />
                <Route path="/purchases/orders" element={<Guard f="purchases/orders"><PurchaseOrders /></Guard>} />
                <Route path="/purchases/receipts" element={<Guard f="purchases/receipts"><GoodsReceipt /></Guard>} />
                <Route path="/purchases/bills" element={<Guard f="purchases/bills"><Bills /></Guard>} />
                <Route path="/purchases/payments" element={<Guard f="purchases/payments"><PurchasePayments /></Guard>} />
                <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
                <Route path="/inventory/materials" element={<Guard f="inventory/materials"><Materials /></Guard>} />
                <Route path="/inventory/warehouses" element={<Guard f="inventory/warehouses"><Warehouses /></Guard>} />
                <Route path="/inventory/stock" element={<Guard f="inventory/stock"><InventoryStock /></Guard>} />
                <Route path="/inventory/transfers" element={<Guard f="inventory/transfers"><StockTransfers /></Guard>} />
                <Route path="/inventory/stock-card" element={<Guard f="inventory/stock-card"><StockCard /></Guard>} />
                <Route path="/inventory/opname" element={<Guard f="inventory/opname"><StockOpname /></Guard>} />
                <Route path="/inventory/recipes" element={<Guard f="inventory/recipes"><Recipes /></Guard>} />
                <Route path="/pos" element={<Guard f="pos"><POSDashboard /></Guard>} />
                <Route path="/pos/transactions" element={<Guard f="pos/transactions"><POSTransactions /></Guard>} />
                <Route path="/pos/open-tables" element={<Guard f="pos/open-tables"><OpenTables /></Guard>} />
                <Route path="/pos/deposits" element={<Guard f="pos/deposits"><Deposits /></Guard>} />
                <Route path="/pos/promotions" element={<Guard f="pos/promotions"><Promotions /></Guard>} />
                <Route path="/pos/settings" element={<Guard f="pos/settings"><POSSettings /></Guard>} />
                <Route path="/pos/cash-closing" element={<Guard f="pos/cash-closing"><POSCashClosing /></Guard>} />
                <Route path="/pos/reports" element={<Guard f="pos/reports"><POSReports /></Guard>} />
                <Route path="/pos/receipt-settings" element={<Guard f="pos/receipt-settings"><ReceiptSettings /></Guard>} />
                <Route path="/pos/tax-settings" element={<Guard f="pos/tax-settings"><TaxSettings /></Guard>} />
                <Route path="/pos/printer-settings" element={<Guard f="pos/printer-settings"><PrinterSettings /></Guard>} />
                <Route path="/assets" element={<Guard f="assets"><FixedAssets /></Guard>} />
                <Route path="/journal" element={<Guard f="journal"><JournalEntries /></Guard>} />
                <Route path="/accounting/period-closing" element={<Guard f="accounting/period-closing"><PeriodClosing /></Guard>} />
                <Route path="/accounting/tags" element={<Guard f="accounting/tags"><TransactionTags /></Guard>} />
                <Route path="/settings/activity-log" element={<Guard f="settings/activity-log"><ActivityLog /></Guard>} />
                <Route path="/accounting/activity-log" element={<Guard f="settings/activity-log"><ActivityLog /></Guard>} />
                <Route path="/reports/profit-loss" element={<Guard f="reports/profit-loss"><ProfitLoss /></Guard>} />
                <Route path="/reports/balance-sheet" element={<Guard f="reports/balance-sheet"><BalanceSheet /></Guard>} />
                <Route path="/reports/general-ledger" element={<Guard f="reports/general-ledger"><GeneralLedger /></Guard>} />
                <Route path="/reports/trial-balance" element={<Guard f="reports/trial-balance"><TrialBalance /></Guard>} />
                <Route path="/reports/aged-receivables" element={<Guard f="reports/aged-receivables"><AgedReceivables /></Guard>} />
                <Route path="/reports/aged-payables" element={<Guard f="reports/aged-payables"><AgedPayables /></Guard>} />
                <Route path="/reports/cashflow" element={<Guard f="reports/cashflow"><CashflowReport /></Guard>} />
                <Route path="/reports/sales" element={<Guard f="reports/sales"><SalesReport /></Guard>} />
                <Route path="/reports/purchases" element={<Guard f="reports/purchases"><PurchaseReport /></Guard>} />
                <Route path="/reports/inventory" element={<Guard f="reports/inventory"><InventoryReport /></Guard>} />
                <Route path="/reports/inventory-valuation" element={<Guard f="reports/inventory-valuation"><InventoryValuation /></Guard>} />
                <Route path="/reports/customer-statement" element={<Guard f="reports/customer-statement"><CustomerStatement /></Guard>} />
                <Route path="/reports/supplier-statement" element={<Guard f="reports/supplier-statement"><SupplierStatement /></Guard>} />
                <Route path="/reports/trial-balance-comparative" element={<Guard f="reports/trial-balance-comparative"><TrialBalanceComparative /></Guard>} />
                <Route path="/reports/cashflow-indirect" element={<Guard f="reports/cashflow-indirect"><CashflowIndirect /></Guard>} />
                <Route path="/executive-dashboard" element={<Guard f="executive-dashboard"><ExecutiveDashboard /></Guard>} />
                <Route path="/banking/reconciliation" element={<Guard f="banking/reconciliation"><BankReconciliation /></Guard>} />
                <Route path="/manufacturing/production" element={<Guard f="manufacturing/production"><ProductionOrders /></Guard>} />
                <Route path="/reports/tax" element={<Guard f="reports/tax"><TaxReport /></Guard>} />
                <Route path="/settings/users" element={<Users />} />
                <Route path="/settings/companies" element={<Companies />} />
                <Route path="/settings/permissions" element={<Permissions />} />
                <Route path="/settings/profile" element={<Profile />} />
                {/* Sale group */}
                <Route path="/sales/estimates" element={<Guard f="sales/estimates"><ComingSoon title="Estimate List" /></Guard>} />
                <Route path="/sales/estimates/new" element={<Guard f="sales/estimates"><ComingSoon title="Create New Estimate" /></Guard>} />
                <Route path="/sales/returns" element={<Guard f="sales/returns"><ComingSoon title="Sale Return" /></Guard>} />
                {/* Purchase group */}
                <Route path="/purchases/returns" element={<Guard f="purchases/returns"><PurchaseReturns /></Guard>} />
                {/* Expense */}
                <Route path="/expenses" element={<Guard f="expenses"><Expenses /></Guard>} />
                <Route path="/expenses/new" element={<Guard f="expenses"><Expenses /></Guard>} />
                {/* Cash/Bank extras */}
                <Route path="/cash-bank/transfers" element={<Guard f="cash-bank/transfers"><CashBankTransfers /></Guard>} />
                <Route path="/cash-bank/transfers/new" element={<Guard f="cash-bank/transfers"><CashBankTransfers /></Guard>} />
                <Route path="/cash-bank/fix-mapping" element={<Guard f="cash-bank/fix-mapping"><FixPaymentMapping /></Guard>} />
                {/* Receipt */}
                <Route path="/receipts" element={<Guard f="receipts"><ComingSoon title="Receipts" /></Guard>} />
                {/* Capital */}
                <Route path="/capital" element={<Guard f="capital"><ComingSoon title="Capital Transaction List" /></Guard>} />
                <Route path="/capital/new" element={<Guard f="capital"><ComingSoon title="New Capital Transaction" /></Guard>} />
                {/* Accounts extras */}
                <Route path="/accounts/opening-balance" element={<Guard f="accounts/opening-balance"><ComingSoon title="Manage Opening Balance" /></Guard>} />
                {/* Contacts */}
                <Route path="/contacts" element={<Guard f="contacts"><ComingSoon title="Customer/Supplier List" /></Guard>} />
                <Route path="/contacts/new" element={<Guard f="contacts"><ComingSoon title="New Customer/Supplier" /></Guard>} />
                <Route path="/contacts/receivables-payables" element={<Guard f="contacts/receivables-payables"><ComingSoon title="Receivables & Payables" /></Guard>} />
                {/* Reports - new */}
                <Route path="/reports/sales-payment" element={<Guard f="reports/sales-payment"><ComingSoon title="Sales / Payment Report" /></Guard>} />
                <Route path="/reports/product-sales" element={<Guard f="reports/product-sales"><ComingSoon title="Product Sales Report" /></Guard>} />
                <Route path="/reports/top-clients" element={<Guard f="reports/top-clients"><ComingSoon title="Sales By Clients - Top 5" /></Guard>} />
                <Route path="/reports/top-products" element={<Guard f="reports/top-products"><ComingSoon title="Sales By Products - Top 5" /></Guard>} />
                <Route path="/reports/sale-orders" element={<Guard f="reports/sale-orders"><ComingSoon title="Sale Order Report" /></Guard>} />
                <Route path="/reports/sales-returns" element={<Guard f="reports/sales-returns"><ComingSoon title="Sales Return Report" /></Guard>} />
                <Route path="/reports/product-purchase" element={<Guard f="reports/product-purchase"><ComingSoon title="Product Purchase Report" /></Guard>} />
                <Route path="/reports/purchase-orders" element={<Guard f="reports/purchase-orders"><ComingSoon title="Purchase Order Report" /></Guard>} />
                <Route path="/reports/purchases-detailed" element={<Guard f="reports/purchases-detailed"><ComingSoon title="Detailed Purchase Report" /></Guard>} />
                <Route path="/reports/purchase-returns" element={<Guard f="reports/purchase-returns"><ComingSoon title="Purchase Return Report" /></Guard>} />
                <Route path="/reports/pl-cogs-period" element={<Guard f="reports/pl-cogs-period"><ComingSoon title="P&L Periodic (COGS)" /></Guard>} />
                <Route path="/reports/pl-stock-period" element={<Guard f="reports/pl-stock-period"><ComingSoon title="P&L Periodic (Stock)" /></Guard>} />
                <Route path="/reports/pl-stock" element={<Guard f="reports/pl-stock"><ComingSoon title="P&L Using Opening/Closing Stock" /></Guard>} />
                <Route path="/reports/pl-product" element={<Guard f="reports/pl-product"><ComingSoon title="Product wise Profit/Loss" /></Guard>} />
                <Route path="/reports/pl-invoice" element={<Guard f="reports/pl-invoice"><ComingSoon title="Invoice wise Profit/Loss" /></Guard>} />
                <Route path="/reports/pl-client" element={<Guard f="reports/pl-client"><ComingSoon title="Client wise Profit/Loss" /></Guard>} />
                <Route path="/reports/expense" element={<Guard f="reports/expense"><ComingSoon title="Expense Report" /></Guard>} />
                <Route path="/reports/expense-detailed" element={<Guard f="reports/expense-detailed"><ComingSoon title="Detailed Expense Report" /></Guard>} />
                <Route path="/reports/day-book" element={<Guard f="reports/day-book"><ComingSoon title="Day Book Report" /></Guard>} />
                {/* Settings - new */}
                <Route path="/settings/discount-tax" element={<ComingSoon title="Discount and Taxes" />} />
                <Route path="/settings/terms" element={<ComingSoon title="Terms and Conditions" />} />
                <Route path="/settings/invoice-theme" element={<ComingSoon title="Invoice Theme" />} />
                <Route path="/settings/balance-sheet" element={<ComingSoon title="Balance Sheet Setting" />} />
                <Route path="/settings/dashboard" element={<ComingSoon title="Customize Dashboard" />} />
                <Route path="/settings/features" element={<ComingSoon title="Enable / Disable Feature" />} />
                <Route path="/settings/fields" element={<ComingSoon title="Show/Hide Fields" />} />
                <Route path="/settings/inventory" element={<ComingSoon title="Inventory Setting" />} />
                <Route path="/settings/payment-tracking" element={<ComingSoon title="Payment Tracking" />} />
                <Route path="/settings/banking" element={<ComingSoon title="Banking Details & PayPal.Me" />} />
                <Route path="/settings/document-fields" element={<ComingSoon title="Manage Fields in Documents" />} />
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