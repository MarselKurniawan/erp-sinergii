import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export { supabase };

export type AppRole = 'admin' | 'user' | 'cashier';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export type BusinessType = 'trading' | 'service' | 'manufacturing';

export interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  business_type: BusinessType | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export const getUserRoles = async (userId: string): Promise<AppRole[]> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }

  return data?.map(r => r.role as AppRole) || [];
};

export const getUserCompanies = async (userId: string): Promise<Company[]> => {
  // First check if user is admin
  const roles = await getUserRoles(userId);
  
  if (roles.includes('admin')) {
    // Admin can see all companies
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching companies:', error);
      return [];
    }
    return (data || []) as Company[];
  }

  // Regular user can only see assigned companies
  const { data, error } = await supabase
    .from('user_companies')
    .select('company_id, companies(*)')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user companies:', error);
    return [];
  }

  return data?.map(uc => uc.companies as unknown as Company).filter(Boolean) || [];
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
};
