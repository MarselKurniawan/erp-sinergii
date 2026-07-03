import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

type Status = "ok" | "warn" | "error";
interface Check {
  key: string;
  label: string;
  status: Status;
  detail: string;
  fixPath?: string;
  fixLabel?: string;
}

export default function SystemHealthCheck() {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);

  const runChecks = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const cid = selectedCompany.id;
    const next: Check[] = [];

    // 1. COA
    const { count: coaCount } = await supabase
      .from("chart_of_accounts").select("*", { count: "exact", head: true })
      .eq("company_id", cid).eq("is_active", true);
    next.push({
      key: "coa",
      label: "Chart of Accounts (COA)",
      status: (coaCount ?? 0) >= 20 ? "ok" : (coaCount ?? 0) > 0 ? "warn" : "error",
      detail: `${coaCount ?? 0} akun aktif`,
      fixPath: "/accounts",
      fixLabel: "Kelola COA",
    });

    // 2. Key account types
    const required: { type: "asset" | "liability" | "revenue" | "expense" | "cash_bank"; kw: string; label: string }[] = [
      { type: "asset", kw: "piutang", label: "Piutang Usaha" },
      { type: "liability", kw: "hutang", label: "Hutang Usaha" },
      { type: "revenue", kw: "penjualan", label: "Pendapatan Penjualan" },
      { type: "expense", kw: "hpp", label: "HPP" },
      { type: "asset", kw: "persediaan", label: "Persediaan" },
      { type: "cash_bank", kw: "kas", label: "Kas / Bank" },
    ];
    for (const r of required) {
      const { count } = await supabase
        .from("chart_of_accounts").select("*", { count: "exact", head: true })
        .eq("company_id", cid).eq("is_active", true).eq("account_type", r.type)
        .ilike("name", `%${r.kw}%`);
      next.push({
        key: `acc-${r.kw}`,
        label: `Akun ${r.label}`,
        status: (count ?? 0) > 0 ? "ok" : "error",
        detail: (count ?? 0) > 0 ? `Ditemukan` : "Belum ada — auto-journal akan gagal",
        fixPath: "/accounts",
      });
    }

    // 3. Warehouse
    const { count: whCount } = await supabase
      .from("warehouses").select("*", { count: "exact", head: true })
      .eq("company_id", cid).eq("is_active", true);
    next.push({
      key: "wh",
      label: "Gudang",
      status: (whCount ?? 0) > 0 ? "ok" : "error",
      detail: `${whCount ?? 0} gudang aktif`,
      fixPath: "/inventory/warehouses",
      fixLabel: "Tambah Gudang",
    });

    // 4. Document Numbering
    const { count: seqCount } = await supabase
      .from("document_sequences").select("*", { count: "exact", head: true })
      .eq("company_id", cid);
    next.push({
      key: "seq",
      label: "Penomoran Dokumen",
      status: (seqCount ?? 0) >= 4 ? "ok" : (seqCount ?? 0) > 0 ? "warn" : "warn",
      detail: `${seqCount ?? 0} format terdaftar`,
      fixPath: "/settings/numbering",
      fixLabel: "Atur Numbering",
    });

    // 5. Customer mapping
    const { count: custTotal } = await supabase
      .from("customers").select("*", { count: "exact", head: true }).eq("company_id", cid);
    const { count: custMapped } = await supabase
      .from("customers").select("*", { count: "exact", head: true })
      .eq("company_id", cid).not("receivable_account_id", "is", null);
    next.push({
      key: "cust-map",
      label: "Mapping Akun Customer",
      status: (custTotal ?? 0) === 0 ? "warn" : (custMapped ?? 0) === custTotal ? "ok" : "warn",
      detail: `${custMapped ?? 0}/${custTotal ?? 0} customer punya akun piutang`,
      fixPath: "/settings/account-mapping",
      fixLabel: "Buka Mapping",
    });

    // 6. Supplier mapping
    const { count: supTotal } = await supabase
      .from("suppliers").select("*", { count: "exact", head: true }).eq("company_id", cid);
    const { count: supMapped } = await supabase
      .from("suppliers").select("*", { count: "exact", head: true })
      .eq("company_id", cid).not("payable_account_id", "is", null);
    next.push({
      key: "sup-map",
      label: "Mapping Akun Supplier",
      status: (supTotal ?? 0) === 0 ? "warn" : (supMapped ?? 0) === supTotal ? "ok" : "warn",
      detail: `${supMapped ?? 0}/${supTotal ?? 0} supplier punya akun hutang`,
      fixPath: "/settings/account-mapping",
    });

    // 7. Product mapping
    const { count: prodTotal } = await supabase
      .from("products").select("*", { count: "exact", head: true }).eq("company_id", cid);
    const { count: prodMapped } = await supabase
      .from("products").select("*", { count: "exact", head: true })
      .eq("company_id", cid).not("revenue_account_id", "is", null);
    next.push({
      key: "prod-map",
      label: "Mapping Akun Produk",
      status: (prodTotal ?? 0) === 0 ? "warn" : (prodMapped ?? 0) === prodTotal ? "ok" : "warn",
      detail: `${prodMapped ?? 0}/${prodTotal ?? 0} produk punya akun pendapatan`,
      fixPath: "/settings/account-mapping",
    });

    // 8. User roles
    const { count: roleCount } = await supabase
      .from("user_roles").select("*", { count: "exact", head: true });
    next.push({
      key: "roles",
      label: "User & Role",
      status: (roleCount ?? 0) > 0 ? "ok" : "warn",
      detail: `${roleCount ?? 0} user role terdaftar`,
      fixPath: "/settings/users",
    });

    setChecks(next);
    setLoading(false);
  };

  const autoFixMapping = async () => {
    if (!selectedCompany) return;
    setFixing(true);
    try {
      const cid = selectedCompany.id;
      const { data: accs } = await supabase
        .from("chart_of_accounts")
        .select("id, name, account_type")
        .eq("company_id", cid).eq("is_active", true);
      if (!accs?.length) {
        toast.error("COA kosong — buat COA dulu");
        setFixing(false);
        return;
      }
      const find = (type: string, kw: string) =>
        accs.find((a) => a.account_type === type && a.name.toLowerCase().includes(kw))?.id;
      const ar = find("asset", "piutang");
      const ap = find("liability", "hutang");
      const rev = find("revenue", "penjualan");
      const cogs = find("expense", "hpp");
      const inv = find("asset", "persediaan");
      const exp = find("expense", "beban") || find("expense", "biaya");

      let touched = 0;
      if (ar) {
        const r = await supabase.from("customers").update({ receivable_account_id: ar })
          .eq("company_id", cid).is("receivable_account_id", null).select("id");
        touched += r.data?.length || 0;
      }
      if (ap) {
        const r = await supabase.from("suppliers").update({ payable_account_id: ap })
          .eq("company_id", cid).is("payable_account_id", null).select("id");
        touched += r.data?.length || 0;
      }
      if (rev || cogs || inv) {
        const upd: Record<string, string> = {};
        if (rev) upd.revenue_account_id = rev;
        if (cogs) upd.cogs_account_id = cogs;
        if (inv) upd.inventory_account_id = inv;
        // update only products missing revenue mapping
        const r = await supabase.from("products").update(upd)
          .eq("company_id", cid).is("revenue_account_id", null).select("id");
        touched += r.data?.length || 0;
      }
      if (exp && ap) {
        await supabase.from("suppliers").update({ expense_account_id: exp })
          .eq("company_id", cid).is("expense_account_id", null);
      }
      toast.success(`Auto-fix selesai — ${touched} record diperbarui`);
      await runChecks();
    } catch (e: any) {
      toast.error(e?.message || "Gagal auto-fix");
    } finally {
      setFixing(false);
    }
  };

  useEffect(() => { runChecks(); /* eslint-disable-next-line */ }, [selectedCompany?.id]);

  const okCount = checks.filter((c) => c.status === "ok").length;
  const errCount = checks.filter((c) => c.status === "error").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  const Icon = ({ s }: { s: Status }) =>
    s === "ok" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
    s === "warn" ? <AlertTriangle className="h-5 w-5 text-amber-500" /> :
    <XCircle className="h-5 w-5 text-red-600" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">System Health Check</h1>
          <p className="text-sm text-muted-foreground">
            Pastikan semua konfigurasi siap sebelum mulai transaksi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runChecks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Cek Ulang
          </Button>
          <Button onClick={autoFixMapping} disabled={fixing}>
            <Wand2 className="h-4 w-4 mr-2" />
            {fixing ? "Memproses..." : "Auto-Fix Mapping"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <div><div className="text-2xl font-bold">{okCount}</div><div className="text-xs text-muted-foreground">Siap</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <div><div className="text-2xl font-bold">{warnCount}</div><div className="text-xs text-muted-foreground">Perlu Perhatian</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <XCircle className="h-8 w-8 text-red-600" />
          <div><div className="text-2xl font-bold">{errCount}</div><div className="text-xs text-muted-foreground">Belum Siap</div></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Detail Pemeriksaan</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {checks.map((c) => (
            <div key={c.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Icon s={c.status} />
                <div>
                  <div className="font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.detail}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === "ok" ? "default" : c.status === "warn" ? "secondary" : "destructive"}>
                  {c.status === "ok" ? "OK" : c.status === "warn" ? "Warning" : "Belum Siap"}
                </Badge>
                {c.fixPath && c.status !== "ok" && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={c.fixPath}>{c.fixLabel || "Perbaiki"}</Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
          {checks.length === 0 && !loading && (
            <div className="text-center text-muted-foreground py-8">Tidak ada data</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
