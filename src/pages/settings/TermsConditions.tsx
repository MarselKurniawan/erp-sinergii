import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Terms = {
  invoice_terms: string;
  estimate_terms: string;
  purchase_terms: string;
  footer_note: string;
};

const defaults: Terms = {
  invoice_terms: "Pembayaran jatuh tempo 30 hari sejak tanggal invoice.",
  estimate_terms: "Estimasi berlaku selama 14 hari.",
  purchase_terms: "Barang yang sudah diterima tidak dapat dikembalikan.",
  footer_note: "Terima kasih atas kepercayaan Anda.",
};

export default function TermsConditionsSettings() {
  const { value, setValue, save, loading, saving } = useCompanySetting("terms", defaults);
  return (
    <SettingsPage title="Terms and Conditions" loading={loading} saving={saving} onSave={() => save()}>
      <div className="space-y-4">
        <div><Label>Syarat Invoice</Label>
          <Textarea rows={3} value={value.invoice_terms} onChange={(e) => setValue({ ...value, invoice_terms: e.target.value })} />
        </div>
        <div><Label>Syarat Estimate</Label>
          <Textarea rows={3} value={value.estimate_terms} onChange={(e) => setValue({ ...value, estimate_terms: e.target.value })} />
        </div>
        <div><Label>Syarat Pembelian</Label>
          <Textarea rows={3} value={value.purchase_terms} onChange={(e) => setValue({ ...value, purchase_terms: e.target.value })} />
        </div>
        <div><Label>Footer Note</Label>
          <Textarea rows={2} value={value.footer_note} onChange={(e) => setValue({ ...value, footer_note: e.target.value })} />
        </div>
      </div>
    </SettingsPage>
  );
}
