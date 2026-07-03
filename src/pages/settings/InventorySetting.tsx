import { SettingsPage } from "@/components/settings/SettingsPage";
import { useCompanySetting } from "@/hooks/useCompanySetting";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Inv = {
  costing_method: "average" | "fifo";
  allow_negative_stock: boolean;
  auto_create_movement: boolean;
  default_low_stock_threshold: number;
  require_warehouse: boolean;
  enable_batch_tracking: boolean;
};

const defaults: Inv = {
  costing_method: "average",
  allow_negative_stock: false,
  auto_create_movement: true,
  default_low_stock_threshold: 10,
  require_warehouse: true,
  enable_batch_tracking: false,
};

export default function InventorySetting() {
  const { value, setValue, save, loading, saving } = useCompanySetting("inventory", defaults);
  return (
    <SettingsPage title="Inventory Setting" loading={loading} saving={saving} onSave={() => save()}>
      <div className="space-y-4">
        <div>
          <Label>Metode Costing</Label>
          <select className="input-field w-full" value={value.costing_method}
            onChange={(e) => setValue({ ...value, costing_method: e.target.value as any })}>
            <option value="average">Weighted Average</option>
            <option value="fifo">FIFO</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">Catatan: pengaturan utama costing per perusahaan diatur di tabel companies.</p>
        </div>
        <div>
          <Label>Batas Stok Rendah Default</Label>
          <Input type="number" value={value.default_low_stock_threshold}
            onChange={(e) => setValue({ ...value, default_low_stock_threshold: parseInt(e.target.value) || 0 })} />
        </div>
        {(["allow_negative_stock","auto_create_movement","require_warehouse","enable_batch_tracking"] as const).map((k) => (
          <div key={k} className="flex items-center justify-between border-b pb-2">
            <Label className="capitalize">{k.replace(/_/g," ")}</Label>
            <Switch checked={value[k]} onCheckedChange={(v) => setValue({ ...value, [k]: v })} />
          </div>
        ))}
      </div>
    </SettingsPage>
  );
}
