import { supabase } from '@/lib/supabase';

/**
 * Generate next sequential document number using database function.
 * Format: PREFIX-YYYYMM-XXXX (e.g. SO-202602-0001)
 */
export const generateDocumentNumber = async (
  companyId: string,
  documentType: 'SO' | 'PO' | 'INV' | 'BILL' | 'PAY-IN' | 'PAY-OUT' | 'JE' | 'GR' | 'DP'
): Promise<string> => {
  const { data, error } = await supabase.rpc('generate_document_number', {
    p_company_id: companyId,
    p_document_type: documentType,
  });

  if (error) {
    console.error('Error generating document number:', error);
    // Fallback to random number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${documentType}-${year}${month}-${random}`;
  }

  return data as string;
};
