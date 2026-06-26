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

  const addItemToTable = async (product: any) => {
    if (!selectedTable) return;

    // Check if item already exists
    const existingItem = tableItems.find(i => i.product_id === product.id);
    
    if (existingItem) {
      // Update quantity
      const newQty = existingItem.quantity + 1;
      const total = newQty * existingItem.unit_price;
      
      await supabase
        .from('pos_open_table_items')
        .update({ quantity: newQty, total })
        .eq('id', existingItem.id);
    } else {
      // Add new item
      await supabase
        .from('pos_open_table_items')
        .insert({
          open_table_id: selectedTable.id,
          product_id: product.id,
          quantity: 1,
          unit_price: product.unit_price,
          cost_price: product.cost_price,
          total: product.unit_price
        });
    }

    await fetchTableItems(selectedTable.id);
    await updateTableTotals(selectedTable.id);
    toast.success(`${product.name} ditambahkan`);
  };

  const removeItemFromTable = async (itemId: string) => {
    if (!selectedTable) return;

    await supabase
      .from('pos_open_table_items')
      .delete()
      .eq('id', itemId);

    await fetchTableItems(selectedTable.id);
    await updateTableTotals(selectedTable.id);
    toast.success('Item dihapus');
  };

  const updateItemQuantity = async (itemId: string, delta: number) => {
    const item = tableItems.find(i => i.id === itemId);
    if (!item || !selectedTable) return;

    const newQty = Math.max(1, item.quantity + delta);
    const total = newQty * item.unit_price;

    await supabase
      .from('pos_open_table_items')
      .update({ quantity: newQty, total })
      .eq('id', itemId);

    await fetchTableItems(selectedTable.id);
    await updateTableTotals(selectedTable.id);
  };

  const updateTableTotals = async (tableId: string) => {
    const { data: items } = await supabase
      .from('pos_open_table_items')
      .select('total, cost_price, quantity')
      .eq('open_table_id', tableId);

    const subtotal = items?.reduce((sum, i) => sum + (i.total || 0), 0) || 0;
    const totalCogs = items?.reduce((sum, i) => sum + ((i.cost_price || 0) * (i.quantity || 0)), 0) || 0;

    await supabase
      .from('pos_open_tables')
      .update({
        subtotal,
        total_amount: subtotal,
        total_cogs: totalCogs
      })
      .eq('id', tableId);

    fetchOpenTables();
  };

  const closeTable = async (table: OpenTable) => {
    if (!confirm(`Tutup meja ${table.table_name}? Pastikan sudah dibayar melalui POS.`)) return;

    await supabase
      .from('pos_open_tables')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', table.id);

    toast.success('Meja ditutup');
    fetchOpenTables();
    setShowItemsDialog(false);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            {/* Add Item Button */}
            <div className="flex gap-2">
              <Button onClick={() => setShowAddItemDialog(true)} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Item
              </Button>
            </div>

            {/* Items Table */}
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
                    <TableHead></TableHead>
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
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateItemQuantity(item.id, -1)}>
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateItemQuantity(item.id, 1)}>
                            +
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItemFromTable(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(tableTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemsDialog(false)}>Tutup</Button>
            <Button variant="destructive" onClick={() => selectedTable && closeTable(selectedTable)}>
              <X className="h-4 w-4 mr-2" />
              Tutup Meja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Item ke {selectedTable?.table_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Cari produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {filteredProducts.map(product => (
                <Button
                  key={product.id}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-start text-left"
                  onClick={() => {
                    addItemToTable(product);
                    setShowAddItemDialog(false);
                    setSearchTerm('');
                  }}
                >
                  <span className="font-medium text-sm truncate w-full">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.sku}</span>
                  <span className="text-primary font-semibold">{formatCurrency(product.unit_price)}</span>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpenTables;
