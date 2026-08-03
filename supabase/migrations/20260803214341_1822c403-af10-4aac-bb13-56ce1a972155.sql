ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.professores ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE SEQUENCE IF NOT EXISTS public.mensalidades_codigo_seq;

CREATE TABLE IF NOT EXISTS public.mensalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_publico text UNIQUE,
  school_id uuid REFERENCES public.escolas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  responsavel_id uuid REFERENCES public.responsaveis(id),
  matricula_id uuid REFERENCES public.matriculas(id),
  descricao text,
  competencia text,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Pago','Atrasado','Cancelado')),
  data_pagamento date,
  valor_pago numeric(12,2),
  forma_pagamento text CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('PIX','Boleto','Cartão','Dinheiro')),
  observacoes text,
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensalidades TO authenticated;
GRANT ALL ON public.mensalidades TO service_role;

ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensalidades_select_auth" ON public.mensalidades;
CREATE POLICY "mensalidades_select_auth" ON public.mensalidades
  FOR SELECT TO authenticated USING (deleted_at IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "mensalidades_admin_all" ON public.mensalidades;
CREATE POLICY "mensalidades_admin_all" ON public.mensalidades
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria'));

CREATE OR REPLACE FUNCTION public.set_mensalidade_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.codigo_publico IS NULL OR length(trim(NEW.codigo_publico)) = 0 THEN
    NEW.codigo_publico := 'FIN-' || LPAD(nextval('public.mensalidades_codigo_seq')::text, 6, '0');
  END IF;
  IF NEW.school_id IS NULL THEN NEW.school_id := public.get_default_school_id(); END IF;
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_mensalidade_defaults ON public.mensalidades;
CREATE TRIGGER trg_set_mensalidade_defaults BEFORE INSERT OR UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.set_mensalidade_defaults();

DROP TRIGGER IF EXISTS trg_mensalidades_updated_at ON public.mensalidades;
CREATE TRIGGER trg_mensalidades_updated_at BEFORE UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_mensalidades_aluno ON public.mensalidades(aluno_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_venc ON public.mensalidades(vencimento);
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno ON public.matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_turma ON public.matriculas(turma_id);