import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PermissionRow {
  feature_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export const usePermissions = () => {
  const { user, isAdmin, roles } = useAuth();
  const isSuperAdmin = roles.includes('superadmin' as any);
  const [perms, setPerms] = useState<Record<string, PermissionRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) { setPerms({}); setLoading(false); return; }
      if (isAdmin || isSuperAdmin) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_permissions' as any)
        .select('feature_key,can_view,can_create,can_edit,can_delete')
        .eq('user_id', user.id);
      const map: Record<string, PermissionRow> = {};
      (data as any[] || []).forEach(r => { map[r.feature_key] = r; });
      setPerms(map);
      setLoading(false);
    };
    load();
  }, [user, isAdmin, isSuperAdmin]);

  const can = (featureKey: string, action: PermissionAction = 'view'): boolean => {
    if (isAdmin || isSuperAdmin) return true;
    const p = perms[featureKey];
    if (!p) return false;
    switch (action) {
      case 'view': return p.can_view;
      case 'create': return p.can_create;
      case 'edit': return p.can_edit;
      case 'delete': return p.can_delete;
    }
  };

  return { can, perms, loading, isSuperAdmin };
};
