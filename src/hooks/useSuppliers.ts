import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  payable_account_id: string | null;
}

export const useSuppliers = () => {
  const { selectedCompany } = useCompany();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSuppliers = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('name');

    if (!error) {
      setSuppliers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [selectedCompany]);

  return {
    suppliers,
    isLoading,
    fetchSuppliers,
  };
};
