-- Create printer_settings table for managing printer connections
CREATE TABLE public.printer_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  printer_type TEXT NOT NULL DEFAULT 'usb', -- 'usb', 'bluetooth', 'network'
  connection_type TEXT NOT NULL DEFAULT 'web_usb', -- 'web_usb', 'web_serial', 'web_bluetooth', 'network'
  device_name TEXT,
  vendor_id TEXT,
  product_id TEXT,
  ip_address TEXT,
  port INTEGER,
  paper_width TEXT DEFAULT '80mm',
  is_kitchen_printer BOOLEAN DEFAULT false,
  is_cashier_printer BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view printer settings for their companies"
ON public.printer_settings FOR SELECT
USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert printer settings for their companies"
ON public.printer_settings FOR INSERT
WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update printer settings for their companies"
ON public.printer_settings FOR UPDATE
USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete printer settings for their companies"
ON public.printer_settings FOR DELETE
USING (public.user_has_company_access(auth.uid(), company_id));

-- Add trigger for updated_at
CREATE TRIGGER update_printer_settings_updated_at
BEFORE UPDATE ON public.printer_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add printer_setting_id to receipt_settings to link receipt templates to printers
ALTER TABLE public.receipt_settings 
ADD COLUMN printer_setting_id UUID REFERENCES public.printer_settings(id) ON DELETE SET NULL;