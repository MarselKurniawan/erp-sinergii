import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Shield, Save, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface Feature { key: string; module: string; label: string; sort_order: number; }
interface PermRow { feature_key: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; }
interface UserOpt { id: string; email: string | null; full_name: string | null; role: string; }

const ACTIONS = ['can_view','can_create','can_edit','can_delete'] as const;
const ACTION_LABELS = { can_view: 'Lihat', can_create: 'Buat', can_edit: 'Edit', can_delete: 'Hapus' };

const Permissions: React.FC = () => {
  const { roles, isAdmin } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const allowed = isSuperAdmin || isAdmin;

  const [users, setUsers] = useState<UserOpt[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [permMap, setPermMap] = useState<Record<string, PermRow>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const [{ data: profs }, { data: ur }, { data: feats }] = await Promise.all([
        supabase.from('profiles').select('id,email,full_name').order('full_name'),
        supabase.from('user_roles').select('user_id,role'),
        supabase.from('features' as any).select('*').order('sort_order'),
      ]);
      const roleByUser: Record<string, string> = {};
      (ur || []).forEach((r: any) => { roleByUser[r.user_id] = r.role; });
      setUsers((profs || []).map((p: any) => ({ ...p, role: roleByUser[p.id] || 'user' })));
      setFeatures(((feats as any) || []) as Feature[]);
    })();
  }, [allowed]);

  useEffect(() => {
    if (!selectedUser) { setPermMap({}); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('user_permissions' as any)
        .select('*').eq('user_id', selectedUser);
      const m: Record<string, PermRow> = {};
      (data as any[] || []).forEach(r => { m[r.feature_key] = r; });
      setPermMap(m);
      setLoading(false);
    })();
  }, [selectedUser]);

  const grouped = useMemo(() => {
    const g: Record<string, Feature[]> = {};
    features.forEach(f => { (g[f.module] ||= []).push(f); });
    return g;
  }, [features]);

  const toggle = (key: string, action: typeof ACTIONS[number], val: boolean) => {
    setPermMap(prev => ({
      ...prev,
      [key]: {
        feature_key: key,
        can_view: prev[key]?.can_view || false,
        can_create: prev[key]?.can_create || false,
        can_edit: prev[key]?.can_edit || false,
        can_delete: prev[key]?.can_delete || false,
        [action]: val,
      } as PermRow,
    }));
  };

  const toggleModule = (mod: string, action: typeof ACTIONS[number], val: boolean) => {
    const keys = grouped[mod].map(f => f.key);
    setPermMap(prev => {
      const next = { ...prev };
      keys.forEach(k => {
        next[k] = {
          feature_key: k,
          can_view: next[k]?.can_view || false,
          can_create: next[k]?.can_create || false,
          can_edit: next[k]?.can_edit || false,
          can_delete: next[k]?.can_delete || false,
          [action]: val,
        } as PermRow;
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await supabase.from('user_permissions' as any).delete().eq('user_id', selectedUser);
      const rows = Object.values(permMap)
        .filter(r => r.can_view || r.can_create || r.can_edit || r.can_delete)
        .map(r => ({ ...r, user_id: selectedUser }));
      if (rows.length) {
        const { error } = await supabase.from('user_permissions' as any).insert(rows);
        if (error) throw error;
      }
      toast.success('Permission berhasil disimpan');
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Akses Ditolak</h2>
          <p className="text-muted-foreground">Hanya superadmin/admin yang dapat mengatur permission.</p>
        </CardContent></Card>
      </div>
    );
  }

  const selectedUserData = users.find(u => u.id === selectedUser);
  const isPrivilegedUser = selectedUserData && ['admin','superadmin'].includes(selectedUserData.role);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
          <KeyRound className="w-8 h-8" /> Permission Management
        </h1>
        <p className="text-muted-foreground mt-1">Atur akses per fitur dan aksi untuk setiap user.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pilih User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <SearchableSelect
              options={users.map(u => ({ value: u.id, label: `${u.full_name || 'No name'} (${u.email}) — ${u.role}` }))}
              value={selectedUser}
              onChange={setSelectedUser}
              placeholder="Pilih user..."
            />
          </div>
          {isPrivilegedUser && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <Badge>{selectedUserData.role}</Badge> otomatis punya akses penuh ke semua fitur. Pengaturan di bawah hanya berlaku untuk role <code>user</code>/<code>cashier</code>.
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && !loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Matriks Permission</CardTitle>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(grouped).map(([mod, feats]) => (
              <div key={mod} className="border rounded-lg">
                <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                  <h3 className="font-semibold">{mod}</h3>
                  <div className="flex gap-3 text-xs">
                    {ACTIONS.map(a => (
                      <label key={a} className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={feats.every(f => permMap[f.key]?.[a])}
                          onCheckedChange={(v) => toggleModule(mod, a, !!v)}
                        />
                        All {ACTION_LABELS[a]}
                      </label>
                    ))}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-2">Fitur</th>
                      {ACTIONS.map(a => (
                        <th key={a} className="text-center px-2 py-2 w-20">{ACTION_LABELS[a]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feats.map(f => (
                      <tr key={f.key} className="border-b last:border-b-0 hover:bg-muted/20">
                        <td className="px-4 py-2">{f.label}<div className="text-xs text-muted-foreground font-mono">{f.key}</div></td>
                        {ACTIONS.map(a => (
                          <td key={a} className="text-center px-2 py-2">
                            <Checkbox
                              checked={permMap[f.key]?.[a] || false}
                              onCheckedChange={(v) => toggle(f.key, a, !!v)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Permissions;
