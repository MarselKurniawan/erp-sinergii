import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, Printer, ChefHat, Receipt, Usb, Bluetooth, Wifi, AlertCircle, CheckCircle2, RefreshCw, Link2, Play } from 'lucide-react';
import { toast } from 'sonner';
import NetworkPrinterForm from '@/components/pos/NetworkPrinterForm';

interface PrinterSetting {
  id: string;
  name: string;
  printer_type: string;
  connection_type: string;
  device_name: string | null;
  vendor_id: string | null;
  product_id: string | null;
  ip_address: string | null;
  port: number | null;
  paper_width: string;
  is_kitchen_printer: boolean;
  is_cashier_printer: boolean;
  is_active: boolean;
  last_connected_at: string | null;
}

interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
}

const defaultPrinterSettings: Omit<PrinterSetting, 'id'> = {
  name: '',
  printer_type: 'usb',
  connection_type: 'web_usb',
  device_name: null,
  vendor_id: null,
  product_id: null,
  ip_address: null,
  port: 9100,
  paper_width: '80mm',
  is_kitchen_printer: false,
  is_cashier_printer: false,
  is_active: true,
  last_connected_at: null
};

// Known thermal printer vendor IDs
const KNOWN_THERMAL_PRINTERS = [
  { vendorId: 0x04B8, name: 'Epson' }, // Epson (TM-T82X, etc.)
  { vendorId: 0x0519, name: 'Star Micronics' },
  { vendorId: 0x0DD4, name: 'Custom' },
  { vendorId: 0x0416, name: 'Winbond' },
  { vendorId: 0x0FE6, name: 'ICS Advent' },
  { vendorId: 0x154F, name: 'SNBC' },
  { vendorId: 0x0483, name: 'STMicroelectronics' }, // Some Chinese printers
];

