import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Features = Record<string, boolean>;

const featureList: { key: string; label: string }[] = [
  { key: "estimates", label: "Estimate / Quotation" },
  { key: "sales_returns", label: "Sales Return" },
  { key: "purchase_returns", label: "Purchase Return" },
  { key: "expenses", label: "Expenses" },
  { key: "capital", label: "Capital Transactions" },
  { key: "receipts", label: "Receipts" },
  { key: "manufacturing", label: "Manufacturing / Production" },
  { key: "fixed_assets", label: "Fixed Assets" },
  { key: "banking_reconciliation", label: "Bank Reconciliation" },
  { key: "pos", label: "Point of Sale (POS)" },
  { key: "multi_warehouse", label: "Multi Warehouse" },
  { key: "period_closing", label: "Period Closing" },
];

const defaults: Features = Object.fromEntries(featureList.map(f => [f.key, true]));

export default function EnableFeatures() {
  const { value, setValue, save, loading, saving } = useCompanySetting("features", defaults);
  return (
    <SettingsPage title="Enable / Disable Feature"
      description="Aktif / nonaktifkan modul opsional untuk perusahaan ini."
      loading={loading} saving={saving} onSave={() => save()}>
      <div className="grid grid-cols-2 gap-3">
        {featureList.map((f) => (
          <div key={f.key} className="flex items-center justify-between border rounded-lg p-3">
            <Label>{f.label}</Label>
            <Switch checked={value[f.key] ?? true} onCheckedChange={(v) => setValue({ ...value, [f.key]: v })} />
          </div>
        ))}
      </div>
    </SettingsPage>
  );
}
