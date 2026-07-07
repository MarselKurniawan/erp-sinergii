import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
}

interface Props {
  currency: string;
  rate: number;
  date?: string;
  baseCurrency?: string;
  onChange: (currency: string, rate: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const CurrencyRateField: React.FC<Props> = ({
  currency,
  rate,
  date,
  baseCurrency,
  onChange,
  disabled,
  compact,
}) => {
  const { selectedCompany } = useCompany();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);

  const base =
    baseCurrency ||
    (selectedCompany as any)?.base_currency ||
    'IDR';

  useEffect(() => {
    supabase
      .from('currencies' as any)
      .select('code,name,symbol,decimal_places')
      .eq('is_active', true)
      .order('code')
      .then(({ data }) => setCurrencies((data as any) || []));
  }, []);

  const fetchRate = async (cur: string) => {
    if (!selectedCompany || cur === base) {
      onChange(cur, 1);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('get_latest_rate' as any, {
      p_company_id: selectedCompany.id,
      p_currency: cur,
      p_date: date || new Date().toISOString().split('T')[0],
    });
    setLoading(false);
    if (error || data == null) {
      toast.warning(
        `Kurs ${cur} belum diset. Buka Settings → Mata Uang untuk input kurs.`,
      );
      onChange(cur, rate || 1);
      return;
    }
    onChange(cur, Number(data));
  };

  const handleCurrencyChange = (v: string) => {
    fetchRate(v);
  };

  return (
    <div className={compact ? 'flex gap-2 items-end' : 'grid grid-cols-2 gap-2'}>
      <div>
        <Label className="text-xs">Mata Uang</Label>
        <SearchableSelect
          value={currency || 'IDR'}
          onValueChange={handleCurrencyChange}
          disabled={disabled}
          options={currencies.map((c) => ({
            value: c.code,
            label: `${c.code} — ${c.name}`,
          }))}
          placeholder="Pilih mata uang"
        />
      </div>
      <div>
        <Label className="text-xs">
          Kurs ke {base}
          {currency && currency !== base && (
            <span className="text-muted-foreground ml-1">
              (1 {currency} = ? {base})
            </span>
          )}
        </Label>
        <div className="flex gap-1">
          <Input
            type="number"
            step="0.000001"
            min="0"
            value={rate}
            onChange={(e) => onChange(currency, parseFloat(e.target.value) || 0)}
            disabled={disabled || currency === base}
          />
          {currency && currency !== base && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || loading}
              onClick={() => fetchRate(currency)}
              title="Ambil kurs terbaru"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencyRateField;
