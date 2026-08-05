CREATE POLICY "Documentos: leitura autenticada"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "Documentos: upload autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Documentos: update admin/secretaria"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'secretaria')));

CREATE POLICY "Documentos: delete admin/secretaria"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'secretaria')));