import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, Check, Link2, Eye, EyeOff, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DataResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: { id: string; name: string; code: string } | null;
}

type ModuleKey = 'pos' | 'sales' | 'purchases' | 'journals' | 'inventory' | 'assets' | 'logs';

interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  tables: string[];
  dependsOn: ModuleKey[]; // selecting this module auto-selects these
  requiredBy: ModuleKey[]; // these modules require this one
  icon: string;
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: 'pos',
    label: 'Transaksi POS',
    description: 'Transaksi kasir, open tables, deposits, sesi kasir',
    tables: ['pos_transactions', 'pos_transaction_items', 'pos_transaction_payments', 'pos_open_tables', 'pos_open_table_items', 'pos_deposits', 'pos_cash_sessions'],
    dependsOn: ['journals'],
    requiredBy: [],
    icon: '🛒',
  },
  {
    key: 'sales',
    label: 'Penjualan',
    description: 'Sales orders, invoices, pembayaran, uang muka penjualan',
    tables: ['sales_orders', 'sales_order_items', 'invoices', 'payments (receive)', 'payment_allocations', 'down_payments (sales)'],
    dependsOn: ['journals'],
    requiredBy: [],
    icon: '💰',
  },
  {
    key: 'purchases',
    label: 'Pembelian',
    description: 'Purchase orders, bills, pembayaran, goods receipt, uang muka',
    tables: ['purchase_orders', 'purchase_order_items', 'bills', 'goods_receipts', 'goods_receipt_items', 'payments (send)', 'payment_allocations', 'down_payments (purchases)'],
    dependsOn: ['journals'],
    requiredBy: [],
    icon: '🛍️',
  },
  {
    key: 'journals',
    label: 'Jurnal & Akuntansi',
    description: 'Journal entries, saldo awal, tutup periode, reset nomor dokumen',
    tables: ['journal_entries', 'journal_entry_lines', 'journal_entry_tags', 'opening_balances', 'period_closings', 'document_sequences'],
    dependsOn: [],
    requiredBy: ['pos', 'sales', 'purchases', 'assets'],
    icon: '📒',
  },
  {
    key: 'inventory',
    label: 'Inventori',
    description: 'Stock opname, transfer stok, reset stok gudang ke 0',
    tables: ['stock_opname', 'stock_opname_items', 'stock_transfers', 'stock_transfer_items', 'inventory_stock'],
    dependsOn: [],
    requiredBy: [],
    icon: '📦',
  },
  {
    key: 'assets',
    label: 'Aset Tetap',
    description: 'Fixed assets & riwayat penyusutan',
    tables: ['fixed_assets', 'asset_depreciations'],
    dependsOn: ['journals'],
    requiredBy: [],
    icon: '🏗️',
  },
  {
    key: 'logs',
    label: 'Log Aktivitas',
    description: 'Riwayat audit trail sistem',
    tables: ['activity_logs'],
    dependsOn: [],
    requiredBy: [],
    icon: '📋',
  },
];

