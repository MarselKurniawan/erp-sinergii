import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Seq = {
  id?: string;
  company_id: string;
  document_type: string;
  prefix: string;
  current_number: number;
  reset_period: "never" | "monthly" | "yearly";
  format: string;
  pad_length: number;
};

const TYPES: { key: string; label: string; defPrefix: string }[] = [
  { key: "INV", label: "Invoice", defPrefix: "INV" },
  { key: "SO", label: "Sales Order", defPrefix: "SO" },
  { key: "EST", label: "Estimate", defPrefix: "EST" },
  { key: "SRN", label: "Sales Return", defPrefix: "SRN" },
  { key: "BILL", label: "Bill / Purchase", defPrefix: "BILL" },
  { key: "PO", label: "Purchase Order", defPrefix: "PO" },
  { key: "GR", label: "Goods Receipt", defPrefix: "GR" },
  { key: "PRN", label: "Purchase Return", defPrefix: "PRN" },
  { key: "PAY-IN", label: "Payment Masuk", defPrefix: "PAY-IN" },
  { key: "PAY-OUT", label: "Payment Keluar", defPrefix: "PAY-OUT" },
  { key: "RCP", label: "Receipt", defPrefix: "RCP" },
  { key: "EXP", label: "Expense", defPrefix: "EXP" },
  { key: "JE", label: "Journal Entry", defPrefix: "JE" },
  { key: "DP", label: "Down Payment", defPrefix: "DP" },
  { key: "CAP", label: "Capital", defPrefix: "CAP" },
  { key: "CBT", label: "Cash/Bank Transfer", defPrefix: "CBT" },
];

export default function NumberingSettings() {
  const { selectedCompany } = useCompany();
  const [rows, setRows] = useState<Record<string, Seq>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("document_sequences")
      .select("*")
      .eq("company_id", selectedCompany.id);
    const map: Record<string, Seq> = {};
    for (const t of TYPES) {
      const existing = (data || []).find((d: any) => d.document_type === t.key);
      map[t.key] = existing || {
        company_id: selectedCompany.id,
        document_type: t.key,
        prefix: t.defPrefix,
        current_number: 0,
        reset_period: "monthly",
        format: "{PREFIX}-{YYYY}{MM}-{NUM4}",
        pad_length: 4,
      };
    }
    setRows(map);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, [selectedCompany?.id]);

  const update = (key: string, patch: Partial<Seq>) =>
    setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));

  const preview = (s: Seq) => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const num = String((s.current_number || 0) + 1).padStart(s.pad_length || 4, "0");
    return (s.format || "{PREFIX}-{YYYY}{MM}-{NUM4}")
      .replace("{PREFIX}", s.prefix || "")
      .replace("{YYYY}", yyyy).replace("{YY}", yyyy.slice(2))
      .replace("{MM}", mm).replace("{DD}", dd)
      .replace("{NUM4}", num.padStart(4, "0"))
      .replace("{NUM5}", num.padStart(5, "0"))
      .replace("{NUM6}", num.padStart(6, "0"))
      .replace("{NUM}", num);
  };

  const save = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    const payload = Object.values(rows).map((r) => ({
      company_id: selectedCompany.id,
      document_type: r.document_type,
      prefix: r.prefix,
      current_number: r.current_number,
      reset_period: r.reset_period,
      format: r.format,
      pad_length: r.pad_length,
      last_reset_date: new Date().toISOString().slice(0, 10),
    }));
    const { error } = await (supabase as any)
      .from("document_sequences")
      .upsert(payload, { onConflict: "company_id,document_type" });
    setSaving(false);
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else { toast.success("Pengaturan penomoran tersimpan"); load(); }
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Penomoran Dokumen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atur prefix, format, dan reset penomoran untuk setiap jenis dokumen per perusahaan.
          Token yang didukung: <code>{"{PREFIX} {YYYY} {YY} {MM} {DD} {NUM} {NUM4} {NUM5} {NUM6}"}</code>
        </p>
      </div>
      <Card className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dokumen</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="w-24">Pad</TableHead>
                <TableHead className="w-32">Reset</TableHead>
                <TableHead className="w-28">No. Saat Ini</TableHead>
                <TableHead>Preview Berikutnya</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TYPES.map((t) => {
                const s = rows[t.key]; if (!s) return null;
                return (
                  <TableRow key={t.key}>
                    <TableCell className="font-medium">{t.label}<div className="text-xs text-muted-foreground">{t.key}</div></TableCell>
                    <TableCell><Input value={s.prefix} onChange={(e) => update(t.key, { prefix: e.target.value })} /></TableCell>
                    <TableCell><Input value={s.format} onChange={(e) => update(t.key, { format: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={s.pad_length} onChange={(e) => update(t.key, { pad_length: parseInt(e.target.value) || 4 })} /></TableCell>
                    <TableCell>
                      <select className="input-field w-full" value={s.reset_period}
                        onChange={(e) => update(t.key, { reset_period: e.target.value as any })}>
                        <option value="never">Tidak</option>
                        <option value="monthly">Bulanan</option>
                        <option value="yearly">Tahunan</option>
                      </select>
                    </TableCell>
                    <TableCell><Input type="number" value={s.current_number}
                      onChange={(e) => update(t.key, { current_number: parseInt(e.target.value) || 0 })} /></TableCell>
                    <TableCell className="font-mono text-sm text-primary">{preview(s)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan Pengaturan
        </Button>
      </div>
    </div>
  );
}
