import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Search, Eye, Printer, FileSpreadsheet, FileText, ChevronDown, ChefHat, Receipt, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface POSTransaction {
  id: string;
  transaction_number: string;
  invoice_number: string | null;
  transaction_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  total_cogs: number;
  customer_name: string | null;
  customer_phone: string | null;
  amount_paid: number;
  change_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  products?: { name: string; sku: string; category_id?: string };
}

interface TransactionPayment {
  id: string;
  amount: number;
  pos_payment_methods?: { name: string };
}

interface ReceiptSetting {
  id: string;
  receipt_type: string;
  name: string;
  logo_url: string | null;
  header_text: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_customer_info: boolean;
  show_item_details: boolean;
  show_payment_info: boolean;
  paper_size: string;
  is_active: boolean;
}

interface ReceiptSplitRule {
  id: string;
  receipt_setting_id: string;
  category_id: string | null;
}

const POSTransactions = () => {
  const { selectedCompany } = useCompany();
  const { roles } = useAuth();
  const canEditDelete = roles.includes('admin') || roles.includes('user');
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<POSTransaction | null>(null);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [transactionPayments, setTransactionPayments] = useState<TransactionPayment[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSetting[]>([]);
  const [splitRules, setSplitRules] = useState<ReceiptSplitRule[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  
  // Edit/Delete state
  const [editTransaction, setEditTransaction] = useState<POSTransaction | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [deleteTransaction, setDeleteTransaction] = useState<POSTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fetchTransactions = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    let query = supabase
      .from('pos_transactions')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (dateFrom) {
      query = query.gte('transaction_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('transaction_date', dateTo);
    }

    const { data, error } = await query;

    if (!error) {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const fetchReceiptSettings = async () => {
    if (!selectedCompany) return;

    const [settingsRes, rulesRes] = await Promise.all([
      supabase
        .from('receipt_settings')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true),
      supabase
        .from('receipt_split_rules')
        .select('*')
        .eq('company_id', selectedCompany.id)
    ]);

    setReceiptSettings(settingsRes.data || []);
    setSplitRules(rulesRes.data || []);
  };

  const fetchTransactionDetails = async (transactionId: string) => {
    const [itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from('pos_transaction_items')
        .select('*, products(name, sku, category_id)')
        .eq('pos_transaction_id', transactionId),
      supabase
        .from('pos_transaction_payments')
        .select('*, pos_payment_methods(name)')
        .eq('pos_transaction_id', transactionId)
    ]);

    setTransactionItems(itemsRes.data || []);
    setTransactionPayments(paymentsRes.data || []);
  };

  useEffect(() => {
    fetchTransactions();
    fetchReceiptSettings();
  }, [selectedCompany, dateFrom, dateTo]);

  const handleViewDetails = async (transaction: POSTransaction) => {
    setSelectedTransaction(transaction);
    await fetchTransactionDetails(transaction.id);
  };

  // Get filtered items for kitchen printing based on split rules
  const getFilteredItemsForSetting = (setting: ReceiptSetting, items: TransactionItem[]) => {
    if (setting.receipt_type !== 'kitchen') return items;
    
    const settingRules = splitRules.filter(r => r.receipt_setting_id === setting.id);
    if (settingRules.length === 0) return items;
    
    const categoryIds = settingRules.map(r => r.category_id).filter(Boolean);
    return items.filter(item => categoryIds.includes(item.products?.category_id || null));
  };

  // Generate receipt HTML based on settings
  const generateReceiptHtml = (setting: ReceiptSetting, items: TransactionItem[], transaction: POSTransaction) => {
    const paperWidth = setting.paper_size === '58mm' ? '58mm' : setting.paper_size === '80mm' ? '80mm' : '210mm';
    const fontSize = setting.paper_size === '58mm' ? '10px' : '12px';
    
    const itemSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const itemDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
    const itemTotal = items.reduce((sum, item) => sum + item.total, 0);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${setting.name} - ${transaction.transaction_number}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: ${fontSize}; width: ${paperWidth}; margin: 0 auto; padding: 10px; }
          .center { text-align: center; }
          .right { text-align: right; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; }
          .bold { font-weight: bold; }
          .large { font-size: ${setting.paper_size === '58mm' ? '12px' : '14px'}; }
          .logo { max-height: 50px; max-width: 100px; margin-bottom: 5px; }
          .kitchen-header { background: #000; color: #fff; padding: 5px; margin: -10px -10px 10px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${setting.receipt_type === 'kitchen' ? '<div class="kitchen-header center bold large">ORDER DAPUR</div>' : ''}
        <div class="center">
          ${setting.show_logo && setting.logo_url ? `<img src="${setting.logo_url}" class="logo" alt="Logo" />` : ''}
          ${setting.header_text ? `<div style="white-space: pre-line; margin-top: 5px;">${setting.header_text}</div>` : ''}
        </div>
        <hr>
        <div>No: ${transaction.transaction_number}</div>
        <div>Tgl: ${format(new Date(transaction.transaction_date), 'dd/MM/yyyy HH:mm', { locale: id })}</div>
        ${setting.show_customer_info ? `<div>Pelanggan: ${transaction.customer_name || '-'}</div>` : ''}
        <hr>
        ${setting.show_item_details ? `
          <table>
            ${items.map(item => `
              <tr>
                <td colspan="2"><strong>${item.products?.name}</strong></td>
              </tr>
              <tr>
                <td>${item.quantity} x ${formatCurrency(item.unit_price)}${item.discount_percent > 0 ? ` -${item.discount_percent}%` : ''}</td>
                <td class="right">${formatCurrency(item.total)}</td>
              </tr>
            `).join('')}
          </table>
          <hr>
          <table>
            <tr><td>Subtotal</td><td class="right">${formatCurrency(itemSubtotal)}</td></tr>
            ${itemDiscount > 0 ? `<tr><td>Diskon</td><td class="right">-${formatCurrency(itemDiscount)}</td></tr>` : ''}
            ${(transaction.tax_amount || 0) > 0 && setting.receipt_type !== 'kitchen' ? `<tr><td>Pajak</td><td class="right">${formatCurrency(transaction.tax_amount)}</td></tr>` : ''}
            ${setting.receipt_type !== 'kitchen' ? `<tr class="bold"><td>TOTAL</td><td class="right">${formatCurrency(transaction.total_amount || 0)}</td></tr>` : ''}
          </table>
        ` : `
          <table>
            ${items.map(item => `
              <tr>
                <td><strong>${item.products?.name}</strong></td>
                <td class="right bold">${item.quantity}x</td>
              </tr>
            `).join('')}
          </table>
        `}
        ${setting.show_payment_info && setting.receipt_type !== 'kitchen' ? `
          <hr>
          <table>
            ${transactionPayments.map(p => `
              <tr><td>${(p.pos_payment_methods as any)?.name || 'Unknown'}</td><td class="right">${formatCurrency(p.amount)}</td></tr>
            `).join('')}
            <tr><td>Kembali</td><td class="right">${formatCurrency(transaction.change_amount || 0)}</td></tr>
          </table>
        ` : ''}
        ${setting.footer_text ? `<hr><div class="center" style="white-space: pre-line;">${setting.footer_text}</div>` : ''}
        ${setting.receipt_type !== 'kitchen' ? '<div class="center" style="margin-top: 10px;">Terima kasih</div>' : ''}
      </body>
      </html>
    `;
  };

  const printReceiptByType = async (transaction: POSTransaction, receiptType: 'customer' | 'kitchen') => {
    await fetchTransactionDetails(transaction.id);
    
    const activeSettings = receiptSettings.filter(s => s.receipt_type === receiptType && s.is_active);
    
    if (activeSettings.length === 0) {
      // Fallback to basic print if no settings configured
      printBasicReceipt(transaction, receiptType);
      return;
    }

    for (const setting of activeSettings) {
      const filteredItems = getFilteredItemsForSetting(setting, transactionItems);
      if (filteredItems.length === 0) continue;

      const printWindow = window.open('', '_blank');
      if (!printWindow) continue;

      const receiptHtml = generateReceiptHtml(setting, filteredItems, transaction);
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const printBasicReceipt = (transaction: POSTransaction, type: 'customer' | 'kitchen') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${type === 'kitchen' ? 'Order Dapur' : 'Struk'} ${transaction.transaction_number}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
          .center { text-align: center; }
          .right { text-align: right; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; }
          .bold { font-weight: bold; }
          .kitchen-header { background: #000; color: #fff; padding: 5px; margin: -10px -10px 10px; }
        </style>
      </head>
      <body>
        ${type === 'kitchen' ? '<div class="kitchen-header center bold">ORDER DAPUR</div>' : `<div class="center"><div class="bold">${selectedCompany?.name}</div></div>`}
        <hr>
        <div>No: ${transaction.transaction_number}</div>
        <div>Tgl: ${format(new Date(transaction.transaction_date), 'dd/MM/yyyy HH:mm', { locale: id })}</div>
        ${type === 'customer' ? `<div>Pelanggan: ${transaction.customer_name || '-'}</div>` : ''}
        <hr>
        <table>
          ${transactionItems.map(item => `
            <tr>
              <td colspan="2">${item.products?.name}</td>
            </tr>
            <tr>
              <td>${item.quantity} x ${formatCurrency(item.unit_price)}${item.discount_percent > 0 ? ` -${item.discount_percent}%` : ''}</td>
              <td class="right">${formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
        </table>
        ${type === 'customer' ? `
          <hr>
          <table>
            <tr><td>Subtotal</td><td class="right">${formatCurrency(transaction.subtotal || 0)}</td></tr>
            ${(transaction.discount_amount || 0) > 0 ? `<tr><td>Diskon</td><td class="right">-${formatCurrency(transaction.discount_amount)}</td></tr>` : ''}
            ${(transaction.tax_amount || 0) > 0 ? `<tr><td>Pajak</td><td class="right">${formatCurrency(transaction.tax_amount)}</td></tr>` : ''}
            <tr class="bold"><td>TOTAL</td><td class="right">${formatCurrency(transaction.total_amount || 0)}</td></tr>
          </table>
          <hr>
          <table>
            ${transactionPayments.map(p => `
              <tr><td>${(p.pos_payment_methods as any)?.name || 'Unknown'}</td><td class="right">${formatCurrency(p.amount)}</td></tr>
            `).join('')}
            <tr><td>Kembali</td><td class="right">${formatCurrency(transaction.change_amount || 0)}</td></tr>
          </table>
          <hr>
          <div class="center">Terima kasih</div>
        ` : ''}
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const printAllReceipts = async (transaction: POSTransaction) => {
    await fetchTransactionDetails(transaction.id);
    await printReceiptByType(transaction, 'kitchen');
    setTimeout(() => printReceiptByType(transaction, 'customer'), 500);
  };

  // --- Edit handler ---
  const handleOpenEdit = (transaction: POSTransaction) => {
    setEditTransaction(transaction);
    setEditDate(transaction.transaction_date);
    setEditCustomerName(transaction.customer_name || '');
    setEditCustomerPhone(transaction.customer_phone || '');
    setEditNotes(transaction.notes || '');
    setEditInvoiceNumber(transaction.invoice_number || '');
  };

  const handleSaveEdit = async () => {
    if (!editTransaction || !selectedCompany) return;
    setIsSaving(true);

    // Update pos_transactions
    const { error } = await supabase
      .from('pos_transactions')
      .update({
        transaction_date: editDate,
        customer_name: editCustomerName || null,
        customer_phone: editCustomerPhone || null,
        notes: editNotes || null,
        invoice_number: editInvoiceNumber || null,
      })
      .eq('id', editTransaction.id);

    if (error) {
      toast.error('Gagal menyimpan perubahan');
      setIsSaving(false);
      return;
    }

    // Update related journal entry date
    const { data: journals } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_id', editTransaction.id)
      .eq('reference_type', 'pos_transaction');

    if (journals && journals.length > 0) {
      for (const je of journals) {
        await supabase
          .from('journal_entries')
          .update({ entry_date: editDate, description: `POS ${editTransaction.transaction_number} - ${editCustomerName || 'Walk-in'}` })
          .eq('id', je.id);
      }
    }

    toast.success('Transaksi berhasil diperbarui');
    setEditTransaction(null);
    setIsSaving(false);
    fetchTransactions();
  };

  // --- Delete handler ---
  const handleDeleteTransaction = async () => {
    if (!deleteTransaction) return;
    setIsDeleting(true);

    // 1. Delete related journal entry lines & journal entries
    const { data: journals } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_id', deleteTransaction.id)
      .eq('reference_type', 'pos_transaction');

    if (journals && journals.length > 0) {
      const jeIds = journals.map(j => j.id);
      await supabase.from('journal_entry_lines').delete().in('journal_entry_id', jeIds);
      await supabase.from('journal_entry_tags').delete().in('journal_entry_id', jeIds);
      await supabase.from('journal_entries').delete().in('id', jeIds);
    }

    // 2. Delete transaction payments
    await supabase.from('pos_transaction_payments').delete().eq('pos_transaction_id', deleteTransaction.id);

    // 3. Delete transaction items
    await supabase.from('pos_transaction_items').delete().eq('pos_transaction_id', deleteTransaction.id);

    // 4. Delete the transaction itself
    const { error } = await supabase.from('pos_transactions').delete().eq('id', deleteTransaction.id);

    if (error) {
      toast.error('Gagal menghapus transaksi: ' + error.message);
    } else {
      toast.success(`Transaksi ${deleteTransaction.transaction_number} berhasil dihapus beserta data terkait`);
    }

    setIsDeleting(false);
    setDeleteTransaction(null);
    fetchTransactions();
  };

  const filteredTransactions = transactions.filter(t =>
    t.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFrom, dateTo, pageSize]);



  const totalRevenue = filteredTransactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalCogs = filteredTransactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.total_cogs || 0), 0);
  const grossProfit = totalRevenue - totalCogs;

  const exportTransactions = (type: 'excel' | 'pdf') => {
    const data = filteredTransactions.map(t => ({
      'No. Transaksi': t.transaction_number,
      'Tanggal': format(new Date(t.transaction_date), 'dd MMM yyyy', { locale: id }),
      'Pelanggan': t.customer_name || '-',
      'Total': formatCurrency(t.total_amount || 0),
      'HPP': formatCurrency(t.total_cogs || 0),
      'Laba': formatCurrency((t.total_amount || 0) - (t.total_cogs || 0)),
      'Status': t.status === 'completed' ? 'Selesai' : t.status === 'held' ? 'Ditahan' : 'Dibatalkan'
    }));

    if (type === 'excel') {
      exportToExcel(data, 'Riwayat-Transaksi-POS');
    } else {
      const headers = ['No. Transaksi', 'Tanggal', 'Pelanggan', 'Total', 'HPP', 'Laba', 'Status'];
      const rows = filteredTransactions.map(t => [
        t.transaction_number,
        format(new Date(t.transaction_date), 'dd MMM yyyy', { locale: id }),
        t.customer_name || '-',
        formatCurrency(t.total_amount || 0),
        formatCurrency(t.total_cogs || 0),
        formatCurrency((t.total_amount || 0) - (t.total_cogs || 0)),
        t.status === 'completed' ? 'Selesai' : t.status === 'held' ? 'Ditahan' : 'Dibatalkan'
      ]);
      const html = generatePDFTable(headers, rows);
      exportToPDF('Riwayat Transaksi POS', html);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Selesai</Badge>;
      case 'held':
        return <Badge variant="outline">Ditahan</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Dibatalkan</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Riwayat Transaksi POS</h1>
        <p className="text-muted-foreground">Daftar semua transaksi penjualan POS</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total HPP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCogs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Laba Kotor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(grossProfit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nomor transaksi atau pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
          placeholder="Dari tanggal"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
          placeholder="Sampai tanggal"
        />
        <Button variant="outline" size="sm" onClick={() => exportTransactions('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportTransactions('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Transaksi</TableHead>
                <TableHead>No. Invoice</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-right">Laba</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">Memuat...</TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Belum ada transaksi POS
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map(transaction => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.transaction_number}</TableCell>
                    <TableCell className="font-mono text-sm">{transaction.invoice_number || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(transaction.transaction_date), 'dd MMM yyyy', { locale: id })}
                    </TableCell>
                    <TableCell>{transaction.customer_name || '-'}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(transaction.total_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(transaction.total_cogs || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency((transaction.total_amount || 0) - (transaction.total_cogs || 0))}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(transaction.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(transaction)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={async () => {
                              await fetchTransactionDetails(transaction.id);
                              printReceiptByType(transaction, 'customer');
                            }}>
                              <Receipt className="h-4 w-4 mr-2" />
                              Cetak Nota
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => {
                              await fetchTransactionDetails(transaction.id);
                              printReceiptByType(transaction, 'kitchen');
                            }}>
                              <ChefHat className="h-4 w-4 mr-2" />
                              Cetak Dapur
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => printAllReceipts(transaction)}>
                              <Printer className="h-4 w-4 mr-2" />
                              Cetak Semua
                            </DropdownMenuItem>
                            {canEditDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleOpenEdit(transaction)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit Transaksi
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeleteTransaction(transaction)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Hapus Transaksi
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Transaksi {selectedTransaction?.transaction_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">No. Invoice:</span>
                <p className="font-medium font-mono">{selectedTransaction?.invoice_number || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tanggal:</span>
                <p className="font-medium">
                  {selectedTransaction && format(new Date(selectedTransaction.transaction_date), 'dd MMMM yyyy HH:mm', { locale: id })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Pelanggan:</span>
                <p className="font-medium">{selectedTransaction?.customer_name || '-'}</p>
                {selectedTransaction?.customer_phone && (
                  <p className="text-xs text-muted-foreground">{selectedTransaction.customer_phone}</p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-medium">{getStatusBadge(selectedTransaction?.status || '')}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Diskon</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.products?.name}</p>
                        <p className="text-xs text-muted-foreground">{item.products?.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      {item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Payments */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Pembayaran</p>
              <div className="space-y-1">
                {transactionPayments.map(payment => (
                  <div key={payment.id} className="flex justify-between text-sm">
                    <span>{(payment.pos_payment_methods as any)?.name || 'Unknown'}</span>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedTransaction?.subtotal || 0)}</span>
              </div>
              {(selectedTransaction?.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon</span>
                  <span>-{formatCurrency(selectedTransaction?.discount_amount || 0)}</span>
                </div>
              )}
              {(selectedTransaction?.tax_amount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span>{formatCurrency(selectedTransaction?.tax_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(selectedTransaction?.total_amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Dibayar</span>
                <span>{formatCurrency(selectedTransaction?.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kembalian</span>
                <span>{formatCurrency(selectedTransaction?.change_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>HPP</span>
                <span>{formatCurrency(selectedTransaction?.total_cogs || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-primary">
                <span>Laba Kotor</span>
                <span>
                  {formatCurrency((selectedTransaction?.total_amount || 0) - (selectedTransaction?.total_cogs || 0))}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedTransaction(null)} className="w-full sm:w-auto">
              Tutup
            </Button>
            <Button 
              variant="outline" 
              onClick={() => selectedTransaction && printReceiptByType(selectedTransaction, 'kitchen')}
              className="w-full sm:w-auto"
            >
              <ChefHat className="h-4 w-4 mr-2" />
              Cetak Dapur
            </Button>
            <Button 
              onClick={() => selectedTransaction && printReceiptByType(selectedTransaction, 'customer')}
              className="w-full sm:w-auto"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Cetak Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editTransaction} onOpenChange={() => setEditTransaction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaksi {editTransaction?.transaction_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tanggal Transaksi</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div>
              <Label>No. Invoice</Label>
              <Input value={editInvoiceNumber} onChange={(e) => setEditInvoiceNumber(e.target.value)} placeholder="Opsional" />
            </div>
            <div>
              <Label>Nama Pelanggan</Label>
              <Input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} placeholder="Opsional" />
            </div>
            <div>
              <Label>No. Telepon</Label>
              <Input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(e.target.value)} placeholder="Opsional" />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Opsional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTransaction(null)}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTransaction} onOpenChange={() => setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi <strong>{deleteTransaction?.transaction_number}</strong> akan dihapus beserta seluruh data terkait (item, pembayaran, jurnal akuntansi). Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTransaction}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default POSTransactions;
