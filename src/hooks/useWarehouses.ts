import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  address: string | null;
  pic_user_id: string | null;
  is_active: boolean;
  company_id: string;
}

export const useWarehouses = () => {
  const { selectedCompany } = useCompany();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWarehouses = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('name');

    if (!error) {
      setWarehouses(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWarehouses();
  }, [selectedCompany]);

  return {
    warehouses,
    isLoading,
    fetchWarehouses,
  };
};
