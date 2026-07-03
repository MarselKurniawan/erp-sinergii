import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface StockMovement {
  id: string;
  date: string;
  type: 'in' | 'out' | 'transfer';
  product: string;
  quantity: number;
  reference: string;
  warehouse: string;
}

export const InventoryReport: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filterType, setFilterType] = useState<string>('all');

  const fetchStockData = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    // Get current stock by warehouse
    const { data: stock } = await supabase
      .from('inventory_stock')
      .select(`
        id, quantity,
        product:products(id, sku, name, unit, cost_price),
        warehouse:warehouses(id, name, code)
      `)
      .eq('warehouse.company_id', selectedCompany.id);

    // Get stock transfers as movements
    const { data: transfers } = await supabase
      .from('stock_transfers')
      .select(`
        id, transfer_number, transfer_date, status,
        from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(name),
        to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(name),
        items:stock_transfer_items(
          quantity,
          product:products(name)
        )
      `)
      .eq('company_id', selectedCompany.id)
      .gte('transfer_date', dateFrom)
      .lte('transfer_date', dateTo)
      .eq('status', 'completed');

    setStockData(stock || []);

    // Transform transfers to movements
    const movementItems: StockMovement[] = [];
    (transfers || []).forEach((t: any) => {
      (t.items || []).forEach((item: any) => {
        movementItems.push({
          id: `${t.id}-${item.product?.name}`,
          date: t.transfer_date,
          type: 'transfer',
          product: item.product?.name || '',
          quantity: item.quantity,
          reference: t.transfer_number,
          warehouse: `${t.from_warehouse?.name} → ${t.to_warehouse?.name}`,
        });
      });
    });

    setMovements(movementItems);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStockData();
  }, [selectedCompany, dateFrom, dateTo]);

  const totalStockValue = stockData.reduce((sum, s) => {
    const qty = s.quantity || 0;
    const cost = s.product?.cost_price || 0;
    return sum + (qty * cost);
  }, 0);

  const totalItems = stockData.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const uniqueProducts = new Set(stockData.map(s => s.product?.id)).size;

  const filteredMovements = movements.filter(m =>
    filterType === 'all' || m.type === filterType
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Inventory Report</h1>
        <p className="text-muted-foreground mt-1">Laporan stok dan pergerakan barang</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="w-10 h-10 text-primary/20" />
              <div>
                <p className="text-sm text-muted-foreground">Unique Products</p>
                <p className="text-2xl font-bold">{uniqueProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="w-10 h-10 text-success/20" />
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{totalItems.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="w-10 h-10 text-warning/20" />
              <div>
                <p className="text-sm text-muted-foreground">Stock Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalStockValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <ArrowRightLeft className="w-10 h-10 text-primary/20" />
              <div>
                <p className="text-sm text-muted-foreground">Movements</p>
                <p className="text-2xl font-bold">{movements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Stock */}
      <Card>
        <CardHeader>
          <CardTitle>Current Stock by Warehouse</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : stockData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Belum ada data stok
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Warehouse</th>
                    <th>Unit</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono text-sm">{item.product?.sku}</td>
                      <td>{item.product?.name}</td>
                      <td>{item.warehouse?.name}</td>
                      <td>{item.product?.unit}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.product?.cost_price || 0)}</td>
                      <td className="text-right font-medium">
                        {formatCurrency((item.quantity || 0) * (item.product?.cost_price || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Movements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stock Movements</CardTitle>
            <div className="flex gap-4 items-end">
              <div>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
              </div>
              <div>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="out">Out</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada pergerakan stok dalam periode ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Reference</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Warehouse</th>
                    <th className="text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((mov) => (
                    <tr key={mov.id}>
                      <td>{formatDate(mov.date)}</td>
                      <td className="font-mono text-sm">{mov.reference}</td>
                      <td>{mov.product}</td>
                      <td>
                        <span className={`badge-status ${
                          mov.type === 'in' ? 'bg-success/10 text-success' :
                          mov.type === 'out' ? 'bg-destructive/10 text-destructive' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {mov.type.toUpperCase()}
                        </span>
                      </td>
                      <td>{mov.warehouse}</td>
                      <td className="text-right font-medium">{mov.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryReport;
