import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Company, getUserCompanies } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  isLoading: boolean;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  const refreshCompanies = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setSelectedCompany(null);
      setIsLoading(false);
      setHasInitialized(true);
      return;
    }

    if (!hasInitialized) {
      setIsLoading(true);
    }

    const userCompanies = await getUserCompanies(user.id);
    setCompanies(userCompanies);

    const savedCompanyId = localStorage.getItem('selectedCompanyId');
    const savedCompany = userCompanies.find((company) => company.id === savedCompanyId) ?? null;

    setSelectedCompany((currentSelectedCompany) => {
      const currentCompany = currentSelectedCompany
        ? userCompanies.find((company) => company.id === currentSelectedCompany.id) ?? null
        : null;

      if (currentCompany) {
        return currentSelectedCompany;
      }

      if (savedCompany) {
        return savedCompany;
      }

      if (userCompanies.length === 1) {
        localStorage.setItem('selectedCompanyId', userCompanies[0].id);
        return userCompanies[0];
      }

      return null;
    });

    setIsLoading(false);
    setHasInitialized(true);
  }, [hasInitialized, user]);

  useEffect(() => {
    if (!authLoading) {
      refreshCompanies();
    }
  }, [user?.id, authLoading, refreshCompanies]);

  const handleSetSelectedCompany = (company: Company) => {
    setSelectedCompany(company);
    localStorage.setItem('selectedCompanyId', company.id);
  };

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        setSelectedCompany: handleSetSelectedCompany,
        isLoading,
        refreshCompanies
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