export const DataResetDialog: React.FC<DataResetDialogProps> = ({ open, onOpenChange, company }) => {
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(new Set());
  const [autoSelected, setAutoSelected] = useState<Set<ModuleKey>>(new Set());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setSelectedModules(new Set());
      setAutoSelected(new Set());
      setPassword('');
      setShowPassword(false);
      setResults(null);
    }
  }, [open]);

  // Compute auto-selected dependencies whenever selection changes
  const computeDependencies = useCallback((selected: Set<ModuleKey>) => {
    const allSelected = new Set(selected);
    const auto = new Set<ModuleKey>();

    // Forward pass: if module X is selected, auto-select X.dependsOn
    let changed = true;
    while (changed) {
      changed = false;
      for (const mod of MODULE_DEFINITIONS) {
        if (allSelected.has(mod.key)) {
          for (const dep of mod.dependsOn) {
            if (!allSelected.has(dep)) {
              allSelected.add(dep);
              auto.add(dep);
              changed = true;
            }
          }
        }
      }
    }

    setAutoSelected(auto);
    return allSelected;
  }, []);

  const handleToggleModule = (moduleKey: ModuleKey) => {
    const newSelected = new Set(selectedModules);

    if (newSelected.has(moduleKey)) {
      // Unchecking - also uncheck modules that depend on this one
      newSelected.delete(moduleKey);

      // If this module is required by others, uncheck those too
      const mod = MODULE_DEFINITIONS.find(m => m.key === moduleKey);
      if (mod) {
        for (const reqBy of mod.requiredBy) {
          newSelected.delete(reqBy);
        }
      }
    } else {
      newSelected.add(moduleKey);
    }

    setSelectedModules(newSelected);
    computeDependencies(newSelected);
  };

  const allModules = new Set([...selectedModules, ...autoSelected]);

  const handleSelectAll = () => {
    const allKeys = new Set(MODULE_DEFINITIONS.map(m => m.key));
    setSelectedModules(allKeys);
    computeDependencies(allKeys);
  };

  const handleDeselectAll = () => {
    setSelectedModules(new Set());
    setAutoSelected(new Set());
  };

  const handleExecute = async () => {
    if (!company || !password.trim() || allModules.size === 0) return;

    setExecuting(true);

    try {
      // Verify password first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('Gagal memverifikasi user');
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        toast.error('Password salah');
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('reset-company-data', {
        body: {
          company_id: company.id,
          modules: Array.from(allModules),
        },
      });

      if (error) throw error;

      if (data?.success) {
        setResults(data);
        toast.success(`Data berhasil direset untuk ${company.name}`);
      } else {
        throw new Error(data?.error || 'Reset gagal');
      }
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error(error.message || 'Gagal mereset data');
    } finally {
      setExecuting(false);
    }
  };

  const isModuleChecked = (key: ModuleKey) => selectedModules.has(key) || autoSelected.has(key);
  const isAutoSelected = (key: ModuleKey) => autoSelected.has(key) && !selectedModules.has(key);

  if (results) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Reset Data Selesai
            </DialogTitle>
            <DialogDescription>
              Data untuk <strong>{company?.name}</strong> telah berhasil direset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {Object.entries(results.results || {}).map(([key, val]: [string, any]) => {
              const mod = MODULE_DEFINITIONS.find(m => m.key === key);
              return (
                <div key={key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{mod?.icon} {mod?.label || key}</span>
                    <Badge variant="secondary">{val.deleted} records</Badge>
                  </div>
                  {val.tables.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Tabel: {val.tables.join(', ')}
                    </p>
                  )}
                </div>
              );
            })}

            {results.errors && results.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive mb-1">Beberapa error:</p>
                {results.errors.map((err: string, i: number) => (
                  <p key={i} className="text-xs text-destructive/80">{err}</p>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Reset Data — {company?.name} ({company?.code})
          </DialogTitle>
          <DialogDescription>
            Pilih modul data yang ingin dihapus. Relasi antar tabel akan otomatis terpilih.
          </DialogDescription>
        </DialogHeader>

        {/* Warning */}
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">⚠️ Peringatan!</p>
            <p className="text-muted-foreground">
              Data yang dihapus <strong>TIDAK BISA</strong> dikembalikan. Pastikan Anda sudah backup data sebelum melanjutkan.
            </p>
          </div>
        </div>

        {/* Select All / Deselect All */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            Pilih Semua
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            Batal Semua
          </Button>
        </div>

        {/* Module Selection */}
        <div className="grid gap-2">
          {MODULE_DEFINITIONS.map((mod) => {
            const checked = isModuleChecked(mod.key);
            const isAuto = isAutoSelected(mod.key);

            return (
              <div
                key={mod.key}
                className={`rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                  checked
                    ? isAuto
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600'
                      : 'border-destructive bg-destructive/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
                onClick={() => !isAuto && handleToggleModule(mod.key)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={checked}
                    disabled={isAuto}
                    onCheckedChange={() => !isAuto && handleToggleModule(mod.key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{mod.icon}</span>
                      <span className="font-medium">{mod.label}</span>
                      {isAuto && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400">
                          <Link2 className="w-3 h-3 mr-1" />
                          Auto (relasi)
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{mod.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {mod.tables.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] font-mono">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dependency Info */}
        {autoSelected.size > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Modul bertanda <strong>"Auto (relasi)"</strong> otomatis terpilih karena data yang Anda pilih memiliki relasi ke modul tersebut. Ini mencegah data orphan / inkonsisten.
            </p>
          </div>
        )}

        {/* Password Confirmation */}
        {allModules.size > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="reset-password" className="text-sm font-medium">
              Masukkan password Anda untuk konfirmasi
            </Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password Anda"
                onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={allModules.size === 0 || !password.trim() || executing}
            onClick={handleExecute}
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Reset {allModules.size} Modul
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
