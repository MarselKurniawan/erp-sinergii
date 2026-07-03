-- Add product_type enum value for raw_material
ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'raw_material';

-- Warehouses table
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  pic_user_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warehouses for their companies" 
ON public.warehouses FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage warehouses for their companies" 
ON public.warehouses FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

-- Product-Supplier relationship (1 product can have many suppliers)
CREATE TABLE public.product_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  cost_price NUMERIC DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, supplier_id)
);

ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product suppliers" 
ON public.product_suppliers FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM products p 
  WHERE p.id = product_suppliers.product_id 
  AND user_has_company_access(auth.uid(), p.company_id)
));

CREATE POLICY "Users can manage product suppliers" 
ON public.product_suppliers FOR ALL 
USING (EXISTS (
  SELECT 1 FROM products p 
  WHERE p.id = product_suppliers.product_id 
  AND user_has_company_access(auth.uid(), p.company_id)
));

-- Inventory stock per warehouse
CREATE TABLE public.inventory_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);

ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory stock" 
ON public.inventory_stock FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM warehouses w 
  WHERE w.id = inventory_stock.warehouse_id 
  AND user_has_company_access(auth.uid(), w.company_id)
));

CREATE POLICY "Users can manage inventory stock" 
ON public.inventory_stock FOR ALL 
USING (EXISTS (
  SELECT 1 FROM warehouses w 
  WHERE w.id = inventory_stock.warehouse_id 
  AND user_has_company_access(auth.uid(), w.company_id)
));

-- Stock transfer status enum
CREATE TYPE transfer_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'completed');

-- Stock transfers between warehouses
CREATE TABLE public.stock_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status transfer_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, transfer_number)
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock transfers for their companies" 
ON public.stock_transfers FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage stock transfers for their companies" 
ON public.stock_transfers FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

-- Stock transfer items
CREATE TABLE public.stock_transfer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock transfer items" 
ON public.stock_transfer_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM stock_transfers st 
  WHERE st.id = stock_transfer_items.transfer_id 
  AND user_has_company_access(auth.uid(), st.company_id)
));

CREATE POLICY "Users can manage stock transfer items" 
ON public.stock_transfer_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM stock_transfers st 
  WHERE st.id = stock_transfer_items.transfer_id 
  AND user_has_company_access(auth.uid(), st.company_id)
));

-- Stock opname status enum
CREATE TYPE opname_status AS ENUM ('draft', 'in_progress', 'completed');

-- Stock opname (stock count)
CREATE TABLE public.stock_opname (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opname_number TEXT NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  opname_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status opname_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, opname_number)
);

ALTER TABLE public.stock_opname ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock opname for their companies" 
ON public.stock_opname FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage stock opname for their companies" 
ON public.stock_opname FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

-- Stock opname items
CREATE TABLE public.stock_opname_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opname_id UUID NOT NULL REFERENCES public.stock_opname(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  system_quantity NUMERIC DEFAULT 0,
  actual_quantity NUMERIC DEFAULT 0,
  difference NUMERIC GENERATED ALWAYS AS (actual_quantity - system_quantity) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock opname items" 
ON public.stock_opname_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM stock_opname so 
  WHERE so.id = stock_opname_items.opname_id 
  AND user_has_company_access(auth.uid(), so.company_id)
));

CREATE POLICY "Users can manage stock opname items" 
ON public.stock_opname_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM stock_opname so 
  WHERE so.id = stock_opname_items.opname_id 
  AND user_has_company_access(auth.uid(), so.company_id)
));

-- Triggers for updated_at
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_stock_updated_at
BEFORE UPDATE ON public.inventory_stock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_transfers_updated_at
BEFORE UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_opname_updated_at
BEFORE UPDATE ON public.stock_opname
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();