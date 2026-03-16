import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Minus, Plus, ShoppingCart, Trash2, Receipt, Search, Maximize, Minimize, Pause, Play, Printer, User, ChefHat, Tag, X, RotateCcw, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { id } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface AppliedPromo {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
}

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_percent: number;
  tax_percent: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  category_id?: string | null;
  category_name?: string | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  account_id: string | null;
}

interface PaymentEntry {
  method_id: string;
  method_name: string;
  amount: number;
}

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  account_id: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface HeldTransaction {
  id: string;
  customer_name: string;
  items: CartItem[];
  created_at: Date;
}

interface CashSession {
  id: string;
  opening_balance: number;
  status: string;
  opened_at: string;
}

interface ReceiptSetting {
  id: string;
  receipt_type: string;
  name: string;
  logo_url: string | null;
  header_text: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_company_name: boolean;
  show_company_address: boolean;
  show_company_phone: boolean;
  show_customer_info: boolean;
  show_item_details: boolean;
  show_payment_info: boolean;
  paper_size: string;
  is_active: boolean;
  printer_setting_id: string | null;
}

interface SplitRule {
  id: string;
  receipt_setting_id: string;
  category_id: string | null;
  category_name: string | null;
}

const POSDashboard = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { products } = useProducts();
  const { printCustomerReceipt, printKitchenOrder, printAll, isPrinting } = useThermalPrinter();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  
  // Tax
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>([]);
  
  // Held transactions
  const [heldTransactions, setHeldTransactions] = useState<HeldTransaction[]>([]);
  const [showHeldDialog, setShowHeldDialog] = useState(false);
  
  // Cash session
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [showOpenSessionDialog, setShowOpenSessionDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  
  // Receipt
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  
  // Receipt settings
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSetting[]>([]);
  const [splitRules, setSplitRules] = useState<SplitRule[]>([]);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  // Fetch payment methods, customers, and receipt settings
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!selectedCompany) return;
      const { data } = await supabase
        .from('pos_payment_methods')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true);
      
      setPaymentMethods(data || []);
    };
    
    const fetchCurrentSession = async () => {
      if (!selectedCompany) return;
      const { data } = await supabase
        .from('pos_cash_sessions')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setCurrentSession(data);
      if (!data) {
        setShowOpenSessionDialog(true);
      }
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

    const fetchTaxRates = async () => {
      if (!selectedCompany) return;
      const { data } = await supabase
        .from('pos_tax_rates')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true)
        .order('name');
      
      setTaxRates(data || []);
    };

    const fetchCustomers = async () => {
      if (!selectedCompany) return;
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('company_id', selectedCompany.id)
        .order('name');
      
      setCustomers(data || []);
    };
    
    fetchPaymentMethods();
    fetchCurrentSession();
    fetchReceiptSettings();
    fetchTaxRates();
    fetchCustomers();
  }, [selectedCompany]);

  // Handle customer selection
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || '');
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  // Apply promo code
  const applyPromoCode = async () => {
    if (!promoCode.trim() || !selectedCompany) return;
    
    const now = new Date().toISOString();
    const { data: promo, error } = await supabase
      .from('pos_promotions')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('promo_code', promoCode.trim().toUpperCase())
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .maybeSingle();
    
    if (error || !promo) {
      toast.error('Kode promo tidak valid atau sudah kadaluarsa');
      return;
    }
    
    // Check usage limit
    if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
      toast.error('Kode promo sudah mencapai batas penggunaan');
      return;
    }
    
    // Check minimum purchase
    const currentSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    if (promo.min_purchase && currentSubtotal < promo.min_purchase) {
      toast.error(`Minimum pembelian ${formatCurrency(promo.min_purchase)} untuk menggunakan promo ini`);
      return;
    }
    
    setAppliedPromo({
      id: promo.id,
      name: promo.name,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      max_discount: promo.max_discount
    });
    
    // Calculate discount
    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = currentSubtotal * (promo.discount_value / 100);
      if (promo.max_discount && discount > promo.max_discount) {
        discount = promo.max_discount;
      }
    } else {
      discount = promo.discount_value;
    }
    
    setPromoDiscount(discount);
    toast.success(`Promo "${promo.name}" berhasil diterapkan!`);
  };

  // Remove applied promo
  const removePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoCode('');
  };

  // Recalculate promo discount when cart changes
  useEffect(() => {
    if (appliedPromo && cart.length > 0) {
      const currentSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      // Check if still meets minimum purchase
      if (appliedPromo.max_discount === null) {
        // Check min_purchase from the stored promo
        // For simplicity, just recalculate the discount
      }
      
      let discount = 0;
      if (appliedPromo.discount_type === 'percentage') {
        discount = currentSubtotal * (appliedPromo.discount_value / 100);
        if (appliedPromo.max_discount && discount > appliedPromo.max_discount) {
          discount = appliedPromo.max_discount;
        }
      } else {
        discount = appliedPromo.discount_value;
      }
      
      setPromoDiscount(discount);
    } else if (cart.length === 0 && appliedPromo) {
      removePromo();
    }
  }, [cart, appliedPromo]);

  // Calculate total tax rate from selected taxes
  const getTotalTaxRate = () => {
    return taxRates
      .filter(t => selectedTaxIds.includes(t.id))
      .reduce((sum, t) => sum + t.rate, 0);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      updateQuantity(product.id, 1);
    } else {
      const totalTaxRate = getTotalTaxRate();
      const newItem: CartItem = {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_price: product.unit_price,
        cost_price: product.cost_price,
        discount_percent: 0,
        tax_percent: totalTaxRate,
        discount_amount: 0,
        tax_amount: 0,
        total: product.unit_price,
        category_id: product.category_id,
        category_name: product.category?.name || null
      };
      recalculateItem(newItem);
      setCart([...cart, newItem]);
    }
  };

  // Toggle tax selection and update cart
  const toggleTaxSelection = (taxId: string) => {
    const newSelectedIds = selectedTaxIds.includes(taxId)
      ? selectedTaxIds.filter(id => id !== taxId)
      : [...selectedTaxIds, taxId];
    
    setSelectedTaxIds(newSelectedIds);
    
    // Recalculate all cart items with new tax rate
    const newTotalTaxRate = taxRates
      .filter(t => newSelectedIds.includes(t.id))
      .reduce((sum, t) => sum + t.rate, 0);
    
    setCart(cart.map(item => {
      const updated = { ...item, tax_percent: newTotalTaxRate };
      recalculateItem(updated);
      return updated;
    }));
  };

  const recalculateItem = (item: CartItem) => {
    const subtotal = item.quantity * item.unit_price;
    item.discount_amount = subtotal * (item.discount_percent / 100);
    const afterDiscount = subtotal - item.discount_amount;
    item.tax_amount = afterDiscount * (item.tax_percent / 100);
    item.total = afterDiscount + item.tax_amount;
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        const updated = { ...item, quantity: newQty };
        recalculateItem(updated);
        return updated;
      }
      return item;
    }));
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const updated = { ...item, discount_percent: Math.min(100, Math.max(0, discount)) };
        recalculateItem(updated);
        return updated;
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Round down decimals only (not to nearest 100)
  const roundDecimals = (amount: number) => Math.floor(amount);

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalItemDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalDiscount = totalItemDiscount + promoDiscount;
  const totalTax = cart.reduce((sum, item) => sum + item.tax_amount, 0);
  const grandTotalBeforeRounding = cart.reduce((sum, item) => sum + item.total, 0) - promoDiscount;
  const roundingAmount = grandTotalBeforeRounding - roundDecimals(grandTotalBeforeRounding);
  const grandTotal = roundDecimals(grandTotalBeforeRounding);
  const totalCogs = cart.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const changeAmount = totalPaid - grandTotal;
  
  // Get selected tax names for receipt display
  const getSelectedTaxDisplay = () => {
    const selected = taxRates.filter(t => selectedTaxIds.includes(t.id));
    if (selected.length === 0) return '';
    return selected.map(t => `${t.name} (${t.rate}%)`).join(', ');
  };

  const openSession = async () => {
    if (!selectedCompany) return;
    
    const { data, error } = await supabase
      .from('pos_cash_sessions')
      .insert({
        company_id: selectedCompany.id,
        opened_by: user?.id,
        opening_balance: parseFloat(openingBalance) || 0
      })
      .select()
      .single();
    
    if (error) {
      toast.error('Gagal membuka sesi kasir');
      return;
    }
    
    setCurrentSession(data);
    setShowOpenSessionDialog(false);
    toast.success('Sesi kasir dibuka');
  };

  const holdTransaction = () => {
    if (cart.length === 0) return;
    
    const held: HeldTransaction = {
      id: `HOLD-${Date.now()}`,
      customer_name: customerName || 'Pelanggan',
      items: [...cart],
      created_at: new Date()
    };
    
    setHeldTransactions([...heldTransactions, held]);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    toast.success('Transaksi ditahan');
  };

  const resumeTransaction = (held: HeldTransaction) => {
    setCart(held.items);
    setCustomerName(held.customer_name);
    setHeldTransactions(heldTransactions.filter(h => h.id !== held.id));
    setShowHeldDialog(false);
  };

  const generateTransactionNumber = async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('pos_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany?.id);
    return `POS-${today}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const generateInvoiceNumber = async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('pos_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany?.id)
      .not('invoice_number', 'is', null);
    return `INV-${today}-${String((count || 0) + 1).padStart(5, '0')}`;
  };

  const generateCustomerCode = () => {
    const today = format(new Date(), 'yyyyMMdd');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CUST-${today}-${random}`;
  };

  const openPaymentDialog = () => {
    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }
    if (!currentSession) {
      toast.error('Buka sesi kasir terlebih dahulu');
      setShowOpenSessionDialog(true);
      return;
    }
    setPayments([]);
    setShowPaymentDialog(true);
  };

  const addPayment = (method: PaymentMethod) => {
    const remaining = grandTotal - totalPaid;
    if (remaining <= 0) return;
    
    setPayments([...payments, {
      method_id: method.id,
      method_name: method.name,
      amount: remaining
    }]);
  };

  const updatePaymentAmount = (index: number, amount: number) => {
    const updated = [...payments];
    updated[index].amount = amount;
    setPayments(updated);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const processTransaction = async () => {
    if (!selectedCompany || cart.length === 0 || !currentSession) return;
    if (totalPaid < grandTotal) {
      toast.error('Pembayaran kurang');
      return;
    }

    setIsProcessing(true);
    try {
      const transactionNumber = await generateTransactionNumber();
      const invoiceNumber = await generateInvoiceNumber();
      const displayCustomerName = customerName || generateCustomerCode();

      // Create POS transaction
      const { data: transaction, error: txError } = await supabase
        .from('pos_transactions')
        .insert({
          company_id: selectedCompany.id,
          transaction_number: transactionNumber,
          invoice_number: invoiceNumber,
          subtotal: subtotal,
          tax_amount: totalTax,
          total_amount: grandTotal,
          total_cogs: totalCogs,
          discount_amount: totalDiscount,
          cash_session_id: currentSession.id,
          customer_name: displayCustomerName,
          customer_phone: customerPhone || null,
          amount_paid: totalPaid,
          change_amount: changeAmount,
          status: 'completed',
          created_by: user?.id
        })
        .select()
        .single();

      if (txError) throw txError;

      // Create transaction items
      const items = cart.map(item => ({
        pos_transaction_id: transaction.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        tax_percent: item.tax_percent,
        tax_amount: item.tax_amount,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('pos_transaction_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Create transaction payments
      const paymentRecords = payments.map(p => ({
        pos_transaction_id: transaction.id,
        payment_method_id: p.method_id,
        amount: p.amount
      }));

      const { error: paymentsError } = await supabase
        .from('pos_transaction_payments')
        .insert(paymentRecords);

      if (paymentsError) throw paymentsError;

      // Create journal entry
      const journalNumber = `JV-POS-${transactionNumber}`;
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: selectedCompany.id,
          entry_number: journalNumber,
          description: `Penjualan POS ${transactionNumber} - ${displayCustomerName}`,
          reference_type: 'pos_transaction',
          reference_id: transaction.id,
          is_posted: true,
          created_by: user?.id
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal lines based on payment methods
      // IMPORTANT: Only debit the ACTUAL amount received, not including change
      // If customer pays 100k for 85k bill with 15k change, we only debit 85k
      const journalLines: any[] = [];
      
      // Calculate total payment and adjust for change
      // We need to proportionally distribute grandTotal across payment methods
      const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
      
      // Debit each payment method's account (proportionally adjusted)
      for (const payment of payments) {
        const method = paymentMethods.find(m => m.id === payment.method_id);
        if (method?.account_id) {
          // Calculate the actual amount to record (adjusted for change)
          // If totalPayments > grandTotal, we have change, so only record up to grandTotal proportionally
          const actualAmount = totalPayments > grandTotal 
            ? (payment.amount / totalPayments) * grandTotal 
            : payment.amount;
          
          journalLines.push({
            journal_entry_id: journalEntry.id,
            account_id: method.account_id,
            debit_amount: Math.round(actualAmount * 100) / 100, // Round to 2 decimal places
            credit_amount: 0,
            description: `Penerimaan via ${method.name}`
          });
        }
      }

      // Credit revenue account - find first revenue account
      const { data: revenueAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('account_type', 'revenue')
        .limit(1)
        .single();

      if (revenueAccount) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: revenueAccount.id,
          debit_amount: 0,
          credit_amount: grandTotal,
          description: 'Pendapatan penjualan POS'
        });
      }

      // COGS entries - MUST create both debit HPP and credit Inventory to balance
      if (totalCogs > 0) {
        // Search for COGS/HPP account with multiple patterns
        const { data: cogsAccounts } = await supabase
          .from('chart_of_accounts')
          .select('id, name')
          .eq('company_id', selectedCompany.id)
          .eq('account_type', 'expense')
          .eq('is_active', true);

        // Find account matching COGS patterns
        const cogsAccount = cogsAccounts?.find(acc => 
          acc.name.toLowerCase().includes('hpp') || 
          acc.name.toLowerCase().includes('harga pokok') ||
          acc.name.toLowerCase().includes('cogs') ||
          acc.name.toLowerCase().includes('cost of')
        );

        const { data: inventoryAccounts } = await supabase
          .from('chart_of_accounts')
          .select('id, name')
          .eq('company_id', selectedCompany.id)
          .eq('account_type', 'asset')
          .eq('is_active', true);

        // Find account matching inventory patterns
        const inventoryAccount = inventoryAccounts?.find(acc =>
          acc.name.toLowerCase().includes('persediaan') ||
          acc.name.toLowerCase().includes('inventory') ||
          acc.name.toLowerCase().includes('stock')
        );

        // Only add COGS entries if BOTH accounts exist (to maintain balance)
        if (cogsAccount && inventoryAccount) {
          journalLines.push({
            journal_entry_id: journalEntry.id,
            account_id: cogsAccount.id,
            debit_amount: totalCogs,
            credit_amount: 0,
            description: 'HPP penjualan'
          });

          journalLines.push({
            journal_entry_id: journalEntry.id,
            account_id: inventoryAccount.id,
            debit_amount: 0,
            credit_amount: totalCogs,
            description: 'Pengurangan persediaan'
          });
        } else {
          console.warn('Missing COGS or Inventory account - COGS entries skipped to avoid unbalanced journal');
        }
      }

      if (journalLines.length > 0) {
        await supabase.from('journal_entry_lines').insert(journalLines);
      }

      // Update promo usage count if applied
      if (appliedPromo) {
        await supabase
          .from('pos_promotions')
          .update({ used_count: (await supabase.from('pos_promotions').select('used_count').eq('id', appliedPromo.id).single()).data?.used_count + 1 })
          .eq('id', appliedPromo.id);
      }

      setLastTransaction({
        ...transaction,
        items: cart,
        payments,
        customer_name: displayCustomerName,
        selectedTaxDisplay: getSelectedTaxDisplay(),
        roundingAmount: roundingAmount,
        promoName: appliedPromo?.name || null,
        promoDiscount: promoDiscount
      });

      toast.success(`Transaksi ${transactionNumber} berhasil`);
      setCart([]);
      setPayments([]);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomerId('');
      setAppliedPromo(null);
      setPromoDiscount(0);
      setPromoCode('');
      setShowPaymentDialog(false);
      setShowReceiptDialog(true);
    } catch (error: any) {
      toast.error('Gagal memproses transaksi: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate receipt HTML based on settings
  const generateReceiptHtml = (setting: ReceiptSetting, items: CartItem[], transaction: any) => {
    const paperWidth = setting.paper_size === '58mm' ? '58mm' : setting.paper_size === '80mm' ? '80mm' : '210mm';
    const fontSize = setting.paper_size === '58mm' ? '10px' : '12px';
    
    const itemSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const itemDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
    const itemTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const itemTotalBeforeRounding = items.reduce((sum, item) => sum + item.total, 0);
    const itemRounding = itemTotalBeforeRounding - roundDecimals(itemTotalBeforeRounding);
    const itemTotal = roundDecimals(itemTotalBeforeRounding);
    
    const taxDisplay = transaction.selectedTaxDisplay || '';

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
        <div>Tgl: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: id })}</div>
        ${setting.show_customer_info ? `
          <div>Kasir: ${user?.email}</div>
          <div>Pelanggan: ${transaction.customer_name}</div>
        ` : ''}
        <hr>
        ${setting.show_item_details ? `
          <table>
            ${items.map((item: CartItem) => `
              <tr>
                <td colspan="2"><strong>${item.name}</strong></td>
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
            ${itemTax > 0 ? `<tr><td>Pajak${taxDisplay ? ` (${taxDisplay})` : ''}</td><td class="right">${formatCurrency(itemTax)}</td></tr>` : ''}
            ${itemRounding > 0 ? `<tr><td>Pembulatan</td><td class="right">-${formatCurrency(itemRounding)}</td></tr>` : ''}
            <tr class="bold large"><td>TOTAL</td><td class="right">${formatCurrency(itemTotal)}</td></tr>
          </table>
        ` : `
          <div class="center bold">
            <p>Item: ${items.length}</p>
            <p class="large">Total: ${formatCurrency(itemTotal)}</p>
          </div>
        `}
        ${setting.show_payment_info && transaction.payments ? `
          <hr>
          <table>
            ${transaction.payments.map((p: PaymentEntry) => `
              <tr><td>${p.method_name}</td><td class="right">${formatCurrency(p.amount)}</td></tr>
            `).join('')}
            <tr><td>Kembali</td><td class="right">${formatCurrency(Math.max(0, transaction.change_amount || 0))}</td></tr>
          </table>
        ` : ''}
        ${setting.footer_text ? `
          <hr>
          <div class="center" style="white-space: pre-line;">${setting.footer_text}</div>
        ` : ''}
      </body>
      </html>
    `;
  };

  // Get items for a specific receipt setting based on split rules
  const getItemsForReceipt = (setting: ReceiptSetting, allItems: CartItem[]) => {
    const rules = splitRules.filter(r => r.receipt_setting_id === setting.id);
    
    // If no rules, return all items
    if (rules.length === 0) {
      return allItems;
    }
    
    // Filter items by category
    const categoryIds = rules.map(r => r.category_id).filter(Boolean);
    return allItems.filter(item => categoryIds.includes(item.category_id || ''));
  };

  // Silent print helper - builds transaction data for thermal printer
  const buildTransactionDataForPrint = useCallback(() => {
    if (!lastTransaction) return null;
    
    return {
      transaction_number: lastTransaction.transaction_number,
      customer_name: lastTransaction.customer_name,
      customer_phone: lastTransaction.customer_phone,
      items: lastTransaction.items.map((item: CartItem) => ({
        id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        discount_percent: item.discount_percent,
        tax_percent: item.tax_percent,
        tax_amount: item.tax_amount,
        discount_amount: item.discount_amount,
        total: item.total,
        category_id: item.category_id,
      })),
      payments: lastTransaction.payments,
      subtotal: subtotal,
      totalDiscount: totalDiscount,
      totalTax: totalTax,
      taxDisplay: lastTransaction.selectedTaxDisplay,
      roundingAmount: lastTransaction.roundingAmount,
      grandTotal: grandTotal,
      changeAmount: changeAmount > 0 ? changeAmount : 0,
    };
  }, [lastTransaction, subtotal, totalDiscount, totalTax, grandTotal, changeAmount]);

  // Fallback browser print for when no thermal printer is configured
  const browserPrintReceipt = (receiptType?: string) => {
    if (!lastTransaction) return;

    let settingsToPrint = receiptSettings;
    if (receiptType) {
      settingsToPrint = receiptSettings.filter(s => s.receipt_type === receiptType);
    }

    if (settingsToPrint.length === 0) {
      browserPrintDefaultReceipt();
      return;
    }

    settingsToPrint.forEach(setting => {
      const items = getItemsForReceipt(setting, lastTransaction.items);
      if (items.length === 0) return;
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const receiptHtml = generateReceiptHtml(setting, items, lastTransaction);
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    });
  };

  const browserPrintDefaultReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !lastTransaction) return;

    const taxDisplay = lastTransaction.selectedTaxDisplay || '';
    const txRoundingAmount = lastTransaction.roundingAmount || 0;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk ${lastTransaction.transaction_number}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
          .center { text-align: center; }
          .right { text-align: right; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; }
          .bold { font-weight: bold; }
          .large { font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold large">${selectedCompany?.name}</div>
          <div>${selectedCompany?.address || ''}</div>
          <div>${selectedCompany?.phone || ''}</div>
        </div>
        <hr>
        <div>No: ${lastTransaction.transaction_number}</div>
        <div>Tgl: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: id })}</div>
        <div>Kasir: ${user?.email}</div>
        <div>Pelanggan: ${lastTransaction.customer_name}</div>
        <hr>
        <table>
          ${lastTransaction.items.map((item: CartItem) => `
            <tr>
              <td colspan="2">${item.name}</td>
            </tr>
            <tr>
              <td>${item.quantity} x ${formatCurrency(item.unit_price)}${item.discount_percent > 0 ? ` -${item.discount_percent}%` : ''}</td>
              <td class="right">${formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
        </table>
        <hr>
        <table>
          <tr><td>Subtotal</td><td class="right">${formatCurrency(subtotal)}</td></tr>
          ${totalDiscount > 0 ? `<tr><td>Diskon</td><td class="right">-${formatCurrency(totalDiscount)}</td></tr>` : ''}
          ${totalTax > 0 ? `<tr><td>Pajak${taxDisplay ? ` (${taxDisplay})` : ''}</td><td class="right">${formatCurrency(totalTax)}</td></tr>` : ''}
          ${txRoundingAmount > 0 ? `<tr><td>Pembulatan</td><td class="right">-${formatCurrency(txRoundingAmount)}</td></tr>` : ''}
          <tr class="bold large"><td>TOTAL</td><td class="right">${formatCurrency(grandTotal)}</td></tr>
        </table>
        <hr>
        <table>
          ${lastTransaction.payments.map((p: PaymentEntry) => `
            <tr><td>${p.method_name}</td><td class="right">${formatCurrency(p.amount)}</td></tr>
          `).join('')}
          <tr><td>Kembali</td><td class="right">${formatCurrency(changeAmount > 0 ? changeAmount : 0)}</td></tr>
        </table>
        <hr>
        <div class="center">
          <div>Terima kasih atas kunjungan Anda</div>
          <div>Barang yang sudah dibeli tidak dapat dikembalikan</div>
        </div>
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

  // Main print function - tries silent print first, falls back to browser
  const printReceipt = async (receiptType?: string) => {
    if (!lastTransaction) return;
    
    const transactionData = buildTransactionDataForPrint();
    if (!transactionData) return;

    // Try silent printing based on receipt type
    if (receiptType === 'kitchen') {
      const success = await printKitchenOrder(transactionData);
      if (!success) {
        // Fallback to browser print
        browserPrintReceipt('kitchen');
      }
    } else if (receiptType === 'customer') {
      // Find matching receipt setting for customer
      const customerSetting = receiptSettings.find(s => s.receipt_type === 'customer');
      const success = await printCustomerReceipt(transactionData, customerSetting);
      if (!success) {
        browserPrintReceipt('customer');
      }
    } else {
      // Print all types
      const customerSetting = receiptSettings.find(s => s.receipt_type === 'customer');
      const customerSuccess = await printCustomerReceipt(transactionData, customerSetting);
      const kitchenSuccess = await printKitchenOrder(transactionData);
      
      // Fallback for any that failed
      if (!customerSuccess) browserPrintReceipt('customer');
      if (!kitchenSuccess) browserPrintReceipt('kitchen');
    }
  };

  const printAllReceipts = async () => {
    if (!lastTransaction) return;
    
    const transactionData = buildTransactionDataForPrint();
    if (!transactionData) return;

    const customerSetting = receiptSettings.find(s => s.receipt_type === 'customer');
    const { customer, kitchen } = await printAll(transactionData, customerSetting);
    
    // Fallback to browser for any that failed
    if (!customer) browserPrintReceipt('customer');
    if (!kitchen) {
      setTimeout(() => browserPrintReceipt('kitchen'), 300);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter true fullscreen mode
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        // Exit fullscreen mode
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      // Fallback to just UI fullscreen if API not available
      setIsFullscreen(!isFullscreen);
    }
  };

  // Listen for fullscreen changes (e.g., when user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background p-4 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Point of Sale</h1>
              {currentSession && (
                <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                  Sesi Aktif: {formatCurrency(currentSession.opening_balance)} (Saldo Awal)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowHeldDialog(true)} disabled={heldTransactions.length === 0}>
                <Pause className="h-4 w-4 mr-1" />
                Ditahan ({heldTransactions.length})
              </Button>
              <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                <Minimize className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
            {/* Products */}
            <div className="col-span-2 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari produk..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
              </div>
              <div className="flex-1 grid grid-cols-4 gap-2 overflow-y-auto content-start">
                {filteredProducts.map(product => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto py-3 px-3 flex flex-col items-start text-left"
                    onClick={() => addToCart(product)}
                  >
                    <span className="font-medium text-sm truncate w-full">{product.name}</span>
                    <span className="text-xs text-muted-foreground">{product.sku}</span>
                    <span className="text-primary font-semibold text-sm">{formatCurrency(product.unit_price)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="flex flex-col min-h-0 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Keranjang ({cart.length})
                </h2>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Input
                  placeholder="Nama pelanggan"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="text-sm"
                />
                <Input
                  placeholder="No. HP"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Tax Selection */}
              <div className="mb-4 space-y-1">
                <Label className="text-xs text-muted-foreground">Pajak (opsional)</Label>
                <div className="flex flex-wrap gap-2">
                  {taxRates.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Belum ada pajak</span>
                  ) : (
                    taxRates.map(tax => (
                      <Badge 
                        key={tax.id}
                        variant={selectedTaxIds.includes(tax.id) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleTaxSelection(tax.id)}
                      >
                        {tax.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Keranjang kosong</p>
                ) : (
                  cart.map(item => (
                    <div key={item.product_id} className="p-2 border rounded space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate flex-1">{item.name}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(item.product_id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(item.product_id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(item.product_id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          type="number"
                          placeholder="Diskon %"
                          value={item.discount_percent || ''}
                          onChange={(e) => updateItemDiscount(item.product_id, parseFloat(e.target.value) || 0)}
                          className="w-16 h-6 text-xs text-center"
                        />
                        <span className="font-medium text-sm">{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-1 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalItemDiscount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Diskon Item</span>
                    <span>-{formatCurrency(totalItemDiscount)}</span>
                  </div>
                )}
                {promoDiscount > 0 && appliedPromo && (
                  <div className="flex justify-between text-sm text-primary">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {appliedPromo.name}
                    </span>
                    <span>-{formatCurrency(promoDiscount)}</span>
                  </div>
                )}
                {totalTax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Pajak {getSelectedTaxDisplay() && `(${getSelectedTaxDisplay()})`}</span>
                    <span>{formatCurrency(totalTax)}</span>
                  </div>
                )}
                {roundingAmount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Pembulatan</span>
                    <span>-{formatCurrency(roundingAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={holdTransaction} disabled={cart.length === 0}>
                  <Pause className="h-4 w-4" />
                </Button>
                <Button className="flex-1" size="lg" onClick={openPaymentDialog} disabled={cart.length === 0}>
                  <Receipt className="mr-2 h-5 w-5" />
                  Bayar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Dialogs remain the same */}
        {renderDialogs()}
      </div>
    );
  }

  // Normal view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Point of Sale</h1>
          <p className="text-muted-foreground">Transaksi penjualan cepat</p>
        </div>
        <div className="flex items-center gap-2">
          {currentSession ? (
            <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
              Sesi Aktif
            </Badge>
          ) : (
            <Button variant="outline" onClick={() => setShowOpenSessionDialog(true)}>
              Buka Sesi Kasir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowHeldDialog(true)} disabled={heldTransactions.length === 0}>
            <Pause className="h-4 w-4 mr-1" />
            Ditahan ({heldTransactions.length})
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullscreen}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari produk..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                {filteredProducts.map(product => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto py-3 px-4 flex flex-col items-start text-left"
                    onClick={() => addToCart(product)}
                  >
                    <span className="font-medium truncate w-full">{product.name}</span>
                    <span className="text-sm text-muted-foreground">{product.sku}</span>
                    <span className="text-primary font-semibold">{formatCurrency(product.unit_price)}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div>
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Keranjang ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Lookup */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Pelanggan</Label>
                <SearchableSelect
                  options={customers.map(c => ({ value: c.id, label: `${c.name}${c.phone ? ` - ${c.phone}` : ''}` }))}
                  value={selectedCustomerId}
                  onChange={handleCustomerSelect}
                  placeholder="Cari atau pilih pelanggan..."
                  searchPlaceholder="Cari pelanggan..."
                  emptyMessage="Tidak ada pelanggan"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nama pelanggan"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder="No. HP"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Promo Code */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Kode Promo</Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{appliedPromo.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        -{appliedPromo.discount_type === 'percentage' ? `${appliedPromo.discount_value}%` : formatCurrency(appliedPromo.discount_value)}
                      </Badge>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={removePromo}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Masukkan kode promo"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={applyPromoCode} disabled={!promoCode.trim()}>
                      Terapkan
                    </Button>
                  </div>
                )}
              </div>

              {/* Tax Selection */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Pajak & Service (opsional)</Label>
                <div className="flex flex-wrap gap-2">
                  {taxRates.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Belum ada pajak dikonfigurasi</span>
                  ) : (
                    taxRates.map(tax => (
                      <Badge 
                        key={tax.id}
                        variant={selectedTaxIds.includes(tax.id) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleTaxSelection(tax.id)}
                      >
                        {tax.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Keranjang kosong</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.product_id} className="p-2 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(item.unit_price)}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Diskon %"
                              value={item.discount_percent || ''}
                              onChange={(e) => updateItemDiscount(item.product_id, parseFloat(e.target.value) || 0)}
                              className="w-20 h-7 text-sm"
                            />
                          </div>
                          <span className="font-medium">{formatCurrency(item.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {totalItemDiscount > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Diskon Item</span>
                        <span>-{formatCurrency(totalItemDiscount)}</span>
                      </div>
                    )}
                    {promoDiscount > 0 && appliedPromo && (
                      <div className="flex justify-between text-sm text-primary">
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {appliedPromo.name}
                        </span>
                        <span>-{formatCurrency(promoDiscount)}</span>
                      </div>
                    )}
                    {totalTax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Pajak {getSelectedTaxDisplay() && `(${getSelectedTaxDisplay()})`}</span>
                        <span>{formatCurrency(totalTax)}</span>
                      </div>
                    )}
                    {roundingAmount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Pembulatan</span>
                        <span>-{formatCurrency(roundingAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={holdTransaction}>
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button className="flex-1" size="lg" onClick={openPaymentDialog}>
                      <Receipt className="mr-2 h-5 w-5" />
                      Bayar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {renderDialogs()}
    </div>
  );

  function renderDialogs() {
    return (
      <>
        {/* Open Session Dialog */}
        <Dialog open={showOpenSessionDialog} onOpenChange={setShowOpenSessionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buka Sesi Kasir</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Saldo Awal (Kas di Laci)</Label>
                <Input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={openSession}>Buka Sesi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center py-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Tagihan</p>
                <p className="text-3xl font-bold">{formatCurrency(grandTotal)}</p>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2">
                <Label>Pilih Metode Pembayaran</Label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map(method => (
                    <Button 
                      key={method.id} 
                      variant="outline" 
                      onClick={() => addPayment(method)}
                      disabled={totalPaid >= grandTotal}
                    >
                      {method.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Selected Payments */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <Label>Pembayaran</Label>
                  {payments.map((payment, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm flex-1">{payment.method_name}</span>
                      <Input
                        type="number"
                        value={payment.amount}
                        onChange={(e) => updatePaymentAmount(index, parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <Button size="icon" variant="ghost" onClick={() => removePayment(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Total Dibayar</span>
                  <span className="font-medium">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Kembalian</span>
                  <span className={changeAmount >= 0 ? 'text-primary' : 'text-destructive'}>
                    {formatCurrency(Math.max(0, changeAmount))}
                  </span>
                </div>
                {changeAmount < 0 && (
                  <p className="text-sm text-destructive">Kurang: {formatCurrency(Math.abs(changeAmount))}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Batal</Button>
              <Button onClick={processTransaction} disabled={isProcessing || totalPaid < grandTotal}>
                {isProcessing ? 'Memproses...' : 'Proses Transaksi'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Held Transactions Dialog */}
        <Dialog open={showHeldDialog} onOpenChange={setShowHeldDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transaksi Ditahan</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {heldTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Tidak ada transaksi ditahan</p>
              ) : (
                heldTransactions.map(held => (
                  <div key={held.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{held.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {held.items.length} item - {formatCurrency(held.items.reduce((s, i) => s + i.total, 0))}
                      </p>
                    </div>
                    <Button onClick={() => resumeTransaction(held)}>
                      <Play className="h-4 w-4 mr-1" />
                      Lanjutkan
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog - Improved Responsiveness */}
        <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Transaksi Berhasil
              </DialogTitle>
            </DialogHeader>
            {lastTransaction && (
              <div className="space-y-4">
                <div className="text-center py-6 bg-primary/5 rounded-lg border border-primary/10">
                  <p className="text-primary font-medium text-lg">{lastTransaction.transaction_number}</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(lastTransaction.total_amount)}</p>
                  {lastTransaction.change_amount > 0 && (
                    <p className="text-muted-foreground mt-2">Kembalian: <span className="font-semibold">{formatCurrency(lastTransaction.change_amount)}</span></p>
                  )}
                  {lastTransaction.promoName && (
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Tag className="h-3 w-3 text-primary" />
                      <span className="text-sm text-primary">{lastTransaction.promoName} (-{formatCurrency(lastTransaction.promoDiscount)})</span>
                    </div>
                  )}
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Anda dapat mencetak ulang nota kapan saja</p>
                </div>

                {/* Print Buttons Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-12" onClick={() => printReceipt('kitchen')}>
                    <ChefHat className="h-4 w-4 mr-2" />
                    Cetak Dapur
                  </Button>
                  <Button variant="outline" className="h-12" onClick={() => printReceipt('customer')}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Cetak Nota
                  </Button>
                </div>
                
                <Button className="w-full h-12" onClick={printAllReceipts}>
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Semua
                </Button>

                <div className="flex items-center justify-center gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => {
                    printReceipt('customer');
                    toast.success('Mencetak ulang nota...');
                  }}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Cetak Ulang
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" className="w-full" onClick={() => setShowReceiptDialog(false)}>
                Tutup & Transaksi Baru
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
};

export default POSDashboard;
