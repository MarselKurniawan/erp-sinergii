-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for product types
CREATE TYPE public.product_type AS ENUM ('stockable', 'service');

-- Create enum for account types
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense', 'cash_bank');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('draft', 'confirmed', 'invoiced', 'paid', 'cancelled');

-- Create enum for invoice status
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');

-- Create enum for payment type
CREATE TYPE public.payment_type AS ENUM ('incoming', 'outgoing');

-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (CRITICAL: roles stored separately for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create user_companies table (for user-company assignment)
CREATE TABLE public.user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Create chart_of_accounts table
CREATE TABLE public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type account_type NOT NULL,
  parent_id UUID REFERENCES public.chart_of_accounts(id),
  balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Create product_categories table
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  product_type product_type NOT NULL DEFAULT 'stockable',
  category_id UUID REFERENCES public.product_categories(id),
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  revenue_account_id UUID REFERENCES public.chart_of_accounts(id),
  cogs_account_id UUID REFERENCES public.chart_of_accounts(id),
  stock_quantity DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, sku)
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  receivable_account_id UUID REFERENCES public.chart_of_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  payable_account_id UUID REFERENCES public.chart_of_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Create sales_orders table
CREATE TABLE public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status order_status NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, order_number)
);

-- Create sales_order_items table
CREATE TABLE public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  tax_percent DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  outstanding_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, invoice_number)
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status order_status NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, order_number)
);

-- Create purchase_order_items table
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  tax_percent DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bills table (for purchase)
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  outstanding_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, bill_number)
);

-- Create journal_entries table
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  is_posted BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, entry_number)
);

-- Create journal_entry_lines table
CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  description TEXT,
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  payment_type payment_type NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  cash_account_id UUID REFERENCES public.chart_of_accounts(id),
  amount DECIMAL(15,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, payment_number)
);

-- Create payment_allocations table (for allocating payments to invoices/bills)
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id),
  bill_id UUID REFERENCES public.bills(id),
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Create security definer function for checking roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to check if user has access to company
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_companies WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Companies policies
CREATE POLICY "Users can view assigned companies" ON public.companies
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND company_id = id)
  );
CREATE POLICY "Only admins can manage companies" ON public.companies
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User companies policies
CREATE POLICY "Users can view own company assignments" ON public.user_companies
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can manage user companies" ON public.user_companies
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Chart of accounts policies
CREATE POLICY "Users can view accounts for their companies" ON public.chart_of_accounts
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage accounts for their companies" ON public.chart_of_accounts
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Products policies
CREATE POLICY "Users can view products for their companies" ON public.products
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage products for their companies" ON public.products
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Product categories policies
CREATE POLICY "Users can view categories for their companies" ON public.product_categories
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage categories for their companies" ON public.product_categories
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Customers policies
CREATE POLICY "Users can view customers for their companies" ON public.customers
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage customers for their companies" ON public.customers
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Suppliers policies
CREATE POLICY "Users can view suppliers for their companies" ON public.suppliers
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage suppliers for their companies" ON public.suppliers
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Sales orders policies
CREATE POLICY "Users can view sales orders for their companies" ON public.sales_orders
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage sales orders for their companies" ON public.sales_orders
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Sales order items policies
CREATE POLICY "Users can view sales order items" ON public.sales_order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sales_orders WHERE id = sales_order_id AND public.user_has_company_access(auth.uid(), company_id))
  );
CREATE POLICY "Users can manage sales order items" ON public.sales_order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.sales_orders WHERE id = sales_order_id AND public.user_has_company_access(auth.uid(), company_id))
  );

-- Invoices policies
CREATE POLICY "Users can view invoices for their companies" ON public.invoices
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage invoices for their companies" ON public.invoices
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Purchase orders policies
CREATE POLICY "Users can view purchase orders for their companies" ON public.purchase_orders
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage purchase orders for their companies" ON public.purchase_orders
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Purchase order items policies
CREATE POLICY "Users can view purchase order items" ON public.purchase_order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = purchase_order_id AND public.user_has_company_access(auth.uid(), company_id))
  );
CREATE POLICY "Users can manage purchase order items" ON public.purchase_order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = purchase_order_id AND public.user_has_company_access(auth.uid(), company_id))
  );

-- Bills policies
CREATE POLICY "Users can view bills for their companies" ON public.bills
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage bills for their companies" ON public.bills
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Journal entries policies
CREATE POLICY "Users can view journal entries for their companies" ON public.journal_entries
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage journal entries for their companies" ON public.journal_entries
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Journal entry lines policies
CREATE POLICY "Users can view journal entry lines" ON public.journal_entry_lines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.journal_entries WHERE id = journal_entry_id AND public.user_has_company_access(auth.uid(), company_id))
  );
CREATE POLICY "Users can manage journal entry lines" ON public.journal_entry_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.journal_entries WHERE id = journal_entry_id AND public.user_has_company_access(auth.uid(), company_id))
  );

-- Payments policies
CREATE POLICY "Users can view payments for their companies" ON public.payments
  FOR SELECT USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can manage payments for their companies" ON public.payments
  FOR ALL USING (public.user_has_company_access(auth.uid(), company_id));

-- Payment allocations policies
CREATE POLICY "Users can view payment allocations" ON public.payment_allocations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND public.user_has_company_access(auth.uid(), company_id))
  );
CREATE POLICY "Users can manage payment allocations" ON public.payment_allocations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND public.user_has_company_access(auth.uid(), company_id))
  );

-- Create trigger function for profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- By default, new users get 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();