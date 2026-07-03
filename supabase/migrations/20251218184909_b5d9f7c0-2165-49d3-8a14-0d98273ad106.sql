-- Create goods_receipts table for receiving goods from PO
CREATE TABLE public.goods_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id),
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create goods_receipt_items table
CREATE TABLE public.goods_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_ordered NUMERIC NOT NULL DEFAULT 0,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add status 'received' to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'received' AFTER 'confirmed';

-- Enable RLS
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for goods_receipts
CREATE POLICY "Users can view goods receipts of their companies"
ON public.goods_receipts FOR SELECT
USING (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can create goods receipts for their companies"
ON public.goods_receipts FOR INSERT
WITH CHECK (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can update goods receipts of their companies"
ON public.goods_receipts FOR UPDATE
USING (public.user_has_company_access(company_id, auth.uid()));

CREATE POLICY "Users can delete goods receipts of their companies"
ON public.goods_receipts FOR DELETE
USING (public.user_has_company_access(company_id, auth.uid()));

-- RLS policies for goods_receipt_items
CREATE POLICY "Users can view goods receipt items via receipt"
ON public.goods_receipt_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = receipt_id
    AND public.user_has_company_access(gr.company_id, auth.uid())
  )
);

CREATE POLICY "Users can create goods receipt items via receipt"
ON public.goods_receipt_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = receipt_id
    AND public.user_has_company_access(gr.company_id, auth.uid())
  )
);

CREATE POLICY "Users can update goods receipt items via receipt"
ON public.goods_receipt_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = receipt_id
    AND public.user_has_company_access(gr.company_id, auth.uid())
  )
);

CREATE POLICY "Users can delete goods receipt items via receipt"
ON public.goods_receipt_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = receipt_id
    AND public.user_has_company_access(gr.company_id, auth.uid())
  )
);