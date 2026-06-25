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
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Cat = { id: string; name: string; description: string | null; expense_account_id: string | null; is_active: boolean };
type Account = { id: string; code: string; name: string };

export default function ExpenseCategories() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || "";
  const [rows, setRows] = useState<Cat[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: cats }, { data: acc }] = await Promise.all([
      supabase.from("expense_categories").select("*").eq("company_id", companyId).order("name"),
      supabase.from("chart_of_accounts").select("id, code, name")
        .eq("company_id", companyId).eq("is_active", true).eq("account_type", "expense").order("code"),
    ]);
    setRows((cats as any) || []);
    setAccounts((acc as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const save = async () => {
    if (!editing?.name) return toast.error("Nama wajib diisi");
    const payload = {
      company_id: companyId,
      name: editing.name,
      description: editing.description || null,
      expense_account_id: editing.expense_account_id || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("expense_categories").update(payload).eq("id", editing.id)
      : await supabase.from("expense_categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Tersimpan");
    setOpen(false); setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm("Hapus kategori ini?")) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (!companyId) return <div className="p-6 text-muted-foreground">Pilih perusahaan terlebih dahulu.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategori Biaya</h1>
          <p className="text-sm text-muted-foreground">Kelompokkan biaya dan pasangkan dengan akun COA default.</p>
        </div>
        <Button onClick={() => { setEditing({ is_active: true }); setOpen(true); }} className="gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Tambah
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Akun COA</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5}><Loader2 className="h-4 w-4 animate-spin" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada kategori</TableCell></TableRow>
            ) : rows.map((r) => {
              const acc = accounts.find((a) => a.id === r.expense_account_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm">{acc ? `${acc.code} — ${acc.name}` : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
                  <TableCell>{r.is_active ? "Aktif" : "Nonaktif"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Tambah"} Kategori Biaya</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Nama</label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">Akun COA</label>
              <SearchableSelect
                value={editing?.expense_account_id || ""}
                onChange={(v) => setEditing({ ...editing, expense_account_id: v })}
                options={accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                placeholder="— pilih akun —"
              />
            </div>
            <div>
              <label className="text-sm">Deskripsi</label>
              <Textarea value={editing?.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="gradient-primary text-primary-foreground">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