const PrinterSettings = () => {
  const { selectedCompany } = useCompany();
  const { testPrint, isPrinting } = useThermalPrinter();
  const [printers, setPrinters] = useState<PrinterSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterSetting | null>(null);
  const [formData, setFormData] = useState<Omit<PrinterSetting, 'id'>>(defaultPrinterSettings);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<USBDevice | null>(null);
  const [usbSupported, setUsbSupported] = useState(false);
  const [serialSupported, setSerialSupported] = useState(false);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);

  useEffect(() => {
    // Check browser support
    setUsbSupported('usb' in navigator);
    setSerialSupported('serial' in navigator);
    setBluetoothSupported('bluetooth' in navigator);
  }, []);

  const fetchPrinters = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('name');

    if (error) {
      toast.error('Gagal memuat data printer');
    } else {
      setPrinters(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPrinters();
  }, [selectedCompany]);

  const handleOpenDialog = (printer?: PrinterSetting) => {
    if (printer) {
      setEditingPrinter(printer);
      setFormData({
        name: printer.name,
        printer_type: printer.printer_type,
        connection_type: printer.connection_type,
        device_name: printer.device_name,
        vendor_id: printer.vendor_id,
        product_id: printer.product_id,
        ip_address: printer.ip_address,
        port: printer.port,
        paper_width: printer.paper_width,
        is_kitchen_printer: printer.is_kitchen_printer,
        is_cashier_printer: printer.is_cashier_printer,
        is_active: printer.is_active,
        last_connected_at: printer.last_connected_at
      });
      if (printer.vendor_id && printer.product_id) {
        setConnectedDevice({
          vendorId: parseInt(printer.vendor_id, 16),
          productId: parseInt(printer.product_id, 16),
          productName: printer.device_name || undefined
        });
      }
    } else {
      setEditingPrinter(null);
      setFormData(defaultPrinterSettings);
      setConnectedDevice(null);
    }
    setShowDialog(true);
  };

  const connectUSBPrinter = async () => {
    if (!('usb' in navigator)) {
      toast.error('Browser tidak mendukung Web USB. Gunakan Chrome/Edge.');
      return;
    }

    setIsConnecting(true);
    try {
      // @ts-ignore - Web USB API
      const device = await navigator.usb.requestDevice({
        filters: KNOWN_THERMAL_PRINTERS.map(p => ({ vendorId: p.vendorId }))
      });

      await device.open();
      
      const deviceInfo: USBDevice = {
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName,
        manufacturerName: device.manufacturerName
      };

      setConnectedDevice(deviceInfo);
      setFormData(prev => ({
        ...prev,
        vendor_id: device.vendorId.toString(16).toUpperCase().padStart(4, '0'),
        product_id: device.productId.toString(16).toUpperCase().padStart(4, '0'),
        device_name: device.productName || device.manufacturerName || 'USB Printer',
        connection_type: 'web_usb'
      }));

      await device.close();
      toast.success('Printer USB berhasil terdeteksi!');
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        toast.error('Gagal menghubungkan printer: ' + error.message);
      }
    }
    setIsConnecting(false);
  };

  const connectSerialPrinter = async () => {
    if (!('serial' in navigator)) {
      toast.error('Browser tidak mendukung Web Serial. Gunakan Chrome/Edge.');
      return;
    }

    setIsConnecting(true);
    try {
      // @ts-ignore - Web Serial API
      const port = await navigator.serial.requestPort();
      const info = port.getInfo();

      setConnectedDevice({
        vendorId: info.usbVendorId || 0,
        productId: info.usbProductId || 0,
        productName: 'Serial Printer'
      });

      setFormData(prev => ({
        ...prev,
        vendor_id: (info.usbVendorId || 0).toString(16).toUpperCase().padStart(4, '0'),
        product_id: (info.usbProductId || 0).toString(16).toUpperCase().padStart(4, '0'),
        device_name: 'Serial Printer (COM)',
        connection_type: 'web_serial'
      }));

      toast.success('Printer Serial berhasil terdeteksi!');
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        toast.error('Gagal menghubungkan printer: ' + error.message);
      }
    }
    setIsConnecting(false);
  };

  const connectBluetoothPrinter = async () => {
    if (!('bluetooth' in navigator)) {
      toast.error('Browser tidak mendukung Web Bluetooth. Gunakan Chrome/Edge.');
      return;
    }

    setIsConnecting(true);
    try {
      // @ts-ignore - Web Bluetooth API
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });

      setConnectedDevice({
        vendorId: 0,
        productId: 0,
        productName: device.name
      });

      setFormData(prev => ({
        ...prev,
        device_name: device.name || 'Bluetooth Printer',
        connection_type: 'web_bluetooth'
      }));

      toast.success('Printer Bluetooth berhasil terdeteksi!');
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        toast.error('Gagal menghubungkan printer: ' + error.message);
      }
    }
    setIsConnecting(false);
  };

  const handleSave = async () => {
    if (!selectedCompany || !formData.name) {
      toast.error('Nama printer harus diisi');
      return;
    }

    const payload = {
      ...formData,
      company_id: selectedCompany.id,
      last_connected_at: connectedDevice ? new Date().toISOString() : formData.last_connected_at
    };

    if (editingPrinter) {
      const { error } = await supabase
        .from('printer_settings')
        .update(payload)
        .eq('id', editingPrinter.id);

      if (error) {
        toast.error('Gagal mengupdate printer');
        return;
      }
      toast.success('Printer berhasil diupdate');
    } else {
      const { error } = await supabase
        .from('printer_settings')
        .insert(payload);

      if (error) {
        toast.error('Gagal menambah printer');
        return;
      }
      toast.success('Printer berhasil ditambah');
    }

    setShowDialog(false);
    fetchPrinters();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus printer ini?')) return;

    const { error } = await supabase
      .from('printer_settings')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Gagal menghapus printer');
      return;
    }

    toast.success('Printer berhasil dihapus');
    fetchPrinters();
  };

  const handleToggleActive = async (printer: PrinterSetting) => {
    const { error } = await supabase
      .from('printer_settings')
      .update({ is_active: !printer.is_active })
      .eq('id', printer.id);

    if (!error) {
      fetchPrinters();
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'web_usb':
      case 'web_serial':
        return <Usb className="h-4 w-4" />;
      case 'web_bluetooth':
        return <Bluetooth className="h-4 w-4" />;
      case 'network':
        return <Wifi className="h-4 w-4" />;
      default:
        return <Printer className="h-4 w-4" />;
    }
  };

  const getConnectionLabel = (type: string) => {
    switch (type) {
      case 'web_usb': return 'USB';
      case 'web_serial': return 'Serial';
      case 'web_bluetooth': return 'Bluetooth';
      case 'network': return 'Network';
      default: return type;
    }
  };

  const getPrinterRole = (printer: PrinterSetting) => {
    const roles = [];
    if (printer.is_kitchen_printer) roles.push('Dapur');
    if (printer.is_cashier_printer) roles.push('Kasir');
    return roles.length > 0 ? roles.join(', ') : '-';
  };

  const handleTestPrint = async (printerId: string) => {
    setTestingPrinterId(printerId);
    await testPrint(printerId);
    setTestingPrinterId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pengaturan Printer</h1>
        <p className="text-muted-foreground">Kelola printer untuk kasir dan dapur</p>
      </div>

      {/* Browser Support Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Dukungan Browser:</strong>{' '}
          <span className={usbSupported ? 'text-green-600' : 'text-destructive'}>
            USB {usbSupported ? '✓' : '✗'}
          </span>{' | '}
          <span className={serialSupported ? 'text-green-600' : 'text-destructive'}>
            Serial {serialSupported ? '✓' : '✗'}
          </span>{' | '}
          <span className={bluetoothSupported ? 'text-green-600' : 'text-destructive'}>
            Bluetooth {bluetoothSupported ? '✓' : '✗'}
          </span>
          {' '}— Gunakan Chrome/Edge untuk dukungan penuh.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daftar Printer</CardTitle>
              <CardDescription>
                Hubungkan printer thermal untuk kasir dan dapur
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Printer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Memuat...</p>
          ) : printers.length === 0 ? (
            <div className="text-center py-8">
              <Printer className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Belum ada printer terdaftar</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Printer Pertama
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Printer</TableHead>
                  <TableHead>Koneksi</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Kertas</TableHead>
                  <TableHead>Fungsi</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printers.map(printer => (
                  <TableRow key={printer.id}>
                    <TableCell className="font-medium">{printer.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {getConnectionIcon(printer.connection_type)}
                        {getConnectionLabel(printer.connection_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {printer.device_name || '-'}
                    </TableCell>
                    <TableCell>{printer.paper_width}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {printer.is_kitchen_printer && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <ChefHat className="h-3 w-3" /> Dapur
                          </Badge>
                        )}
                        {printer.is_cashier_printer && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Receipt className="h-3 w-3" /> Kasir
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={printer.is_active}
                        onCheckedChange={() => handleToggleActive(printer)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleTestPrint(printer.id)}
                          disabled={testingPrinterId === printer.id || isPrinting}
                          title="Test Print"
                        >
                          {testingPrinterId === printer.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 text-primary" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(printer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(printer.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPrinter ? 'Edit' : 'Tambah'} Printer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Printer</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Printer Dapur TMT-82X"
              />
            </div>

            <div className="space-y-2">
              <Label>Jenis Koneksi</Label>
              <Select 
                value={formData.printer_type} 
                onValueChange={(v) => setFormData({ ...formData, printer_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usb">
                    <span className="flex items-center gap-2">
                      <Usb className="h-4 w-4" /> USB / Serial (TMT-82X)
                    </span>
                  </SelectItem>
                  <SelectItem value="bluetooth">
                    <span className="flex items-center gap-2">
                      <Bluetooth className="h-4 w-4" /> Bluetooth Mobile
                    </span>
                  </SelectItem>
                  <SelectItem value="network">
                    <span className="flex items-center gap-2">
                      <Wifi className="h-4 w-4" /> Network (IP)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* USB/Serial Connection */}
            {formData.printer_type === 'usb' && (
              <div className="space-y-3">
                <Label>Hubungkan Printer</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={connectUSBPrinter}
                    disabled={isConnecting || !usbSupported}
                    className="flex-1"
                  >
                    {isConnecting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Usb className="h-4 w-4 mr-2" />
                    )}
                    Scan USB
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={connectSerialPrinter}
                    disabled={isConnecting || !serialSupported}
                    className="flex-1"
                  >
                    {isConnecting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Scan Serial
                  </Button>
                </div>
                
                {connectedDevice && (
                  <Alert className="border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <strong>Terdeteksi:</strong> {connectedDevice.productName || 'Printer'}<br />
                      <span className="text-xs text-muted-foreground">
                        VID: {formData.vendor_id} | PID: {formData.product_id}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-muted-foreground">
                  Untuk Epson TMT-82X, pastikan printer terhubung via USB dan driver terinstall.
                </p>
              </div>
            )}

            {/* Bluetooth Connection */}
            {formData.printer_type === 'bluetooth' && (
              <div className="space-y-3">
                <Label>Hubungkan Printer Bluetooth</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={connectBluetoothPrinter}
                  disabled={isConnecting || !bluetoothSupported}
                  className="w-full"
                >
                  {isConnecting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bluetooth className="h-4 w-4 mr-2" />
                  )}
                  Scan Bluetooth
                </Button>
                
                {connectedDevice && (
                  <Alert className="border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <strong>Terdeteksi:</strong> {connectedDevice.productName || 'Bluetooth Printer'}
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-muted-foreground">
                  Pastikan Bluetooth printer sudah di-pair dengan perangkat.
                </p>
              </div>
            )}

            {/* Network Connection */}
            {formData.printer_type === 'network' && (
              <NetworkPrinterForm
                ipAddress={formData.ip_address || ''}
                port={formData.port || 9100}
                onIpChange={(ip) => setFormData({ ...formData, ip_address: ip })}
                onPortChange={(port) => setFormData({ ...formData, port })}
              />
            )}

            <div className="space-y-2">
              <Label>Lebar Kertas</Label>
              <Select 
                value={formData.paper_width} 
                onValueChange={(v) => setFormData({ ...formData, paper_width: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (Thermal Kecil)</SelectItem>
                  <SelectItem value="80mm">80mm (Thermal Standar - TMT-82X)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Fungsi Printer</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_kitchen_printer}
                    onCheckedChange={(v) => setFormData({ ...formData, is_kitchen_printer: v })}
                  />
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <ChefHat className="h-4 w-4" /> Printer Dapur (Kitchen Order)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_cashier_printer}
                    onCheckedChange={(v) => setFormData({ ...formData, is_cashier_printer: v })}
                  />
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Receipt className="h-4 w-4" /> Printer Kasir (Nota Pelanggan)
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleSave}>
              {editingPrinter ? 'Update' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrinterSettings;
