// ESC/POS Command Library for Thermal Receipt Printers
// Supports: Epson TM-T82X, Star, and compatible printers

export const ESC = 0x1B;
export const GS = 0x1D;
export const LF = 0x0A;
export const CR = 0x0D;
export const CUT = [GS, 0x56, 0x00]; // Full cut
export const PARTIAL_CUT = [GS, 0x56, 0x01]; // Partial cut

// Text formatting
export const RESET = [ESC, 0x40]; // Initialize printer
export const ALIGN_LEFT = [ESC, 0x61, 0x00];
export const ALIGN_CENTER = [ESC, 0x61, 0x01];
export const ALIGN_RIGHT = [ESC, 0x61, 0x02];
export const BOLD_ON = [ESC, 0x45, 0x01];
export const BOLD_OFF = [ESC, 0x45, 0x00];
export const DOUBLE_HEIGHT = [ESC, 0x21, 0x10];
export const DOUBLE_WIDTH = [ESC, 0x21, 0x20];
export const DOUBLE_SIZE = [ESC, 0x21, 0x30];
export const NORMAL_SIZE = [ESC, 0x21, 0x00];

// Utility functions
export function textToBytes(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

export function createLine(char: string = '-', length: number = 48): number[] {
  return textToBytes(char.repeat(length) + '\n');
}

export function createTextLine(left: string, right: string, width: number = 48): string {
  const spaces = width - left.length - right.length;
  if (spaces < 1) {
    return left.substring(0, width - right.length - 1) + ' ' + right + '\n';
  }
  return left + ' '.repeat(spaces) + right + '\n';
}

export interface ReceiptData {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  headerText?: string;
  footerText?: string;
  transactionNumber: string;
  date: string;
  cashier?: string;
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
  }>;
  subtotal: number;
  discount?: number;
  tax?: number;
  taxLabel?: string;
  rounding?: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
  }>;
  change?: number;
  showLogo?: boolean;
  logoUrl?: string;
}

export interface KitchenOrderData {
  orderNumber: string;
  tableName?: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
  }>;
  notes?: string;
}

// Build receipt bytes
export function buildReceiptBytes(data: ReceiptData, paperWidth: '58mm' | '80mm' = '80mm'): Uint8Array {
  const width = paperWidth === '58mm' ? 32 : 48;
  const commands: number[] = [];
  
  // Initialize
  commands.push(...RESET);
  
  // Header - Company Info
  commands.push(...ALIGN_CENTER);
  
  if (data.companyName) {
    commands.push(...BOLD_ON);
    commands.push(...DOUBLE_SIZE);
    commands.push(...textToBytes(data.companyName + '\n'));
    commands.push(...NORMAL_SIZE);
    commands.push(...BOLD_OFF);
  }
  
  if (data.companyAddress) {
    commands.push(...textToBytes(data.companyAddress + '\n'));
  }
  
  if (data.companyPhone) {
    commands.push(...textToBytes(data.companyPhone + '\n'));
  }
  
  if (data.headerText) {
    commands.push(...textToBytes(data.headerText + '\n'));
  }
  
  // Separator
  commands.push(...createLine('=', width));
  
  // Transaction Info
  commands.push(...ALIGN_LEFT);
  commands.push(...textToBytes(`No: ${data.transactionNumber}\n`));
  commands.push(...textToBytes(`Tgl: ${data.date}\n`));
  if (data.cashier) {
    commands.push(...textToBytes(`Kasir: ${data.cashier}\n`));
  }
  if (data.customerName) {
    commands.push(...textToBytes(`Pelanggan: ${data.customerName}\n`));
  }
  
  // Separator
  commands.push(...createLine('-', width));
  
  // Items
  data.items.forEach(item => {
    // Item name (may wrap)
    commands.push(...textToBytes(item.name + '\n'));
    
    // Quantity x Price = Total
    const qtyPrice = `${item.quantity} x ${formatNumber(item.unitPrice)}${item.discount ? ` -${item.discount}%` : ''}`;
    const totalStr = formatNumber(item.total);
    commands.push(...textToBytes(createTextLine('  ' + qtyPrice, totalStr, width)));
  });
  
  // Separator
  commands.push(...createLine('-', width));
  
  // Totals
  commands.push(...textToBytes(createTextLine('Subtotal', formatNumber(data.subtotal), width)));
  
  if (data.discount && data.discount > 0) {
    commands.push(...textToBytes(createTextLine('Diskon', '-' + formatNumber(data.discount), width)));
  }
  
  if (data.tax && data.tax > 0) {
    const taxLabel = data.taxLabel ? `Pajak (${data.taxLabel})` : 'Pajak';
    commands.push(...textToBytes(createTextLine(taxLabel, formatNumber(data.tax), width)));
  }
  
  if (data.rounding && data.rounding > 0) {
    commands.push(...textToBytes(createTextLine('Pembulatan', '-' + formatNumber(data.rounding), width)));
  }
  
  // Grand Total
  commands.push(...BOLD_ON);
  commands.push(...DOUBLE_HEIGHT);
  commands.push(...textToBytes(createTextLine('TOTAL', formatNumber(data.total), width)));
  commands.push(...NORMAL_SIZE);
  commands.push(...BOLD_OFF);
  
  // Separator
  commands.push(...createLine('-', width));
  
  // Payments
  data.payments.forEach(payment => {
    commands.push(...textToBytes(createTextLine(payment.method, formatNumber(payment.amount), width)));
  });
  
  if (data.change !== undefined && data.change > 0) {
    commands.push(...textToBytes(createTextLine('Kembali', formatNumber(data.change), width)));
  }
  
  // Separator
  commands.push(...createLine('=', width));
  
  // Footer
  commands.push(...ALIGN_CENTER);
  if (data.footerText) {
    commands.push(...textToBytes(data.footerText + '\n'));
  } else {
    commands.push(...textToBytes('Terima kasih atas kunjungan Anda\n'));
    commands.push(...textToBytes('Barang yang sudah dibeli tidak dapat dikembalikan\n'));
  }
  
  // Feed and cut
  commands.push(LF, LF, LF);
  commands.push(...PARTIAL_CUT);
  
  return new Uint8Array(commands);
}

