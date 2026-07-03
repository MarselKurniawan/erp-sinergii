import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-generates a master-data code via the existing
 * public.generate_document_number RPC. Used for product SKU,
 * customer code, supplier code, contact code, etc.
 */
export async function generateCode(companyId: string, prefix: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("generate_document_number", {
    p_company_id: companyId,
    p_document_type: prefix,
  });
  if (error || !data) {
    // Fallback: timestamp-based
    return `${prefix}-${Date.now().toString().slice(-8)}`;
  }
  return String(data);
}
