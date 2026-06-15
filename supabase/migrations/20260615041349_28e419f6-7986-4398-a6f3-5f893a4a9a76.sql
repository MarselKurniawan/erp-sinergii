
CREATE POLICY "att_select_own_company" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transaction-attachments' AND
  EXISTS (SELECT 1 FROM public.transaction_attachments a
          WHERE a.file_path = storage.objects.name
            AND public.user_has_company_access(auth.uid(), a.company_id))
);

CREATE POLICY "att_insert_own_company" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'transaction-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "att_delete_own_company" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transaction-attachments' AND
  EXISTS (SELECT 1 FROM public.transaction_attachments a
          WHERE a.file_path = storage.objects.name
            AND public.user_has_company_access(auth.uid(), a.company_id))
);
