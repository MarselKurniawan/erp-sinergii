import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

export function useCompanySetting<T extends Record<string, any>>(
  key: string,
  defaults: T,
) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [value, setValue] = useState<T>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("company_settings")
        .select("settings")
        .eq("company_id", companyId)
        .eq("setting_key", key)
        .maybeSingle();
      if (data?.settings) {
        setValue({ ...defaults, ...(data.settings as T) });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, key]);

  const save = useCallback(
    async (next?: T) => {
      if (!companyId) return;
      const payload = next ?? value;
      setSaving(true);
      const { error } = await (supabase as any)
        .from("company_settings")
        .upsert(
          {
            company_id: companyId,
            setting_key: key,
            settings: payload,
          },
          { onConflict: "company_id,setting_key" },
        );
      setSaving(false);
      if (error) {
        toast.error("Gagal menyimpan: " + error.message);
        return false;
      }
      toast.success("Pengaturan tersimpan");
      if (next) setValue(next);
      return true;
    },
    [companyId, key, value],
  );

  return { value, setValue, save, loading, saving };
}
