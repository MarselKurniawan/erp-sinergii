import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { 
  thermalPrinter, 
  PrinterConfig, 
  ReceiptData, 
  KitchenOrderData 
} from '@/lib/escpos';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface PrinterSetting {
  id: string;
  name: string;
  connection_type: string;
  vendor_id: string | null;
  product_id: string | null;
  ip_address: string | null;
  port: number | null;
  paper_width: string;
  is_kitchen_printer: boolean;
  is_cashier_printer: boolean;
  is_active: boolean;
}

interface ReceiptSetting {
  id: string;
  receipt_type: string;
  name: string;
  header_text: string | null;
  footer_text: string | null;
  show_company_name: boolean;
  show_company_address: boolean;
  show_company_phone: boolean;
  show_logo: boolean;
  logo_url: string | null;
  show_customer_info: boolean;
  show_item_details: boolean;
  show_payment_info: boolean;
  is_active: boolean;
  printer_setting_id: string | null;
}

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_percent: number;
  tax_percent: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  category_id?: string;
  notes?: string;
}

interface PaymentEntry {
  method_id: string;
  method_name: string;
  amount: number;
}

interface TransactionData {
  transaction_number: string;
  customer_name?: string;
  customer_phone?: string;
  table_name?: string;
  items: CartItem[];
  payments: PaymentEntry[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  taxDisplay?: string;
  roundingAmount?: number;
  grandTotal: number;
  changeAmount: number;
}

export function useThermalPrinter() {
  const { selectedCompany } = useCompany();
  const [isPrinting, setIsPrinting] = useState(false);

  // Get active printers by role
  const getPrinters = useCallback(async (role: 'cashier' | 'kitchen' | 'all' = 'all') => {
    if (!selectedCompany) return [];

    let query = supabase
      .from('printer_settings')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true);

    if (role === 'cashier') {
      query = query.eq('is_cashier_printer', true);
    } else if (role === 'kitchen') {
      query = query.eq('is_kitchen_printer', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching printers:', error);
      return [];
    }

    return (data || []) as PrinterSetting[];
  }, [selectedCompany]);

  // Get receipt settings
  const getReceiptSettings = useCallback(async () => {
    if (!selectedCompany) return [];

    const { data, error } = await supabase
      .from('receipt_settings')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching receipt settings:', error);
      return [];
    }

    return (data || []) as ReceiptSetting[];
  }, [selectedCompany]);

  // Convert printer setting to config
  const toPrinterConfig = (printer: PrinterSetting): PrinterConfig => ({
    connectionType: printer.connection_type as PrinterConfig['connectionType'],
    vendorId: printer.vendor_id || undefined,
    productId: printer.product_id || undefined,
    ipAddress: printer.ip_address || undefined,
    port: printer.port || 9100,
    paperWidth: printer.paper_width as '58mm' | '80mm',
  });

