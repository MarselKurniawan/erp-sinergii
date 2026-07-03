import React, { useEffect, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Building2, Check, Loader2, Plus, LogOut, Store, Briefcase, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import sinergiLogo from '@/assets/sinergi-logo.png';
import { businessTypeLabels, type BusinessType } from '@/lib/defaultCOA';

const SelectCompany = forwardRef<HTMLDivElement>((_, ref) => {
  const { user, isLoading: authLoading, signOut, isAdmin } = useAuth();
  const { companies, selectedCompany, setSelectedCompany, isLoading: companyLoading } = useCompany();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleSelectCompany = (company: typeof companies[0]) => {
    setSelectedCompany(company);
    navigate('/dashboard');
  };

  const handleContinue = () => {
    if (selectedCompany) {
      navigate('/dashboard');
    }
  };

  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={sinergiLogo} 
              alt="SINERGI ERP" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="font-heading font-bold text-lg">SINERGI</h1>
              <p className="text-xs text-muted-foreground">ERP - Select your Company</p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-heading font-bold text-foreground mb-2">
            Select Company
          </h2>
          <p className="text-muted-foreground">
            {isAdmin 
              ? 'As an admin, you have access to all companies' 
              : 'Choose the company you want to work with'}
          </p>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Companies Available</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {isAdmin 
                ? 'No companies have been created yet. Create your first company to get started.'
                : 'You have not been assigned to any company yet. Please contact your administrator.'}
            </p>
            {isAdmin && (
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Create Company
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {companies.map((company, index) => (
                <button
                  key={company.id}
                  onClick={() => handleSelectCompany(company)}
                  className={cn(
                    'relative p-6 rounded-xl border-2 text-left transition-all animate-fade-in hover:shadow-lg',
                    selectedCompany?.id === company.id
                      ? 'border-primary bg-primary/5 shadow-glow'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {selectedCompany?.id === company.id && (
                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0',
                      selectedCompany?.id === company.id
                        ? 'gradient-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {company.business_type === 'trading' && <Store className="w-6 h-6" />}
                      {company.business_type === 'service' && <Briefcase className="w-6 h-6" />}
                      {company.business_type === 'manufacturing' && <Factory className="w-6 h-6" />}
                      {!company.business_type && company.code.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {company.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">{company.code}</span>
                        {company.business_type && (
                          <Badge variant="secondary" className="text-[10px] py-0 h-4">
                            {businessTypeLabels[company.business_type as BusinessType]?.label || company.business_type}
                          </Badge>
                        )}
                      </div>
                      {company.address && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {company.address}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedCompany && (
              <div className="flex justify-center">
                <Button
                  onClick={handleContinue}
                  size="lg"
                  className="gradient-primary text-primary-foreground px-8 shadow-glow hover:shadow-lg transition-all"
                >
                  Continue to Dashboard
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
});

SelectCompany.displayName = 'SelectCompany';

export default SelectCompany;
