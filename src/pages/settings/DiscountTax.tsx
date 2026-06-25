import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type DiscountTax = {
  enable_discount: boolean;
  default_discount_percent: number;
  discount_type: "percent" | "amount";
  enable_tax: boolean;
  default_tax_percent: number;
  tax_inclusive: boolean;
  tax_label: string;
};

const defaults: DiscountTax = {
  enable_discount: true,
  default_discount_percent: 0,
  discount_type: "percent",
  enable_tax: true,
  default_tax_percent: 11,
  tax_inclusive: false,
  tax_label: "PPN",
};

export default function DiscountTaxSettings() {
  const { value, setValue, save, loading, saving } = useCompanySetting("discount_tax", defaults);
  return (
    <SettingsPage
      title="Discount and Taxes"
      description="Atur diskon dan pajak default untuk dokumen penjualan/pembelian."
      loading={loading} saving={saving} onSave={() => save()}
    >
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold">Diskon</h3>
          <div className="flex items-center justify-between">
            <Label>Aktifkan diskon</Label>
            <Switch checked={value.enable_discount} onCheckedChange={(v) => setValue({ ...value, enable_discount: v })} />
          </div>
          <div>
            <Label>Tipe diskon</Label>
            <select className="input-field w-full" value={value.discount_type}
              onChange={(e) => setValue({ ...value, discount_type: e.target.value as any })}>
              <option value="percent">Persentase (%)</option>
              <option value="amount">Nominal (Rp)</option>
            </select>
          </div>
          <div>
            <Label>Default diskon</Label>
            <Input type="number" value={value.default_discount_percent}
              onChange={(e) => setValue({ ...value, default_discount_percent: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="font-semibold">Pajak</h3>
          <div className="flex items-center justify-between">
            <Label>Aktifkan pajak</Label>
            <Switch checked={value.enable_tax} onCheckedChange={(v) => setValue({ ...value, enable_tax: v })} />
          </div>
          <div>
            <Label>Label pajak</Label>
            <Input value={value.tax_label} onChange={(e) => setValue({ ...value, tax_label: e.target.value })} />
          </div>
          <div>
            <Label>Default tarif pajak (%)</Label>
            <Input type="number" value={value.default_tax_percent}
              onChange={(e) => setValue({ ...value, default_tax_percent: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Harga sudah termasuk pajak</Label>
            <Switch checked={value.tax_inclusive} onCheckedChange={(v) => setValue({ ...value, tax_inclusive: v })} />
          </div>
        </div>
      </div>
    </SettingsPage>
  );
}
