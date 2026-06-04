import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, User as UserIcon, Building2, Pencil, Eye, EyeOff, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  roles: AppRole[];
  companies: { id: string; name: string; code: string }[];
}

interface Company {
  id: string;
  name: string;
  code: string;
}

interface Feature { key: string; module: string; label: string; sort_order: number; }
interface PermRow { feature_key: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; }
const ACTIONS = ['can_view','can_create','can_edit','can_delete'] as const;
const ACTION_LABELS = { can_view: 'Lihat', can_create: 'Buat', can_edit: 'Edit', can_delete: 'Hapus' };

const Users: React.FC = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit user dialog
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user' as AppRole,
    companyIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Permission matrix state
  const [features, setFeatures] = useState<Feature[]>([]);
  const [permMap, setPermMap] = useState<Record<string, PermRow>>({});

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchCompanies();
      fetchFeatures();
    }
  }, [isAdmin]);

  const fetchFeatures = async () => {
    const { data } = await supabase.from('features' as any).select('*').order('sort_order');
    setFeatures(((data as any) || []) as Feature[]);
  };

  const loadUserPermissions = async (userId: string) => {
    const { data } = await supabase.from('user_permissions' as any)
      .select('*').eq('user_id', userId);
    const m: Record<string, PermRow> = {};
    (data as any[] || []).forEach(r => { m[r.feature_key] = r; });
    setPermMap(m);
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const { data: userCompanies, error: ucError } = await supabase
        .from('user_companies')
        .select('user_id, company_id, companies(id, name, code)');

      if (ucError) throw ucError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        roles: (roles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role),
        companies: (userCompanies || [])
          .filter(uc => uc.user_id === profile.id)
          .map(uc => uc.companies as unknown as Company)
          .filter(Boolean),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  // Open dialog for adding new user
  const openAddUserDialog = () => {
    setEditingUser(null);
    setUserForm({ email: '', password: '', full_name: '', role: 'user', companyIds: [] });
    setShowPassword(false);
    setUserDialogOpen(true);
  };

  // Open dialog for editing user
  const openEditUserDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setUserForm({
      email: user.email || '',
      password: '',
      full_name: user.full_name || '',
      role: user.roles[0] || 'user',
      companyIds: user.companies.map(c => c.id),
    });
    setUserDialogOpen(true);
  };

  // Handle add new user via Edge Function (no auto-login)
  const handleAddUser = async () => {
    if (!userForm.email.trim() || !userForm.password.trim()) {
      toast.error('Email and password are required');
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: userForm.email.trim(),
          password: userForm.password.trim(),
          full_name: userForm.full_name.trim(),
          role: userForm.role,
          companyIds: userForm.companyIds,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('User created successfully');
      setUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit user (profile only)
  const handleEditUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: userForm.full_name.trim(),
          email: userForm.email.trim(),
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: editingUser.id, role: userForm.role });

      if (roleError) throw roleError;

      // Update company assignments (only for non-admin users)
      await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', editingUser.id);

      if (userForm.role !== 'admin' && userForm.companyIds.length > 0) {
        const { error: companyError } = await supabase
          .from('user_companies')
          .insert(
            userForm.companyIds.map(companyId => ({
              user_id: editingUser.id,
              company_id: companyId,
            }))
          );

        if (companyError) console.error('Error assigning companies:', companyError);
      }

      toast.success('User updated successfully');
      setUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  // Open delete confirmation
  const openDeleteDialog = (user: UserWithRole) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Delete user roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userToDelete.id);

      // Delete user companies
      await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', userToDelete.id);

      // Delete profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You need administrator privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage users, roles and company assignments</p>
        </div>
        <Button onClick={openAddUserDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                      <Select
                        value={user.roles[0] || 'user'}
                        onValueChange={(value) => handleRoleChange(user.id, value as AppRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-destructive" />
                              Super Admin
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Admin
                            </div>
                          </SelectItem>
                          <SelectItem value="user">
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-4 h-4" />
                              User
                            </div>
                          </SelectItem>
                          <SelectItem value="cashier">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4" />
                              Kasir
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.includes('admin') ? (
                          <Badge variant="secondary">All Companies</Badge>
                        ) : user.companies.length > 0 ? (
                          <>
                            {user.companies.slice(0, 2).map(c => (
                              <Badge key={c.id} variant="outline">{c.code}</Badge>
                            ))}
                            {user.companies.length > 2 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                                    +{user.companies.length - 2}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0" align="start">
                                  <div className="p-3 border-b">
                                    <p className="font-semibold text-sm flex items-center gap-2">
                                      <Building2 className="w-4 h-4" />
                                      All Companies ({user.companies.length})
                                    </p>
                                  </div>
                                  <ScrollArea className="max-h-60">
                                    <div className="p-2 space-y-1">
                                      {user.companies.map(c => (
                                        <div key={c.id} className="text-sm p-2 rounded hover:bg-muted">
                                          <span className="font-mono font-medium">{c.code}</span>
                                          <span className="text-muted-foreground ml-2">- {c.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                            )}
                          </>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Not Assigned</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditUserDialog(user)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(user)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={userForm.full_name}
                onChange={(e) => setUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email"
                disabled={!!editingUser}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(value) => setUserForm(prev => ({ ...prev, role: value as AppRole, companyIds: value === 'admin' ? [] : prev.companyIds }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (All Companies)</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="cashier">Kasir (POS Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userForm.role !== 'admin' && (
              <div className="space-y-2">
                <Label>Assign Companies</Label>
                <p className="text-xs text-muted-foreground">
                  Select which companies this user can access:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {companies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No companies available</p>
                  ) : (
                    companies.map(company => (
                      <div
                        key={company.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`form-company-${company.id}`}
                          checked={userForm.companyIds.includes(company.id)}
                          onCheckedChange={(checked) => {
                            setUserForm(prev => ({
                              ...prev,
                              companyIds: checked
                                ? [...prev.companyIds, company.id]
                                : prev.companyIds.filter(id => id !== company.id)
                            }));
                          }}
                        />
                        <Label htmlFor={`form-company-${company.id}`} className="flex-1 cursor-pointer">
                          <span className="font-medium">{company.name}</span>
                          <span className="text-muted-foreground ml-2">({company.code})</span>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {userForm.companyIds.length === 0 && (
                  <p className="text-xs text-amber-600">User won't be able to access any company data without assignments.</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={editingUser ? handleEditUser : handleAddUser}
                disabled={saving}
              >
                {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <PasswordConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete User"
        description={`Are you sure you want to delete ${userToDelete?.full_name || userToDelete?.email}? This action cannot be undone and will remove all their roles and company assignments.`}
        onConfirm={handleDeleteUser}
      />
    </div>
  );
};

export default Users;