  // Build receipt data from transaction
  const buildReceiptData = (
    transaction: TransactionData,
    receiptSetting?: ReceiptSetting
  ): ReceiptData => {
    const company = selectedCompany;
    
    return {
      companyName: receiptSetting?.show_company_name !== false ? company?.name : undefined,
      companyAddress: receiptSetting?.show_company_address !== false ? company?.address || undefined : undefined,
      companyPhone: receiptSetting?.show_company_phone !== false ? company?.phone || undefined : undefined,
      headerText: receiptSetting?.header_text || undefined,
      footerText: receiptSetting?.footer_text || undefined,
      transactionNumber: transaction.transaction_number,
      date: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: id }),
      customerName: receiptSetting?.show_customer_info !== false ? transaction.customer_name : undefined,
      items: transaction.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        discount: item.discount_percent > 0 ? item.discount_percent : undefined,
        total: item.total,
      })),
      subtotal: transaction.subtotal,
      discount: transaction.totalDiscount > 0 ? transaction.totalDiscount : undefined,
      tax: transaction.totalTax > 0 ? transaction.totalTax : undefined,
      taxLabel: transaction.taxDisplay,
      rounding: transaction.roundingAmount,
      total: transaction.grandTotal,
      payments: receiptSetting?.show_payment_info !== false 
        ? transaction.payments.map(p => ({
            method: p.method_name,
            amount: p.amount,
          }))
        : [],
      change: transaction.changeAmount > 0 ? transaction.changeAmount : undefined,
    };
  };

  // Build kitchen order data
  const buildKitchenOrderData = (
    transaction: TransactionData,
    items: CartItem[]
  ): KitchenOrderData => ({
    orderNumber: transaction.transaction_number,
    tableName: transaction.table_name,
    date: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: id }),
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      notes: item.notes,
    })),
  });

  // Print customer receipt (silent)
  const printCustomerReceipt = useCallback(async (
    transaction: TransactionData,
    receiptSetting?: ReceiptSetting
  ): Promise<boolean> => {
    setIsPrinting(true);
    
    try {
      // Get cashier printer
      const printers = await getPrinters('cashier');
      
      if (printers.length === 0) {
        // Fallback to browser print if no thermal printer configured
        console.warn('No cashier printer configured, using browser print');
        setIsPrinting(false);
        return false; // Signal to use fallback
      }

      const receiptData = buildReceiptData(transaction, receiptSetting);
      
      // Print to all active cashier printers
      let anySuccess = false;
      for (const printer of printers) {
        const config = toPrinterConfig(printer);
        try {
          const success = await thermalPrinter.printReceipt(config, receiptData);
          if (success) {
            anySuccess = true;
            toast.success(`Struk dicetak ke ${printer.name}`);
          }
        } catch (error) {
          console.error(`Print to ${printer.name} failed:`, error);
        }
      }

      setIsPrinting(false);
      return anySuccess;
    } catch (error) {
      console.error('Print receipt error:', error);
      setIsPrinting(false);
      return false;
    }
  }, [getPrinters, selectedCompany]);

  // Print kitchen order (silent)
  const printKitchenOrder = useCallback(async (
    transaction: TransactionData,
    items?: CartItem[]
  ): Promise<boolean> => {
    setIsPrinting(true);
    
    try {
      const printers = await getPrinters('kitchen');
      
      if (printers.length === 0) {
        console.warn('No kitchen printer configured');
        setIsPrinting(false);
        return false;
      }

      const orderData = buildKitchenOrderData(
        transaction,
        items || transaction.items
      );
      
      let anySuccess = false;
      for (const printer of printers) {
        const config = toPrinterConfig(printer);
        try {
          const success = await thermalPrinter.printKitchenOrder(config, orderData);
          if (success) {
            anySuccess = true;
            toast.success(`Order dapur dicetak ke ${printer.name}`);
          }
        } catch (error) {
          console.error(`Kitchen print to ${printer.name} failed:`, error);
        }
      }

      setIsPrinting(false);
      return anySuccess;
    } catch (error) {
      console.error('Print kitchen order error:', error);
      setIsPrinting(false);
      return false;
    }
  }, [getPrinters]);

  // Print all (customer + kitchen)
  const printAll = useCallback(async (
    transaction: TransactionData,
    receiptSetting?: ReceiptSetting
  ): Promise<{ customer: boolean; kitchen: boolean }> => {
    const [customerSuccess, kitchenSuccess] = await Promise.all([
      printCustomerReceipt(transaction, receiptSetting),
      printKitchenOrder(transaction),
    ]);

    return { customer: customerSuccess, kitchen: kitchenSuccess };
  }, [printCustomerReceipt, printKitchenOrder]);

  // Test print
  const testPrint = useCallback(async (printerId: string): Promise<boolean> => {
    const printers = await getPrinters('all');
    const printer = printers.find(p => p.id === printerId);
    
    if (!printer) {
      toast.error('Printer tidak ditemukan');
      return false;
    }

    setIsPrinting(true);
    const config = toPrinterConfig(printer);
    
    try {
      const success = await thermalPrinter.testPrint(config);
      if (success) {
        toast.success('Test print berhasil!');
      } else {
        toast.error('Test print gagal');
      }
      setIsPrinting(false);
      return success;
    } catch (error) {
      console.error('Test print error:', error);
      toast.error('Test print gagal: ' + (error as Error).message);
      setIsPrinting(false);
      return false;
    }
  }, [getPrinters]);

  // Check if silent printing is available
  const isSilentPrintAvailable = useCallback(async (): Promise<boolean> => {
    const printers = await getPrinters('cashier');
    return printers.length > 0;
  }, [getPrinters]);

  return {
    isPrinting,
    printCustomerReceipt,
    printKitchenOrder,
    printAll,
    testPrint,
    isSilentPrintAvailable,
    getPrinters,
    getReceiptSettings,
  };
}
