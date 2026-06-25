import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  loading?: boolean;
  saving?: boolean;
  onSave: () => void;
  children: ReactNode;
}

export const SettingsPage = ({ title, description, loading, saving, onSave, children }: Props) => {
  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <Card className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
        ) : (
          children
        )}
      </Card>
      {!loading && (
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Pengaturan
          </Button>
        </div>
      )}
    </div>
  );
};
