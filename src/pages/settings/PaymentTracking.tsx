import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type PT = {
  auto_mark_paid: boolean;
  partial_payment_allowed: boolean;
  send_due_reminder: boolean;
  reminder_days_before: number;
  late_fee_percent: number;
  default_payment_terms_days: number;
};

const defaults: PT = {
  auto_mark_paid: true,
  partial_payment_allowed: true,
  send_due_reminder: true,
  reminder_days_before: 3,
  late_fee_percent: 0,
  default_payment_terms_days: 30,
};

export default function PaymentTracking() {
  const { value, setValue, save, loading, saving } = useCompanySetting("payment_tracking", defaults);
  return (
    <SettingsPage title="Payment Tracking" loading={loading} saving={saving} onSave={() => save()}>
      <div className="space-y-4">
        {(["auto_mark_paid","partial_payment_allowed","send_due_reminder"] as const).map(k => (
          <div key={k} className="flex items-center justify-between border-b pb-2">
            <Label className="capitalize">{k.replace(/_/g," ")}</Label>
            <Switch checked={value[k]} onCheckedChange={(v) => setValue({ ...value, [k]: v })} />
          </div>
        ))}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Hari Pengingat Sebelum Jatuh Tempo</Label>
            <Input type="number" value={value.reminder_days_before}
              onChange={(e) => setValue({ ...value, reminder_days_before: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>Denda Telat (%)</Label>
            <Input type="number" value={value.late_fee_percent}
              onChange={(e) => setValue({ ...value, late_fee_percent: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>Default Termin (hari)</Label>
            <Input type="number" value={value.default_payment_terms_days}
              onChange={(e) => setValue({ ...value, default_payment_terms_days: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
      </div>
    </SettingsPage>
  );
}
