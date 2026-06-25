import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Theme = {
  template: "classic" | "modern" | "minimal" | "bold";
  primary_color: string;
  accent_color: string;
  font_family: string;
  show_logo: boolean;
  show_signature: boolean;
};

const defaults: Theme = {
  template: "modern",
  primary_color: "#2563eb",
  accent_color: "#0ea5e9",
  font_family: "Rubik",
  show_logo: true,
  show_signature: true,
};

export default function InvoiceThemeSettings() {
  const { value, setValue, save, loading, saving } = useCompanySetting("invoice_theme", defaults);
  const templates: Theme["template"][] = ["classic", "modern", "minimal", "bold"];
  return (
    <SettingsPage title="Invoice Theme" description="Atur tampilan invoice, estimate, dan dokumen cetak."
      loading={loading} saving={saving} onSave={() => save()}>
      <div className="space-y-4">
        <div>
          <Label>Template</Label>
          <div className="grid grid-cols-4 gap-3 mt-2">
            {templates.map((t) => (
              <button key={t} type="button"
                onClick={() => setValue({ ...value, template: t })}
                className={`border rounded-lg p-4 text-center capitalize transition ${
                  value.template === t ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-muted"
                }`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Warna Utama</Label>
            <Input type="color" value={value.primary_color} onChange={(e) => setValue({ ...value, primary_color: e.target.value })} />
          </div>
          <div>
            <Label>Warna Aksen</Label>
            <Input type="color" value={value.accent_color} onChange={(e) => setValue({ ...value, accent_color: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Font</Label>
          <select className="input-field w-full" value={value.font_family}
            onChange={(e) => setValue({ ...value, font_family: e.target.value })}>
            {["Rubik", "Inter", "Roboto", "Poppins", "Lato"].map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={value.show_logo} onChange={(e) => setValue({ ...value, show_logo: e.target.checked })} />
            Tampilkan logo
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={value.show_signature} onChange={(e) => setValue({ ...value, show_signature: e.target.checked })} />
            Tampilkan tanda tangan
          </label>
        </div>
      </div>
    </SettingsPage>
  );
}
