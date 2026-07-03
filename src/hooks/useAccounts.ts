import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
}

export const useAccounts = () => {
  const { selectedCompany } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('code');

    if (!error) {
      setAccounts(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedCompany]);

  const getAccountsByType = (type: string) => {
    return accounts.filter(a => a.account_type === type);
  };

  const getRevenueAccounts = () => getAccountsByType('revenue');
  const getExpenseAccounts = () => getAccountsByType('expense');
  const getAssetAccounts = () => getAccountsByType('asset');
  const getLiabilityAccounts = () => getAccountsByType('liability');
  const getCashBankAccounts = () => getAccountsByType('cash_bank');
  const getReceivableAccounts = () =>
    accounts.filter(
      (a) =>
        a.account_type === 'asset' &&
        (a.name.toLowerCase().includes('receivable') || a.name.toLowerCase().includes('piutang'))
    );
  const getPayableAccounts = () =>
    accounts.filter(
      (a) =>
        a.account_type === 'liability' &&
        (a.name.toLowerCase().includes('payable') || a.name.toLowerCase().includes('hutang'))
    );
  const getCogsAccounts = () =>
    accounts.filter(
      (a) =>
        a.account_type === 'expense' &&
        (a.name.toLowerCase().includes('cogs') || a.name.toLowerCase().includes('cost'))
    );

  return {
    accounts,
    isLoading,
    fetchAccounts,
    getAccountsByType,
    getRevenueAccounts,
    getExpenseAccounts,
    getAssetAccounts,
    getLiabilityAccounts,
    getCashBankAccounts,
    getReceivableAccounts,
    getPayableAccounts,
    getCogsAccounts,
  };
};
