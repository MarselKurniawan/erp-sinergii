import React, { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface ParsedProduct {
  sku: string;
  name: string;
  product_type: 'stockable' | 'service' | 'raw_material';
  unit_price: number;
  unit: string;
  isValid: boolean;
  errors: string[];
  rowIndex: number;
}

interface ProductCSVImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

export const ProductCSVImport: React.FC<ProductCSVImportProps> = ({
  open,
  onOpenChange,
  onImportSuccess,
}) => {
  const { selectedCompany } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  const downloadTemplate = () => {
    const headers = ['Kode Barang', 'Nama Barang', 'Jenis Barang', 'Harga Jual Satuan'];
    const sampleData = [
      ['PRD-001', 'Nasi Goreng Seafood', 'Persediaan', '35000'],
      ['PRD-002', 'Es Teh Manis', 'Persediaan', '8000'],
      ['SVC-001', 'Jasa Delivery', 'Non Persediaan', '10000'],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_import_produk.csv';
    link.click();
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const parseProductType = (value: string): 'stockable' | 'service' | 'raw_material' => {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'persediaan' || normalized === 'stockable' || normalized === 'stok') {
      return 'stockable';
    }
    if (normalized === 'non persediaan' || normalized === 'service' || normalized === 'jasa') {
      return 'service';
    }
    if (normalized === 'raw material' || normalized === 'bahan baku' || normalized === 'raw_material') {
      return 'raw_material';
    }
    return 'stockable'; // default
  };

  const parsePrice = (value: string): number => {
    // Remove currency symbols, dots (thousands separator), and spaces
    const cleaned = value.replace(/[Rp.\s]/gi, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length < 2) {
        toast.error('File CSV kosong atau hanya berisi header');
        setIsProcessing(false);
        return;
      }

      // Skip header row
      const dataRows = rows.slice(1);
      const parsed: ParsedProduct[] = dataRows.map((row, index) => {
        const errors: string[] = [];
        
        const sku = row[0]?.trim() || '';
        const name = row[1]?.trim() || '';
        const productTypeStr = row[2]?.trim() || 'Persediaan';
        const priceStr = row[3]?.trim() || '0';

        if (!sku) errors.push('Kode Barang wajib diisi');
        if (!name) errors.push('Nama Barang wajib diisi');

        const product_type = parseProductType(productTypeStr);
        const unit_price = parsePrice(priceStr);

        return {
          sku,
          name,
          product_type,
          unit_price,
          unit: 'pcs', // default unit
          isValid: errors.length === 0,
          errors,
          rowIndex: index + 2, // +2 because of 0-index and header row
        };
      }).filter(p => p.sku || p.name); // Filter out completely empty rows

      setParsedProducts(parsed);
      setImportStep('preview');
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Gagal membaca file CSV');
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!selectedCompany) return;

    const validProducts = parsedProducts.filter(p => p.isValid);
    if (validProducts.length === 0) {
      toast.error('Tidak ada data valid untuk diimport');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failedCount = 0;

    // Check for existing SKUs
    const skus = validProducts.map(p => p.sku);
    const { data: existingProducts } = await supabase
      .from('products')
      .select('sku')
      .eq('company_id', selectedCompany.id)
      .in('sku', skus);

    const existingSkus = new Set(existingProducts?.map(p => p.sku) || []);

    for (const product of validProducts) {
      if (existingSkus.has(product.sku)) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: product.name,
            product_type: product.product_type,
            unit_price: product.unit_price,
            unit: product.unit,
          })
          .eq('company_id', selectedCompany.id)
          .eq('sku', product.sku);

        if (error) {
          failedCount++;
        } else {
          successCount++;
        }
      } else {
        // Insert new product
        const { error } = await supabase
          .from('products')
          .insert({
            company_id: selectedCompany.id,
            sku: product.sku,
            name: product.name,
            product_type: product.product_type,
            unit_price: product.unit_price,
            cost_price: 0,
            unit: product.unit,
            stock_quantity: 0,
            is_active: true,
          });

        if (error) {
          failedCount++;
        } else {
          successCount++;
        }
      }
    }

    setImportResult({ success: successCount, failed: failedCount });
    setImportStep('result');
    setIsProcessing(false);

    if (successCount > 0) {
      onImportSuccess();
    }
  };

  const resetImport = () => {
    setParsedProducts([]);
    setImportStep('upload');
    setImportResult({ success: 0, failed: 0 });
  };

  const handleClose = () => {
    resetImport();
    onOpenChange(false);
  };

  const validCount = parsedProducts.filter(p => p.isValid).length;
  const invalidCount = parsedProducts.filter(p => !p.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Produk dari CSV
          </DialogTitle>
        </DialogHeader>

        {importStep === 'upload' && (
          <div className="space-y-6 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Format CSV yang didukung: Kode Barang, Nama Barang, Jenis Barang (Persediaan/Non Persediaan), Harga Jual Satuan
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-lg font-medium">Upload File CSV</p>
                <p className="text-sm text-muted-foreground">
                  Pilih file CSV atau drag & drop ke sini
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Pilih File
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {importStep === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Badge variant="outline" className="text-primary border-primary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validCount} Valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {invalidCount} Error
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={resetImport}>
                <X className="h-4 w-4 mr-1" />
                Batal
              </Button>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Baris</TableHead>
                    <TableHead>Kode Barang</TableHead>
                    <TableHead>Nama Barang</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Harga Jual Satuan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedProducts.map((product, index) => (
                    <TableRow key={index} className={!product.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell className="text-muted-foreground">{product.rowIndex}</TableCell>
                      <TableCell className="font-mono">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {product.product_type === 'stockable' ? 'Persediaan' : 
                           product.product_type === 'service' ? 'Jasa' : 'Bahan Baku'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('id-ID').format(product.unit_price)}
                      </TableCell>
                      <TableCell>
                        {product.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <span className="text-xs text-destructive">{product.errors.join(', ')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetImport}>
                Kembali
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0 || isProcessing}
              >
                {isProcessing ? 'Mengimport...' : `Import ${validCount} Produk`}
              </Button>
            </div>
          </div>
        )}

        {importStep === 'result' && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Import Selesai</h3>
                <p className="text-muted-foreground">
                  {importResult.success} produk berhasil diimport
                  {importResult.failed > 0 && `, ${importResult.failed} gagal`}
                </p>
              </div>
            </div>

            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={resetImport}>
                Import Lagi
              </Button>
              <Button onClick={handleClose}>
                Selesai
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
