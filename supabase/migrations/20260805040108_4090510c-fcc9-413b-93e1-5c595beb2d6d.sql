CREATE TABLE public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.escolas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  categoria text NOT NULL DEFAULT 'Outros',
  storage_path text NOT NULL,
  mime_type text,
  tamanho bigint,
  origem text NOT NULL DEFAULT 'Escola',
  visivel_portal boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'Aprovado',
  observacoes text,
  uploaded_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver documentos"
  ON public.documentos FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Usuarios autenticados podem enviar documentos"
  ON public.documentos FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admin e secretaria atualizam documentos"
  ON public.documentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Admin e secretaria excluem documentos"
  ON public.documentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'secretaria'));

CREATE INDEX idx_documentos_aluno ON public.documentos(aluno_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documentos_status ON public.documentos(status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_documentos_updated_at
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();