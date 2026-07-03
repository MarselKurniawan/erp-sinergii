import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import { getUserCompanies, Company } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Lock, Mail, Building2, Calendar, AlertCircle } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { id } from 'date-fns/locale';

const Profile = () => {
  const { user, profile, refreshProfile, isAdmin } = useAuth();
  const { selectedCompany } = useCompany();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [passwordChangedAt, setPasswordChangedAt] = useState<Date | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      // Fetch user companies
      const userCompanies = await getUserCompanies(user.id);
      setCompanies(userCompanies);

      // Fetch password changed at
      const { data } = await supabase
        .from('profiles')
        .select('password_changed_at')
        .eq('id', user.id)
        .single();
      
      if (data?.password_changed_at) {
        setPasswordChangedAt(new Date(data.password_changed_at));
      }
    };

    fetchData();
  }, [user]);

  const handleUpdateName = async () => {
    if (!user || !fullName.trim()) return;

    setIsSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id);

    if (error) {
      toast.error('Gagal memperbarui nama');
    } else {
      toast.success('Nama berhasil diperbarui');
      await refreshProfile();
    }
    setIsSavingName(false);
  };

  const canChangePassword = () => {
    if (!passwordChangedAt) return true;
    const daysSinceChange = differenceInDays(new Date(), passwordChangedAt);
    return daysSinceChange >= 14;
  };

  const getDaysUntilPasswordChange = () => {
    if (!passwordChangedAt) return 0;
    const nextChangeDate = addDays(passwordChangedAt, 14);
    const daysLeft = differenceInDays(nextChangeDate, new Date());
    return Math.max(0, daysLeft);
  };

  const handleUpdatePassword = async () => {
    if (!user) return;

    if (!canChangePassword()) {
      toast.error(`Anda hanya dapat mengubah password setiap 2 minggu. ${getDaysUntilPasswordChange()} hari lagi.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Password baru tidak cocok');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setIsSavingPassword(true);

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    });

    if (signInError) {
      toast.error('Password saat ini salah');
      setIsSavingPassword(false);
      return;
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      toast.error('Gagal memperbarui password: ' + error.message);
    } else {
      // Update password_changed_at
      await supabase
        .from('profiles')
        .update({ password_changed_at: new Date().toISOString() })
        .eq('id', user.id);

      toast.success('Password berhasil diperbarui');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChangedAt(new Date());
    }
    setIsSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profil Saya</h1>
        <p className="text-muted-foreground">Kelola informasi akun Anda</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informasi Profil
            </CardTitle>
            <CardDescription>Perbarui nama tampilan Anda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Email tidak dapat diubah
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Nama Lengkap</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="mt-1"
              />
            </div>

            <Button 
              onClick={handleUpdateName} 
              disabled={isSavingName || !fullName.trim()}
              className="w-full"
            >
              {isSavingName ? 'Menyimpan...' : 'Simpan Nama'}
            </Button>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Ubah Password
            </CardTitle>
            <CardDescription>
              Password dapat diubah setiap 2 minggu sekali
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canChangePassword() && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Password baru saja diubah
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Anda dapat mengubah password lagi dalam {getDaysUntilPasswordChange()} hari. 
                    Hubungi admin jika lupa password.
                  </p>
                </div>
              </div>
            )}

            {passwordChangedAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Terakhir diubah: {format(passwordChangedAt, 'dd MMMM yyyy', { locale: id })}</span>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Password Saat Ini</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan password saat ini"
                className="mt-1"
                disabled={!canChangePassword()}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password Baru</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru"
                className="mt-1"
                disabled={!canChangePassword()}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Konfirmasi Password Baru</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="mt-1"
                disabled={!canChangePassword()}
              />
            </div>

            <Button 
              onClick={handleUpdatePassword} 
              disabled={isSavingPassword || !canChangePassword() || !currentPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {isSavingPassword ? 'Menyimpan...' : 'Ubah Password'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Company Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Perusahaan
          </CardTitle>
          <CardDescription>Daftar perusahaan yang dapat Anda akses</CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada perusahaan yang ditugaskan</p>
          ) : (
            <div className="space-y-3">
              {companies.map((company) => (
                <div 
                  key={company.id} 
                  className={`p-4 rounded-lg border ${
                    selectedCompany?.id === company.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{company.name}</h3>
                        <Badge variant="outline" className="font-mono text-xs">
                          {company.code}
                        </Badge>
                        {selectedCompany?.id === company.id && (
                          <Badge className="bg-primary text-primary-foreground">Aktif</Badge>
                        )}
                      </div>
                      {company.address && (
                        <p className="text-sm text-muted-foreground mt-1">{company.address}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {company.phone && <span>📞 {company.phone}</span>}
                        {company.email && <span>✉️ {company.email}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
