import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Search, History, User, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { getActionLabel, getEntityLabel } from '@/lib/activityLog';

interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_number: string | null;
  description: string;
  changes: any;
  created_at: string;
}

const ActivityLogPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    let query = supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter);
    }

    if (search) {
      query = query.or(`description.ilike.%${search}%,entity_number.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (!error) {
      setLogs(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedCompany, entityFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'update': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'confirm': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'post': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'cancel': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const entityTypes = [
    { value: 'all', label: 'Semua' },
    { value: 'sales_order', label: 'Sales Order' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'payment', label: 'Pembayaran' },
    { value: 'purchase_order', label: 'Purchase Order' },
    { value: 'bill', label: 'Bill' },
    { value: 'goods_receipt', label: 'Penerimaan Barang' },
    { value: 'journal_entry', label: 'Jurnal' },
    { value: 'pos_transaction', label: 'Transaksi POS' },
    { value: 'product', label: 'Produk' },
    { value: 'customer', label: 'Customer' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'chart_of_accounts', label: 'Akun' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          Audit Trail
        </h1>
        <p className="text-muted-foreground">Riwayat semua aktivitas dan perubahan data</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Cari deskripsi atau nomor dokumen..."
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-56">
          <SearchableSelect
            options={entityTypes}
            value={entityFilter}
            onChange={(v) => { setEntityFilter(v); setPage(0); }}
            placeholder="Filter jenis"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center py-12 text-muted-foreground">Memuat...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum ada aktivitas</h3>
              <p className="text-muted-foreground">Riwayat aktivitas akan muncul saat ada transaksi</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                        <Badge variant="secondary">
                          {getEntityLabel(log.entity_type)}
                        </Badge>
                        {log.entity_number && (
                          <span className="text-sm font-mono font-medium text-primary">
                            {log.entity_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1">{log.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(log.created_at)} {formatTime(log.created_at)}</span>
                      </div>
                      {log.changes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 text-xs"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          {expandedLog === log.id ? (
                            <><ChevronUp className="w-3 h-3 mr-1" /> Sembunyikan detail</>
                          ) : (
                            <><ChevronDown className="w-3 h-3 mr-1" /> Lihat perubahan</>
                          )}
                        </Button>
                      )}
                      {expandedLog === log.id && log.changes && (
                        <div className="mt-2 bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                          {Object.entries(log.changes).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex gap-2">
                              <span className="font-medium min-w-[100px]">{key}:</span>
                              <span className="text-destructive line-through">{String(value?.old ?? '-')}</span>
                              <span>→</span>
                              <span className="text-success">{String(value?.new ?? '-')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length === PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Sebelumnya
          </Button>
          <Button variant="outline" onClick={() => setPage(p => p + 1)}>
            Selanjutnya
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogPage;
