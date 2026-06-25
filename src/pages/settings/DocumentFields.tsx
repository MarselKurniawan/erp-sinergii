import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

type CustomField = { id: string; label: string; type: "text" | "number" | "date"; required: boolean };
type Doc = {
  invoice: CustomField[];
  estimate: CustomField[];
  purchase_order: CustomField[];
  expense: CustomField[];
};

const defaults: Doc = { invoice: [], estimate: [], purchase_order: [], expense: [] };

const Section = ({ title, items, setItems }: { title: string; items: CustomField[]; setItems: (v: CustomField[]) => void }) => (
  <div className="border rounded-lg p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold">{title}</h3>
      <Button size="sm" variant="outline" onClick={() => setItems([...items, { id: crypto.randomUUID(), label: "", type: "text", required: false }])}>
        <Plus className="h-4 w-4 mr-1" /> Tambah Field
      </Button>
    </div>
    {items.length === 0 && <p className="text-sm text-muted-foreground">Belum ada field tambahan.</p>}
    {items.map((f, i) => (
      <div key={f.id} className="grid grid-cols-12 gap-2 items-center">
        <Input className="col-span-5" placeholder="Label" value={f.label}
          onChange={(e) => { const c = [...items]; c[i] = { ...f, label: e.target.value }; setItems(c); }} />
        <select className="input-field col-span-3" value={f.type}
          onChange={(e) => { const c = [...items]; c[i] = { ...f, type: e.target.value as any }; setItems(c); }}>
          <option value="text">Teks</option>
          <option value="number">Angka</option>
          <option value="date">Tanggal</option>
        </select>
        <label className="col-span-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.required}
            onChange={(e) => { const c = [...items]; c[i] = { ...f, required: e.target.checked }; setItems(c); }} />
          Wajib
        </label>
        <Button size="icon" variant="ghost" className="col-span-1"
          onClick={() => setItems(items.filter(x => x.id !== f.id))}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    ))}
  </div>
);

export default function DocumentFields() {
  const { value, setValue, save, loading, saving } = useCompanySetting<Doc>("document_fields", defaults);
  return (
    <SettingsPage title="Manage Fields in Documents"
      description="Tambahkan field kustom yang akan muncul di tiap dokumen."
      loading={loading} saving={saving} onSave={() => save()}>
      <div className="space-y-4">
        <Section title="Invoice" items={value.invoice || []} setItems={(v) => setValue({ ...value, invoice: v })} />
        <Section title="Estimate" items={value.estimate || []} setItems={(v) => setValue({ ...value, estimate: v })} />
        <Section title="Purchase Order" items={value.purchase_order || []} setItems={(v) => setValue({ ...value, purchase_order: v })} />
        <Section title="Expense" items={value.expense || []} setItems={(v) => setValue({ ...value, expense: v })} />
      </div>
    </SettingsPage>
  );
}
