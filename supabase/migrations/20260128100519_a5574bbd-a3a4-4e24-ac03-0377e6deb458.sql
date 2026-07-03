-- Add new columns to pos_tax_rates for Tax & Services customization
ALTER TABLE pos_tax_rates 
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS show_on_receipt boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS calculation_method text DEFAULT 'add_to_subtotal',
ADD COLUMN IF NOT EXISTS apply_order integer DEFAULT 1;

-- calculation_method can be: 'add_to_subtotal', 'add_to_total', 'included_in_price'
-- apply_order determines the sequence of applying multiple taxes/services

COMMENT ON COLUMN pos_tax_rates.display_name IS 'Display name shown on receipt (if different from name)';
COMMENT ON COLUMN pos_tax_rates.show_on_receipt IS 'Whether to show this tax/service on receipt';
COMMENT ON COLUMN pos_tax_rates.calculation_method IS 'How to calculate: add_to_subtotal, add_to_total, included_in_price';
COMMENT ON COLUMN pos_tax_rates.apply_order IS 'Order of applying multiple taxes/services';