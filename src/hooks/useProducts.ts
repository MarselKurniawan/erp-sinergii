import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';

export interface Product {
  id: string;
  sku: string;
  name: string;
  product_type: 'stockable' | 'service' | 'raw_material';
  unit: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  is_active: boolean;
  revenue_account_id: string | null;
  cogs_account_id: string | null;
  category_id: string | null;
  product_tax_rates?: { tax_rate_id: string }[];
}

export const useProducts = () => {
  const { selectedCompany } = useCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, product_tax_rates(tax_rate_id)')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('name');

    if (!error) {
      setProducts((data as any) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCompany]);

  return {
    products,
    isLoading,
    fetchProducts,
  };
};
