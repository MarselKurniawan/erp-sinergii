import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Dash = {
  show_revenue: boolean; show_expenses: boolean; show_profit: boolean;
  show_ar_aging: boolean; show_ap_aging: boolean; show_top_products: boolean;
  show_recent_transactions: boolean; show_cash_balance: boolean;
  default_period: "today" | "week" | "month" | "year";
};

const defaults: Dash = {
  show_revenue: true, show_expenses: true, show_profit: true,
  show_ar_aging: true, show_ap_aging: true, show_top_products: true,
  show_recent_transactions: true, show_cash_balance: true,
  default_period: "month",
};

export default function CustomizeDashboard() {
  const { value, setValue, save, loading, saving } = useCompanySetting("dashboard", defaults);
  const flags = Object.keys(defaults).filter(k => k.startsWith("show_")) as (keyof Dash)[];
  return (
    <SettingsPage title="Customize Dashboard" loading={loading} saving={saving} onSave={() => save()}>
      <div className="space-y-3">
        {flags.map((k) => (
          <div key={k} className="flex items-center justify-between border-b pb-2">
            <Label className="capitalize">{k.toString().replace(/_/g, " ").replace("show ", "")}</Label>
            <Switch checked={value[k] as boolean} onCheckedChange={(v) => setValue({ ...value, [k]: v })} />
          </div>
        ))}
        <div>
          <Label>Periode default</Label>
          <select className="input-field w-full" value={value.default_period}
            onChange={(e) => setValue({ ...value, default_period: e.target.value as any })}>
            <option value="today">Hari ini</option>
            <option value="week">Minggu ini</option>
            <option value="month">Bulan ini</option>
            <option value="year">Tahun ini</option>
          </select>
        </div>
      </div>
    </SettingsPage>
  );
}
