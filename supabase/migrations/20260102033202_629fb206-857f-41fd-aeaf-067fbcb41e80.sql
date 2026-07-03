-- Create recipes table (Bill of Materials)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,
  recipe_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  output_quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipe_items table (materials/ingredients)
CREATE TABLE public.recipe_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for recipes
CREATE POLICY "Users can view recipes for their companies" 
ON public.recipes FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage recipes for their companies" 
ON public.recipes FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

-- RLS policies for recipe_items
CREATE POLICY "Users can view recipe items" 
ON public.recipe_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.recipes r 
  WHERE r.id = recipe_items.recipe_id 
  AND user_has_company_access(auth.uid(), r.company_id)
));

CREATE POLICY "Users can manage recipe items" 
ON public.recipe_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.recipes r 
  WHERE r.id = recipe_items.recipe_id 
  AND user_has_company_access(auth.uid(), r.company_id)
));

-- Add trigger for updated_at
CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();