// Build kitchen order bytes
export function buildKitchenOrderBytes(data: KitchenOrderData, paperWidth: '58mm' | '80mm' = '80mm'): Uint8Array {
  const width = paperWidth === '58mm' ? 32 : 48;
  const commands: number[] = [];
  
  // Initialize
  commands.push(...RESET);
  
  // Header
  commands.push(...ALIGN_CENTER);
  commands.push(...BOLD_ON);
  commands.push(...DOUBLE_SIZE);
  commands.push(...textToBytes('ORDER DAPUR\n'));
  commands.push(...NORMAL_SIZE);
  commands.push(...BOLD_OFF);
  
  // Order Info
  commands.push(...ALIGN_LEFT);
  commands.push(...createLine('=', width));
  commands.push(...BOLD_ON);
  commands.push(...textToBytes(`No: ${data.orderNumber}\n`));
  if (data.tableName) {
    commands.push(...DOUBLE_HEIGHT);
    commands.push(...textToBytes(`Meja: ${data.tableName}\n`));
    commands.push(...NORMAL_SIZE);
  }
  commands.push(...BOLD_OFF);
  commands.push(...textToBytes(`Waktu: ${data.date}\n`));
  commands.push(...createLine('-', width));
  
  // Items
  data.items.forEach((item, index) => {
    commands.push(...BOLD_ON);
    commands.push(...DOUBLE_HEIGHT);
    commands.push(...textToBytes(`${item.quantity}x ${item.name}\n`));
    commands.push(...NORMAL_SIZE);
    commands.push(...BOLD_OFF);
    
    if (item.notes) {
      commands.push(...textToBytes(`   >> ${item.notes}\n`));
    }
    
    if (index < data.items.length - 1) {
      commands.push(...textToBytes('\n'));
    }
  });
  
  // Notes
  if (data.notes) {
    commands.push(...createLine('-', width));
    commands.push(...BOLD_ON);
    commands.push(...textToBytes(`CATATAN: ${data.notes}\n`));
    commands.push(...BOLD_OFF);
  }
  
  // End
  commands.push(...createLine('=', width));
  
  // Feed and cut
  commands.push(LF, LF, LF);
  commands.push(...PARTIAL_CUT);
  
  return new Uint8Array(commands);
}

function formatNumber(num: number): string {
  return num.toLocaleString('id-ID');
}

// Printer connection types
export type PrinterConnectionType = 'web_usb' | 'web_serial' | 'web_bluetooth' | 'network';

export interface PrinterConfig {
  connectionType: PrinterConnectionType;
  vendorId?: string;
  productId?: string;
  ipAddress?: string;
  port?: number;
  paperWidth: '58mm' | '80mm';
}

// Type declarations for Web APIs
declare global {
  interface Navigator {
    usb?: {
      getDevices(): Promise<any[]>;
      requestDevice(options: { filters: Array<{ vendorId?: number; productId?: number }> }): Promise<any>;
    };
    serial?: {
      getPorts(): Promise<any[]>;
      requestPort(): Promise<any>;
    };
  }
}

// USB Printer Class
class USBPrinter {
  private device: any = null;
  private endpoint: number = 0;

