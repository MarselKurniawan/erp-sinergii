import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type BS = {
  show_zero_balances: boolean;
  group_by_category: boolean;
  show_account_codes: boolean;
  show_comparative: boolean;
  rounding: "none" | "thousand" | "million";
};

const defaults: BS = {
  show_zero_balances: false,
  group_by_category: true,
  show_account_codes: true,
  show_comparative: false,
  rounding: "none",
};

export default function BalanceSheetSetting() {
  const { value, setValue, save, loading, saving } = useCompanySetting("balance_sheet", defaults);
  return (
    <SettingsPage title="Balance Sheet Setting" loading={loading} saving={saving} onSave={() => save()}>
      <div className="space-y-4">
        {(["show_zero_balances","group_by_category","show_account_codes","show_comparative"] as const).map((k) => (
          <div key={k} className="flex items-center justify-between">
            <Label className="capitalize">{k.replace(/_/g, " ")}</Label>
            <Switch checked={value[k]} onCheckedChange={(v) => setValue({ ...value, [k]: v })} />
          </div>
        ))}
        <div>
          <Label>Pembulatan</Label>
          <select className="input-field w-full" value={value.rounding}
            onChange={(e) => setValue({ ...value, rounding: e.target.value as any })}>
            <option value="none">Tidak ada</option>
            <option value="thousand">Ribuan</option>
            <option value="million">Jutaan</option>
          </select>
        </div>
      </div>
    </SettingsPage>
  );
}
