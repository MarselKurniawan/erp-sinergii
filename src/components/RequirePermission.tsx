import React from 'react';
import { usePermissions, PermissionAction } from '@/hooks/usePermissions';

interface Props {
  feature: string;
  action?: PermissionAction;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RequirePermission: React.FC<Props> = ({ feature, action = 'view', fallback = null, children }) => {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(feature, action)) return <>{fallback}</>;
  return <>{children}</>;
};
