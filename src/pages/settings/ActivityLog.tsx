import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Search, History, FileText, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  const fetchLogs = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    let query = supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
    if (search) query = query.or(`description.ilike.%${search}%,entity_number.ilike.%${search}%`);
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

    const { data, count, error } = await query;
    if (!error) {
      setLogs(data || []);
      setTotal(count || 0);
      const ids = Array.from(new Set((data || []).map(l => l.user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id,full_name,email').in('id', ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id.slice(0, 8); });
        setUserMap(prev => ({ ...prev, ...map }));
      }
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [selectedCompany, entityFilter, page, dateFrom, dateTo]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); fetchLogs(); }, 300);
    return () => clearTimeout(t);
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

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const entityTypes = [
    { value: 'all', label: 'Semua' },
    { value: 'sales_orders', label: 'Sales Order' },
    { value: 'invoices', label: 'Invoice' },
    { value: 'payments', label: 'Pembayaran' },
    { value: 'purchase_orders', label: 'Purchase Order' },
    { value: 'bills', label: 'Bill' },
    { value: 'goods_receipts', label: 'Penerimaan Barang' },
    { value: 'journal_entries', label: 'Jurnal Entry' },
    { value: 'pos_transactions', label: 'Transaksi POS' },
    { value: 'products', label: 'Produk' },
    { value: 'customers', label: 'Customer' },
    { value: 'suppliers', label: 'Supplier' },
    { value: 'accounts', label: 'Akun (COA)' },
    { value: 'fixed_assets', label: 'Aset Tetap' },
    { value: 'stock_transfers', label: 'Transfer Stok' },
    { value: 'stock_opnames', label: 'Stock Opname' },
    { value: 'down_payments', label: 'Down Payment' },
    { value: 'companies', label: 'Perusahaan' },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
          <History className="h-8 w-8" /> Log Activity
        </h1>
        <p className="text-muted-foreground">Riwayat semua aktivitas dan perubahan data</p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Deskripsi / nomor..." className="pl-10" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Jenis</Label>
            <SearchableSelect options={entityTypes} value={entityFilter} onChange={(v) => { setEntityFilter(v); setPage(0); }} placeholder="Filter jenis" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center py-12 text-muted-foreground">Memuat...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum ada aktivitas</h3>
              <p className="text-muted-foreground">Tidak ada log untuk filter saat ini</p>
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
                        <Badge variant="outline" className={getActionColor(log.action)}>{getActionLabel(log.action)}</Badge>
                        <Badge variant="secondary">{getEntityLabel(log.entity_type)}</Badge>
                        {log.entity_number && (
                          <span className="text-sm font-mono font-medium text-primary">{log.entity_number}</span>
                        )}
                      </div>
                      <p className="text-sm mt-1">{log.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(log.created_at)} • {formatTime(log.created_at)}</span>
                        <span>oleh <b>{log.user_id ? (userMap[log.user_id] || log.user_id.slice(0, 8)) : 'Sistem'}</b></span>
                      </div>
                      {log.changes && (
                        <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                          {expandedLog === log.id ? (<><ChevronUp className="w-3 h-3 mr-1" /> Sembunyikan</>) : (<><ChevronDown className="w-3 h-3 mr-1" /> Lihat perubahan</>)}
                        </Button>
                      )}
                      {expandedLog === log.id && log.changes && (
                        <div className="mt-2 bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                          {Object.entries(log.changes).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex gap-2">
                              <span className="font-medium min-w-[120px]">{key}:</span>
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {logs.length > 0 ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + logs.length} dari {total}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
          <span className="text-sm">Hal. {page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Selanjutnya</Button>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogPage;
