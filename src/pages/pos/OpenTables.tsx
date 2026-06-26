import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ShoppingCart, Users, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface OpenTable {
  id: string;
  table_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  opened_at: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
}

interface TableItem {
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
  notes: string | null;
  products?: { name: string; sku: string };
}

const OpenTables = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [openTables, setOpenTables] = useState<OpenTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<OpenTable | null>(null);
  const [tableItems, setTableItems] = useState<TableItem[]>([]);

  // New table form
  const [newTableName, setNewTableName] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const fetchOpenTables = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pos_open_tables')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });
    
    if (!error) {
      setOpenTables(data || []);
    }
    setIsLoading(false);
  };

  const fetchTableItems = async (tableId: string) => {
    const { data, error } = await supabase
      .from('pos_open_table_items')
      .select('*, products(name, sku)')
      .eq('open_table_id', tableId)
      .order('created_at');
    
    if (!error) {
      setTableItems(data || []);
    }
  };

  useEffect(() => {
    fetchOpenTables();
  }, [selectedCompany]);

  const createTable = async () => {
    if (!selectedCompany || !newTableName.trim()) {
      toast.error('Nama meja wajib diisi');
      return;
    }

    const { error } = await supabase
      .from('pos_open_tables')
      .insert({
        company_id: selectedCompany.id,
        table_name: newTableName.trim(),
        customer_name: newCustomerName.trim() || null,
        customer_phone: newCustomerPhone.trim() || null,
        created_by: user?.id,
        status: 'open'
      });

    if (error) {
      toast.error('Gagal membuat meja: ' + error.message);
      return;
    }

    toast.success('Meja berhasil dibuat');
    setShowCreateDialog(false);
    setNewTableName('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    fetchOpenTables();
  };

  const viewTableItems = async (table: OpenTable) => {
    setSelectedTable(table);
    await fetchTableItems(table.id);
    setShowItemsDialog(true);
  };

  const openInPOS = (table: OpenTable) => {
    setShowItemsDialog(false);
    navigate(`/pos?openTableId=${table.id}`);
  };

  const tableTotal = tableItems.reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Open Table</h1>
          <p className="text-muted-foreground">Kelola pesanan meja yang masih berlangsung</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buka Meja Baru
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Memuat...</div>
      ) : openTables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Tidak ada meja yang sedang buka</p>
            <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Buka Meja Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {openTables.map(table => (
            <Card key={table.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => viewTableItems(table)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{table.table_name}</CardTitle>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Aktif
                  </Badge>
                </div>
                {table.customer_name && (
                  <CardDescription>{table.customer_name}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dibuka:</span>
                    <span>{format(new Date(table.opened_at), 'HH:mm', { locale: id })}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(table.total_amount || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Table Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buka Meja Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Meja *</Label>
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Contoh: Meja 1, VIP Room, dll"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Pelanggan</Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Opsional"
              />
            </div>
            <div className="space-y-2">
              <Label>No. Telepon</Label>
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Opsional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
            <Button onClick={createTable}>Buka Meja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Items Dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{selectedTable?.table_name}</DialogTitle>
                {selectedTable?.customer_name && (
                  <p className="text-sm text-muted-foreground">{selectedTable.customer_name}</p>
                )}
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Aktif
              </Badge>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* CTA: items must be added via POS */}
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Penambahan item & pembayaran sekarang dilakukan langsung di POS.
              Klik <strong>Buka di POS</strong> untuk lanjut. Meja akan otomatis ditutup setelah pembayaran selesai.
            </div>

            <div className="flex gap-2">
              <Button onClick={() => selectedTable && openInPOS(selectedTable)} className="flex-1">
                <ArrowRight className="h-4 w-4 mr-2" />
                Buka di POS
              </Button>
            </div>

            {/* Items snapshot (read-only) */}
            {tableItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2" />
                <p>Belum ada pesanan</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.products?.name}</p>
                          <p className="text-xs text-muted-foreground">{item.products?.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(tableTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemsDialog(false)}>Batal</Button>
            <Button onClick={() => selectedTable && openInPOS(selectedTable)}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Lanjut Bayar di POS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpenTables;