  async connect(vendorId: number, productId: number): Promise<boolean> {
    try {
      if (!navigator.usb) {
        console.error('Web USB not supported');
        return false;
      }
      const devices = await navigator.usb.getDevices();
      this.device = devices.find(d => d.vendorId === vendorId && d.productId === productId) || null;
      
      if (!this.device) {
        this.device = await navigator.usb.requestDevice({
          filters: [{ vendorId, productId }]
        });
      }
      
      await this.device.open();
      await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);
      
      // Find OUT endpoint
      const iface = this.device.configuration?.interfaces[0];
      const alt = iface?.alternates[0];
      const ep = alt?.endpoints.find(e => e.direction === 'out');
      if (ep) {
        this.endpoint = ep.endpointNumber;
      }
      
      return true;
    } catch (error) {
      console.error('USB connect error:', error);
      return false;
    }
  }

  async print(data: Uint8Array): Promise<boolean> {
    if (!this.device) return false;
    
    try {
      await this.device.transferOut(this.endpoint, data);
      return true;
    } catch (error) {
      console.error('USB print error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }
}

// Serial Printer Class
class SerialPrinter {
  private port: any = null;
  private writer: any = null;

  async connect(): Promise<boolean> {
    try {
      if (!navigator.serial) {
        console.error('Web Serial not supported');
        return false;
      }
      
      const ports = await navigator.serial.getPorts();
      this.port = ports[0] || null;
      
      if (!this.port) {
        this.port = await navigator.serial.requestPort();
      }
      
      await this.port.open({ baudRate: 9600 });
      this.writer = this.port.writable?.getWriter() || null;
      
      return true;
    } catch (error) {
      console.error('Serial connect error:', error);
      return false;
    }
  }

  async print(data: Uint8Array): Promise<boolean> {
    if (!this.writer) return false;
    
    try {
      await this.writer.write(data);
      return true;
    } catch (error) {
      console.error('Serial print error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }
}

// Network Printer (raw socket via fetch - limited browser support)
class NetworkPrinter {
  private ipAddress: string = '';
  private port: number = 9100;

  configure(ipAddress: string, port: number = 9100): void {
    this.ipAddress = ipAddress;
    this.port = port;
  }

  async print(data: Uint8Array): Promise<boolean> {
    // Browser security prevents raw TCP socket connections
    // Network printing typically requires:
    // 1. A local print server/proxy
    // 2. The printer to support HTTP/IPP
    // 3. A browser extension
    
    // For now, we'll try a simple HTTP POST approach
    // This works if the printer has a web interface that accepts raw data
    try {
      // Convert Uint8Array to regular array for Blob compatibility
      const blob = new Blob([new Uint8Array(Array.from(data))], { type: 'application/octet-stream' });
      
      await fetch(`http://${this.ipAddress}:${this.port}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
        mode: 'no-cors', // Required for cross-origin requests
      });
      
      // With no-cors, we can't check the response status
      // We assume success if no error is thrown
      return true;
    } catch (error) {
      console.error('Network print error:', error);
      // Fallback: Show instructions for network printing
      console.warn('Network printing from browser requires a print proxy. Consider using USB or Bluetooth for direct printing.');
      return false;
    }
  }
}

// Main Printer Service
export class ThermalPrinterService {
  private usbPrinter = new USBPrinter();
  private serialPrinter = new SerialPrinter();
  private networkPrinter = new NetworkPrinter();
  
  async printReceipt(config: PrinterConfig, receiptData: ReceiptData): Promise<boolean> {
    const bytes = buildReceiptBytes(receiptData, config.paperWidth);
    return this.sendToPrinter(config, bytes);
  }
  
  async printKitchenOrder(config: PrinterConfig, orderData: KitchenOrderData): Promise<boolean> {
    const bytes = buildKitchenOrderBytes(orderData, config.paperWidth);
    return this.sendToPrinter(config, bytes);
  }
  
  async printRaw(config: PrinterConfig, data: Uint8Array): Promise<boolean> {
    return this.sendToPrinter(config, data);
  }
  
  private async sendToPrinter(config: PrinterConfig, data: Uint8Array): Promise<boolean> {
    switch (config.connectionType) {
      case 'web_usb':
        if (config.vendorId && config.productId) {
          const vendorId = parseInt(config.vendorId, 16);
          const productId = parseInt(config.productId, 16);
          const connected = await this.usbPrinter.connect(vendorId, productId);
          if (connected) {
            const result = await this.usbPrinter.print(data);
            await this.usbPrinter.disconnect();
            return result;
          }
        }
        return false;
        
      case 'web_serial':
        const serialConnected = await this.serialPrinter.connect();
        if (serialConnected) {
          const result = await this.serialPrinter.print(data);
          await this.serialPrinter.disconnect();
          return result;
        }
        return false;
        
      case 'network':
        if (config.ipAddress) {
          this.networkPrinter.configure(config.ipAddress, config.port || 9100);
          return this.networkPrinter.print(data);
        }
        return false;
        
      case 'web_bluetooth':
        // Bluetooth printing is more complex and printer-specific
        // Would need specific service UUIDs for each printer model
        console.warn('Bluetooth printing not fully implemented yet');
        return false;
        
      default:
        return false;
    }
  }
  
  // Test print - sends a simple test receipt
  async testPrint(config: PrinterConfig): Promise<boolean> {
    const testReceipt: ReceiptData = {
      companyName: 'TEST PRINT',
      transactionNumber: 'TEST-001',
      date: new Date().toLocaleString('id-ID'),
      items: [
        { name: 'Test Item', quantity: 1, unitPrice: 10000, total: 10000 }
      ],
      subtotal: 10000,
      total: 10000,
      payments: [{ method: 'Cash', amount: 10000 }]
    };
    
    return this.printReceipt(config, testReceipt);
  }
}

// Singleton instance
export const thermalPrinter = new ThermalPrinterService();
