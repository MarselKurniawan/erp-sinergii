import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Fields = Record<string, boolean>;

const fields: { key: string; label: string }[] = [
  { key: "product_sku", label: "Kode/SKU Produk" },
  { key: "product_category", label: "Kategori Produk" },
  { key: "product_unit", label: "Satuan Produk" },
  { key: "product_cost", label: "Harga Pokok Produk" },
  { key: "customer_tax_number", label: "NPWP Customer" },
  { key: "supplier_tax_number", label: "NPWP Supplier" },
  { key: "invoice_due_date", label: "Tanggal Jatuh Tempo" },
  { key: "invoice_discount", label: "Kolom Diskon" },
  { key: "invoice_tax", label: "Kolom Pajak" },
  { key: "invoice_notes", label: "Catatan Invoice" },
];

const defaults: Fields = Object.fromEntries(fields.map(f => [f.key, true]));

export default function ShowHideFields() {
  const { value, setValue, save, loading, saving } = useCompanySetting("visible_fields", defaults);
  return (
    <SettingsPage title="Show / Hide Fields" loading={loading} saving={saving} onSave={() => save()}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between border rounded-lg p-3">
            <Label>{f.label}</Label>
            <Switch checked={value[f.key] ?? true} onCheckedChange={(v) => setValue({ ...value, [f.key]: v })} />
          </div>
        ))}
      </div>
    </SettingsPage>
  );
}
