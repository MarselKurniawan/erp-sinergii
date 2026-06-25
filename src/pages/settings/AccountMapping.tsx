import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

type Account = { id: string; code: string; name: string; account_type: string };

const useAccounts = (companyId?: string) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    if (!companyId) return;
    supabase.from("chart_of_accounts")
      .select("id, code, name, account_type")
      .eq("company_id", companyId).eq("is_active", true).order("code")
      .then(({ data }) => setAccounts((data as any) || []));
  }, [companyId]);
  return accounts;
};

const accountOptions = (accounts: Account[], types?: string[]) =>
  accounts
    .filter((a) => !types || types.includes(a.account_type))
    .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

const MappingTable = <T extends Record<string, any>>({
  table, idKey, nameKey, search, columns, companyId, accounts,
}: {
  table: string;
  idKey: string;
  nameKey: string;
  search: string;
  columns: { key: string; label: string; types: string[] }[];
  companyId: string;
  accounts: Account[];
}) => {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState<Record<string, Partial<T>>>({});

  const fields = ["id", nameKey, "code", ...columns.map((c) => c.key)].filter(Boolean);
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from(table as any).select(fields.join(","))
      .eq("company_id", companyId).order(nameKey);
    setRows((data as any) || []);
    setDirty({});
    setLoading(false);
  };
  useEffect(() => { if (companyId) load(); }, [companyId, table]);

  const setVal = (id: string, key: string, value: string | null) => {
    setDirty((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(dirty);
      for (const [id, patch] of entries) {
        const { error } = await supabase.from(table as any).update(patch).eq("id", id);
        if (error) throw error;
      }
      toast.success(`${entries.length} baris disimpan`);
      setDirty({});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter((r) =>
    !q || String(r[nameKey] || "").toLowerCase().includes(q.toLowerCase())
        || String((r as any).code || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Input placeholder={search} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Button onClick={save} disabled={saving || !Object.keys(dirty).length} className="gradient-primary text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan ({Object.keys(dirty).length})
        </Button>
      </div>
      <div className="border rounded-md overflow-auto max-h-[60vh]">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead>Nama</TableHead>
              {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={1 + columns.length}>
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={1 + columns.length} className="text-center text-muted-foreground py-8">Tidak ada data</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {(r as any).code ? <span className="text-xs text-muted-foreground mr-2">{(r as any).code}</span> : null}
                  {r[nameKey]}
                </TableCell>
                {columns.map((c) => (
                  <TableCell key={c.key} className="min-w-[220px]">
                    <SearchableSelect
                      value={(r as any)[c.key] || ""}
                      onValueChange={(v) => setVal(r.id, c.key, v || null)}
                      options={accountOptions(accounts, c.types)}
                      placeholder="— pilih akun —"
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default function AccountMapping() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id || "";
  const accounts = useAccounts(companyId);

  if (!companyId) {
    return <div className="p-6 text-muted-foreground">Pilih perusahaan terlebih dahulu.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pemetaan Akun</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atur akun default per Customer, Supplier, dan Produk. Saat membuat invoice, bill, atau pembayaran sistem akan otomatis memakai akun ini.
        </p>
      </div>

      <Card className="p-4">
        <Tabs defaultValue="customers">
          <TabsList>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="products">Produk</TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="mt-4">
            <MappingTable
              table="customers" idKey="id" nameKey="name" search="Cari customer…"
              companyId={companyId} accounts={accounts}
              columns={[
                { key: "receivable_account_id", label: "Akun Piutang", types: ["asset"] },
                { key: "tax_account_id", label: "Akun Pajak Keluaran", types: ["liability"] },
              ]}
            />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-4">
            <MappingTable
              table="suppliers" idKey="id" nameKey="name" search="Cari supplier…"
              companyId={companyId} accounts={accounts}
              columns={[
                { key: "payable_account_id", label: "Akun Hutang", types: ["liability"] },
                { key: "expense_account_id", label: "Akun Biaya Default", types: ["expense", "asset"] },
                { key: "tax_account_id", label: "Akun Pajak Masukan", types: ["asset"] },
              ]}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <MappingTable
              table="products" idKey="id" nameKey="name" search="Cari produk…"
              companyId={companyId} accounts={accounts}
              columns={[
                { key: "revenue_account_id", label: "Akun Pendapatan", types: ["revenue"] },
                { key: "inventory_account_id", label: "Akun Persediaan", types: ["asset"] },
                { key: "cogs_account_id", label: "Akun HPP / Pembelian", types: ["expense"] },
                { key: "tax_account_id", label: "Akun Pajak", types: ["liability", "asset"] },
              ]}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
