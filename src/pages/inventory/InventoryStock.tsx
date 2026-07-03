import React, { useState, useEffect } from 'react';
import { Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useWarehouses } from '@/hooks/useWarehouses';
import { toast } from 'sonner';
import { formatNumber, formatCurrency } from '@/lib/formatters';

interface InventoryStockItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  product: {
    sku: string;
    name: string;
    unit: string;
    product_type: string;
    cost_price: number;
  };
  warehouse: {
    code: string;
    name: string;
  };
}

interface ProductSummary {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  total_quantity: number;
  warehouses: { warehouse_id: string; code: string; name: string; quantity: number }[];
}

const InventoryStock: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { warehouses } = useWarehouses();
  const [stockData, setStockData] = useState<InventoryStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');

  const fetchStock = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('inventory_stock')
      .select(`
        *,
        product:products(sku, name, unit, product_type, cost_price),
        warehouse:warehouses(code, name)
      `)
      .gt('quantity', 0);

    if (error) {
      toast.error('Gagal memuat data stok');
    } else {
      // Filter by company through warehouse
      const companyStock = (data || []).filter(item => {
        const wh = warehouses.find(w => w.id === item.warehouse_id);
        return wh?.company_id === selectedCompany.id;
      });
      setStockData(companyStock);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (warehouses.length > 0) {
      fetchStock();
    }
  }, [selectedCompany, warehouses]);

  const warehouseOptions = [
    { value: 'all', label: 'Semua Gudang' },
    ...warehouses.map(w => ({
      value: w.id,
      label: `${w.code} - ${w.name}`,
    })),
  ];

  const filteredStock = stockData.filter(item => {
    const matchesSearch = 
      item.product?.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = selectedWarehouse === 'all' || item.warehouse_id === selectedWarehouse;
    return matchesSearch && matchesWarehouse;
  });

  // Group by product for summary view
  const productSummary: ProductSummary[] = React.useMemo(() => {
    const summary: Record<string, ProductSummary> = {};
    
    filteredStock.forEach(item => {
      if (!summary[item.product_id]) {
        summary[item.product_id] = {
          product_id: item.product_id,
          sku: item.product?.sku || '',
          name: item.product?.name || '',
          unit: item.product?.unit || '',
          total_quantity: 0,
          warehouses: [],
        };
      }
      summary[item.product_id].total_quantity += item.quantity;
      summary[item.product_id].warehouses.push({
        warehouse_id: item.warehouse_id,
        code: item.warehouse?.code || '',
        name: item.warehouse?.name || '',
        quantity: item.quantity,
      });
    });
    
    return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredStock]);

  const totalItems = productSummary.length;
  const totalQuantity = productSummary.reduce((sum, p) => sum + p.total_quantity, 0);
  const totalValue = filteredStock.reduce((sum, item) => sum + (item.quantity * (item.product?.cost_price || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Inventory Stock</h1>
          <p className="text-muted-foreground mt-1">Monitor stok inventory per gudang</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Produk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">produk tersedia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalQuantity)}</div>
            <p className="text-xs text-muted-foreground">unit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nilai Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">berdasarkan cost price</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-64">
          <SearchableSelect
            options={warehouseOptions}
            value={selectedWarehouse}
            onChange={setSelectedWarehouse}
            placeholder="Filter gudang"
          />
        </div>
      </div>

      {/* Stock Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Unit</TableHead>
                {selectedWarehouse === 'all' && <TableHead>Distribusi Gudang</TableHead>}
                <TableHead className="text-right">Total Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="animate-pulse">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : productSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Tidak ada stok</p>
                  </TableCell>
                </TableRow>
              ) : (
                productSummary.map(product => (
                  <TableRow key={product.product_id}>
                    <TableCell className="font-mono">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    {selectedWarehouse === 'all' && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {product.warehouses.map(wh => (
                            <Badge key={wh.warehouse_id} variant="outline" className="text-xs">
                              {wh.code}: {formatNumber(wh.quantity)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right font-semibold">
                      {formatNumber(product.total_quantity)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryStock;
