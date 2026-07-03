
-- Add additional account mapping columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_account_id UUID REFERENCES public.chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS tax_account_id UUID REFERENCES public.chart_of_accounts(id);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tax_account_id UUID REFERENCES public.chart_of_accounts(id);

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS tax_account_id UUID REFERENCES public.chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS expense_account_id UUID REFERENCES public.chart_of_accounts(id);

-- Update triggers to use the explicit mappings first
CREATE OR REPLACE FUNCTION public.auto_post_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_je UUID; v_num TEXT;
  v_ar UUID; v_tax UUID; v_cust_tax UUID;
  rec RECORD;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type='invoice' AND source_id=NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT receivable_account_id, tax_account_id INTO v_ar, v_cust_tax
  FROM public.customers WHERE id = NEW.customer_id;
  v_ar := COALESCE(v_ar, public.find_account(NEW.company_id, 'asset', 'piutang'), public.find_account(NEW.company_id,'asset','receivable'));
  v_tax := COALESCE(v_cust_tax, public.find_account(NEW.company_id, 'liability', 'pajak'));

  IF v_ar IS NULL THEN RETURN NEW; END IF;

  v_num := public.generate_document_number(NEW.company_id, 'JE');
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, created_by, source_type, source_id)
  VALUES (NEW.company_id, v_num, NEW.invoice_date, 'Auto: Invoice '||NEW.invoice_number, 'posted', NEW.created_by, 'invoice', NEW.id)
  RETURNING id INTO v_je;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je, v_ar, NEW.total_amount, 0, 'Piutang dari customer');

  FOR rec IN
    SELECT COALESCE(p.revenue_account_id, public.find_account(NEW.company_id,'revenue','penjualan')) AS acct,
           SUM(ii.total) AS amt
    FROM public.invoice_items ii
    LEFT JOIN public.products p ON p.id = ii.product_id
    WHERE ii.invoice_id = NEW.id
    GROUP BY 1
  LOOP
    IF rec.acct IS NOT NULL AND rec.amt > 0 THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
      VALUES (v_je, rec.acct, 0, rec.amt, 'Pendapatan');
    END IF;
  END LOOP;

  IF NEW.tax_amount > 0 AND v_tax IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_tax, 0, NEW.tax_amount, 'PPN Keluaran');
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.auto_post_bill()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_je UUID; v_num TEXT;
  v_ap UUID; v_tax UUID; v_sup_tax UUID; v_sup_exp UUID;
  rec RECORD;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type='bill' AND source_id=NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT payable_account_id, tax_account_id, expense_account_id INTO v_ap, v_sup_tax, v_sup_exp
  FROM public.suppliers WHERE id = NEW.supplier_id;
  v_ap := COALESCE(v_ap, public.find_account(NEW.company_id, 'liability', 'hutang'), public.find_account(NEW.company_id,'liability','payable'));
  v_tax := COALESCE(v_sup_tax, public.find_account(NEW.company_id, 'asset', 'pajak'));

  IF v_ap IS NULL THEN RETURN NEW; END IF;

  v_num := public.generate_document_number(NEW.company_id, 'JE');
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, created_by, source_type, source_id)
  VALUES (NEW.company_id, v_num, NEW.bill_date, 'Auto: Bill '||NEW.bill_number, 'posted', NEW.created_by, 'bill', NEW.id)
  RETURNING id INTO v_je;

  FOR rec IN
    SELECT COALESCE(p.inventory_account_id, p.cogs_account_id, v_sup_exp,
                    public.find_account(NEW.company_id,'asset','persediaan'),
                    public.find_account(NEW.company_id,'expense','pembelian')) AS acct,
           SUM(bi.total) AS amt
    FROM public.bill_items bi
    LEFT JOIN public.products p ON p.id = bi.product_id
    WHERE bi.bill_id = NEW.id
    GROUP BY 1
  LOOP
    IF rec.acct IS NOT NULL AND rec.amt > 0 THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
      VALUES (v_je, rec.acct, rec.amt, 0, 'Pembelian/Persediaan');
    END IF;
  END LOOP;

  IF NEW.tax_amount > 0 AND v_tax IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je, v_tax, NEW.tax_amount, 0, 'PPN Masukan');
  END IF;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je, v_ap, 0, NEW.total_amount, 'Hutang ke supplier');

  RETURN NEW;
END $function$;
