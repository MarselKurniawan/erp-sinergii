-- Create receipt_settings table for customizable receipt configuration
CREATE TABLE public.receipt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  receipt_type TEXT NOT NULL DEFAULT 'customer', -- 'customer' = nota pembeli, 'kitchen' = order dapur
  name TEXT NOT NULL,
  logo_url TEXT,
  header_text TEXT,
  footer_text TEXT,
  show_logo BOOLEAN DEFAULT true,
  show_company_name BOOLEAN DEFAULT true,
  show_company_address BOOLEAN DEFAULT true,
  show_company_phone BOOLEAN DEFAULT true,
  show_customer_info BOOLEAN DEFAULT true,
  show_item_details BOOLEAN DEFAULT true,
  show_payment_info BOOLEAN DEFAULT true,
  paper_size TEXT DEFAULT '80mm', -- '58mm', '80mm', 'A4'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create receipt_split_rules table for category-based splitting
CREATE TABLE public.receipt_split_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  receipt_setting_id UUID NOT NULL REFERENCES public.receipt_settings(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  category_name TEXT, -- fallback if category deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_split_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receipt_settings
CREATE POLICY "Users can view receipt settings for their companies" ON public.receipt_settings
  FOR SELECT USING (public.user_has_company_access(company_id, auth.uid()));
CREATE POLICY "Users can manage receipt settings for their companies" ON public.receipt_settings
  FOR ALL USING (public.user_has_company_access(company_id, auth.uid()));

-- RLS Policies for receipt_split_rules
CREATE POLICY "Users can view receipt split rules for their companies" ON public.receipt_split_rules
  FOR SELECT USING (public.user_has_company_access(company_id, auth.uid()));
CREATE POLICY "Users can manage receipt split rules for their companies" ON public.receipt_split_rules
  FOR ALL USING (public.user_has_company_access(company_id, auth.uid()));