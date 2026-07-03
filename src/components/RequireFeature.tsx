import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Lock } from 'lucide-react';

interface Props {
  feature: string;
  children: React.ReactNode;
}

export const RequireFeature: React.FC<Props> = ({ feature, children }) => {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(feature, 'view')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi administrator untuk meminta akses.
        </p>
      </div>
    );
  }
  return <>{children}</>;
};