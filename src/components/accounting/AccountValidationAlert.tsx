import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RequiredAccount {
  type: string;
  namePattern: string;
  description: string;
  suggestedCode: string;
  suggestedName: string;
}

interface AccountValidationAlertProps {
  requiredAccountTypes: ('cash_bank' | 'receivable' | 'payable' | 'revenue' | 'expense' | 'tax' | 'discount')[];
}

const accountDefinitions: Record<string, RequiredAccount> = {
  cash_bank: {
    type: 'cash_bank',
    namePattern: '',
    description: 'Cash or Bank account for recording payments',
    suggestedCode: '1100',
    suggestedName: 'Cash',
  },
  receivable: {
    type: 'asset',
    namePattern: '%receivable%|%piutang%',
    description: 'Accounts Receivable for tracking customer debts',
    suggestedCode: '1200',
    suggestedName: 'Accounts Receivable / Piutang Usaha',
  },
  payable: {
    type: 'liability',
    namePattern: '%payable%|%hutang%|%utang%',
    description: 'Accounts Payable for tracking supplier debts',
    suggestedCode: '2100',
    suggestedName: 'Accounts Payable / Hutang Usaha',
  },
  revenue: {
    type: 'revenue',
    namePattern: '',
    description: 'Revenue account for recording sales',
    suggestedCode: '4100',
    suggestedName: 'Sales Revenue / Pendapatan Penjualan',
  },
  expense: {
    type: 'expense',
    namePattern: '',
    description: 'Expense account for recording costs',
    suggestedCode: '5100',
    suggestedName: 'General Expense / Beban Umum',
  },
  tax: {
    type: 'asset',
    namePattern: '%tax%|%pajak%|%pph%|%ppn%',
    description: 'Tax account for recording tax withholdings (e.g., PPh 23, PPN)',
    suggestedCode: '1300',
    suggestedName: 'Tax Receivable / Pajak Dibayar Dimuka (PPh 23)',
  },
  discount: {
    type: 'expense',
    namePattern: '%discount%|%diskon%|%potongan%',
    description: 'Discount account for recording sales/purchase discounts',
    suggestedCode: '5200',
    suggestedName: 'Sales Discount / Potongan Penjualan',
  },
};

export const AccountValidationAlert: React.FC<AccountValidationAlertProps> = ({
  requiredAccountTypes,
}) => {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [missingAccounts, setMissingAccounts] = useState<RequiredAccount[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccounts = async () => {
      if (!selectedCompany) return;
      setIsLoading(true);

      const missing: RequiredAccount[] = [];

      for (const accountKey of requiredAccountTypes) {
        const def = accountDefinitions[accountKey];
        if (!def) continue;

        let query = supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('company_id', selectedCompany.id)
          .eq('is_active', true);

        // For cash_bank, just check the account type
        if (accountKey === 'cash_bank') {
          query = query.eq('account_type', 'cash_bank' as any);
        } else if (accountKey === 'receivable') {
          query = query.eq('account_type', 'asset' as any).or('name.ilike.%receivable%,name.ilike.%piutang%');
        } else if (accountKey === 'payable') {
          query = query.eq('account_type', 'liability' as any).or('name.ilike.%payable%,name.ilike.%hutang%,name.ilike.%utang%');
        } else if (accountKey === 'tax') {
          // Tax can be asset (prepaid) or liability
          query = query.or('name.ilike.%tax%,name.ilike.%pajak%,name.ilike.%pph%,name.ilike.%ppn%');
        } else if (accountKey === 'discount') {
          query = query.or('name.ilike.%discount%,name.ilike.%diskon%,name.ilike.%potongan%');
        } else if (accountKey === 'revenue') {
          query = query.eq('account_type', 'revenue' as any);
        } else if (accountKey === 'expense') {
          query = query.eq('account_type', 'expense' as any);
        }

        const { data } = await query.limit(1);

        if (!data || data.length === 0) {
          missing.push(def);
        }
      }

      setMissingAccounts(missing);
      setIsLoading(false);
    };

    checkAccounts();
  }, [selectedCompany, requiredAccountTypes]);

  if (isLoading || missingAccounts.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-warning bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">Akun Belum Lengkap</AlertTitle>
      <AlertDescription>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline cursor-pointer mt-1">
            <span>
              {missingAccounts.length} akun yang diperlukan belum dibuat
            </span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Untuk melanjutkan transaksi, silakan buat akun-akun berikut di Chart of Accounts:
            </p>
            <div className="space-y-2">
              {missingAccounts.map((acc, index) => (
                <div
                  key={index}
                  className="bg-background/50 rounded-lg p-3 border border-border/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {acc.suggestedCode} - {acc.suggestedName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {acc.description}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground capitalize">
                      {acc.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/chart-of-accounts')}
              className="mt-2"
            >
              Buka Chart of Accounts
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  );
};

export default AccountValidationAlert;
