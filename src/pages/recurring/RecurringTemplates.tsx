import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Item = { product_id?: string; description?: string; quantity: number; unit_price: number; discount_percent?: number; tax_percent?: number };
type Tpl = {
  id?: string; name: string; doc_type: "invoice" | "bill";
  customer_id?: string | null; supplier_id?: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval_count: number; start_date: string; next_run: string;
  end_date?: string | null; due_days: number; is_active: boolean;
  notes?: string | null; items: Item[];
  last_run_at?: string | null; total_generated?: number;
};

const emptyTpl = (): Tpl => ({
  name: "", doc_type: "invoice", frequency: "monthly", interval_count: 1,
  start_date: format(new Date(), "yyyy-MM-dd"), next_run: format(new Date(), "yyyy-MM-dd"),
  due_days: 30, is_active: true, items: [{ quantity: 1, unit_price: 0 }],
});

export default function RecurringTemplates() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || "";
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tpl | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [a, b, c, d] = await Promise.all([
      supabase.from("recurring_templates").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name").eq("company_id", companyId).order("name"),
      supabase.from("suppliers").select("id, name").eq("company_id", companyId).order("name"),
      supabase.from("products").select("id, name, sku, selling_price").eq("company_id", companyId).order("name"),
    ]);
    setRows(a.data || []);
    setCustomers(b.data || []);
    setSuppliers(c.data || []);
    setProducts(d.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name) return toast.error("Nama template wajib diisi");
    if (editing.doc_type === "invoice" && !editing.customer_id) return toast.error("Pilih customer");
    if (editing.doc_type === "bill" && !editing.supplier_id) return toast.error("Pilih supplier");
    const payload: any = {
      company_id: companyId,
      name: editing.name, doc_type: editing.doc_type,
      customer_id: editing.doc_type === "invoice" ? editing.customer_id : null,
      supplier_id: editing.doc_type === "bill" ? editing.supplier_id : null,
      frequency: editing.frequency, interval_count: editing.interval_count,
      start_date: editing.start_date, next_run: editing.next_run,
      end_date: editing.end_date || null, due_days: editing.due_days,
      is_active: editing.is_active, notes: editing.notes,
      items: editing.items as any,
    };
    const { error } = editing.id
      ? await supabase.from("recurring_templates").update(payload).eq("id", editing.id)
      : await supabase.from("recurring_templates").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (error) return toast.error(error.message);
    toast.success("Tersimpan");
    setOpen(false); setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm("Hapus template?")) return;
    const { error } = await supabase.from("recurring_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("generate_recurring_documents", { p_company_id: companyId });
    setRunning(false);
    if (error) return toast.error(error.message);
    toast.success(`${data || 0} dokumen dibuat`);
    load();
  };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    if (!editing) return;
    const items = [...editing.items];
    items[idx] = { ...items[idx], ...patch };
    setEditing({ ...editing, items });
  };

  if (!companyId) return <div className="p-6 text-muted-foreground">Pilih perusahaan terlebih dahulu.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dokumen Berulang</h1>
          <p className="text-sm text-muted-foreground">Template invoice/bill yang otomatis dibuat sesuai jadwal.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Jalankan Sekarang
          </Button>
          <Button onClick={() => { setEditing(emptyTpl()); setOpen(true); }} className="gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Tambah Template
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Frekuensi</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Total Dibuat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8}><Loader2 className="h-4 w-4 animate-spin" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada template</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.doc_type}</Badge></TableCell>
                <TableCell className="text-sm">setiap {r.interval_count} {r.frequency}</TableCell>
                <TableCell className="text-sm">{r.next_run}</TableCell>
                <TableCell className="text-sm">{r.end_date || "—"}</TableCell>
                <TableCell>{r.total_generated || 0}</TableCell>
                <TableCell>{r.is_active ? <Badge className="bg-green-500">Aktif</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Tambah"} Template Berulang</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Nama Template</label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Tipe Dokumen</label>
                  <Select value={editing.doc_type} onValueChange={(v: any) => setEditing({ ...editing, doc_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice (Penjualan)</SelectItem>
                      <SelectItem value="bill">Bill (Pembelian)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.doc_type === "invoice" ? (
                  <div className="col-span-2">
                    <label className="text-sm">Customer</label>
                    <SearchableSelect value={editing.customer_id || ""} onChange={(v) => setEditing({ ...editing, customer_id: v })}
                      options={customers.map((c) => ({ value: c.id, label: c.name }))} placeholder="— pilih customer —" />
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="text-sm">Supplier</label>
                    <SearchableSelect value={editing.supplier_id || ""} onChange={(v) => setEditing({ ...editing, supplier_id: v })}
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="— pilih supplier —" />
                  </div>
                )}
                <div>
                  <label className="text-sm">Frekuensi</label>
                  <Select value={editing.frequency} onValueChange={(v: any) => setEditing({ ...editing, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Harian</SelectItem>
                      <SelectItem value="weekly">Mingguan</SelectItem>
                      <SelectItem value="monthly">Bulanan</SelectItem>
                      <SelectItem value="yearly">Tahunan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">Setiap</label>
                  <Input type="number" min={1} value={editing.interval_count} onChange={(e) => setEditing({ ...editing, interval_count: +e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Mulai</label>
                  <Input type="date" value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value, next_run: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Berakhir (opsional)</label>
                  <Input type="date" value={editing.end_date || ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Jangka Tempo (hari)</label>
                  <Input type="number" value={editing.due_days} onChange={(e) => setEditing({ ...editing, due_days: +e.target.value })} />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <span className="text-sm">Aktif</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Item</label>
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, items: [...editing.items, { quantity: 1, unit_price: 0 }] })}>
                    <Plus className="h-3 w-3 mr-1" /> Baris
                  </Button>
                </div>
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-32">Harga</TableHead>
                        <TableHead className="w-20">Disc %</TableHead>
                        <TableHead className="w-20">Pajak %</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editing.items.map((it, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <SearchableSelect value={it.product_id || ""}
                              onChange={(v) => {
                                const p = products.find((x) => x.id === v);
                                updateItem(i, { product_id: v, unit_price: p?.selling_price ?? it.unit_price });
                              }}
                              options={products.map((p) => ({ value: p.id, label: `${p.sku || ""} ${p.name}` }))}
                              placeholder="— pilih produk —" />
                          </TableCell>
                          <TableCell><Input type="number" value={it.quantity} onChange={(e) => updateItem(i, { quantity: +e.target.value })} /></TableCell>
                          <TableCell><Input type="number" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: +e.target.value })} /></TableCell>
                          <TableCell><Input type="number" value={it.discount_percent || 0} onChange={(e) => updateItem(i, { discount_percent: +e.target.value })} /></TableCell>
                          <TableCell><Input type="number" value={it.tax_percent || 0} onChange={(e) => updateItem(i, { tax_percent: +e.target.value })} /></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <label className="text-sm">Catatan</label>
                <Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="gradient-primary text-primary-foreground">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
