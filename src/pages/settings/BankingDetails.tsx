import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Bank = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  branch: string;
  swift_code: string;
  paypal_me: string;
  additional_notes: string;
};

const defaults: Bank = {
  bank_name: "", account_number: "", account_holder: "", branch: "",
  swift_code: "", paypal_me: "", additional_notes: "",
};

export default function BankingDetails() {
  const { value, setValue, save, loading, saving } = useCompanySetting("banking_details", defaults);
  const F = (k: keyof Bank, label: string) => (
    <div><Label>{label}</Label><Input value={value[k]} onChange={(e) => setValue({ ...value, [k]: e.target.value })} /></div>
  );
  return (
    <SettingsPage title="Banking Details & PayPal.Me"
      description="Detail rekening yang muncul di invoice dan dokumen pembayaran."
      loading={loading} saving={saving} onSave={() => save()}>
      <div className="grid grid-cols-2 gap-4">
        {F("bank_name","Nama Bank")}
        {F("account_number","Nomor Rekening")}
        {F("account_holder","Atas Nama")}
        {F("branch","Cabang")}
        {F("swift_code","SWIFT Code")}
        {F("paypal_me","PayPal.Me URL")}
      </div>
      <div className="mt-4">
        <Label>Catatan Tambahan</Label>
        <Textarea rows={3} value={value.additional_notes}
          onChange={(e) => setValue({ ...value, additional_notes: e.target.value })} />
      </div>
    </SettingsPage>
  );
}
