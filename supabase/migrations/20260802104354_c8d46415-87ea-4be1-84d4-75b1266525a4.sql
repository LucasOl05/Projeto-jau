-- 1) ALUNOS: código público, escola, soft delete
CREATE SEQUENCE IF NOT EXISTS public.alunos_codigo_seq;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS codigo_publico text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.escolas(id);
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS updated_by uuid;

UPDATE public.alunos SET codigo_publico = 'ALU-' || LPAD(matricula::text, 6, '0') WHERE codigo_publico IS NULL;
UPDATE public.alunos SET school_id = public.get_default_school_id() WHERE school_id IS NULL;
SELECT setval('public.alunos_codigo_seq', GREATEST((SELECT COALESCE(MAX(matricula),0) FROM public.alunos), 1));
CREATE UNIQUE INDEX IF NOT EXISTS alunos_codigo_publico_key ON public.alunos (codigo_publico);

CREATE OR REPLACE FUNCTION public.set_aluno_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.codigo_publico IS NULL OR length(trim(NEW.codigo_publico)) = 0 THEN
    NEW.codigo_publico := 'ALU-' || LPAD(nextval('public.alunos_codigo_seq')::text, 6, '0');
  ELSE
    NEW.codigo_publico := trim(NEW.codigo_publico);
  END IF;
  IF NEW.school_id IS NULL THEN NEW.school_id := public.get_default_school_id(); END IF;
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_aluno_defaults ON public.alunos;
CREATE TRIGGER trg_set_aluno_defaults BEFORE INSERT OR UPDATE ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.set_aluno_defaults();

-- 2) MATRICULAS
CREATE SEQUENCE IF NOT EXISTS public.matriculas_codigo_seq;

CREATE TABLE IF NOT EXISTS public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_publico text UNIQUE,
  school_id uuid NOT NULL DEFAULT public.get_default_school_id() REFERENCES public.escolas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  ano_letivo integer NOT NULL,
  data_matricula date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa','Trancada','Concluída','Cancelada','Excluído')),
  observacoes text,
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS matriculas_unica_ativa
  ON public.matriculas (aluno_id, turma_id, ano_letivo) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matriculas TO authenticated;
GRANT ALL ON public.matriculas TO service_role;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matriculas admin all" ON public.matriculas;
CREATE POLICY "matriculas admin all" ON public.matriculas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "matriculas auth select" ON public.matriculas;
CREATE POLICY "matriculas auth select" ON public.matriculas FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE OR REPLACE FUNCTION public.set_matricula_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.codigo_publico IS NULL OR length(trim(NEW.codigo_publico)) = 0 THEN
    NEW.codigo_publico := 'MAT-' || LPAD(nextval('public.matriculas_codigo_seq')::text, 6, '0');
  END IF;
  IF NEW.school_id IS NULL THEN NEW.school_id := public.get_default_school_id(); END IF;
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_set_matricula_defaults ON public.matriculas;
CREATE TRIGGER trg_set_matricula_defaults BEFORE INSERT OR UPDATE ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.set_matricula_defaults();

DROP TRIGGER IF EXISTS trg_matriculas_updated_at ON public.matriculas;
CREATE TRIGGER trg_matriculas_updated_at BEFORE UPDATE ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.soft_delete_matricula()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()) THEN
    UPDATE public.matriculas SET deleted_at = now(), status = 'Excluído', updated_by = auth.uid()
      WHERE id = OLD.id AND deleted_at IS NULL;
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'Exclusão não permitida.';
END; $$;
DROP TRIGGER IF EXISTS trg_soft_delete_matricula ON public.matriculas;
CREATE TRIGGER trg_soft_delete_matricula BEFORE DELETE ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.soft_delete_matricula();

-- 3) CHAMADA: Presente / Falta / Justificada
ALTER TABLE public.diario_chamada ADD COLUMN IF NOT EXISTS situacao text;
UPDATE public.diario_chamada SET situacao = CASE WHEN presente THEN 'Presente' ELSE 'Falta' END WHERE situacao IS NULL;
ALTER TABLE public.diario_chamada
  DROP CONSTRAINT IF EXISTS diario_chamada_situacao_check;
ALTER TABLE public.diario_chamada
  ADD CONSTRAINT diario_chamada_situacao_check CHECK (situacao IS NULL OR situacao IN ('Presente','Falta','Justificada'));

CREATE OR REPLACE FUNCTION public.sync_chamada_situacao()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.situacao IS NULL THEN
    NEW.situacao := CASE WHEN NEW.presente THEN 'Presente' ELSE 'Falta' END;
  END IF;
  NEW.presente := (NEW.situacao = 'Presente');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_sync_chamada_situacao ON public.diario_chamada;
CREATE TRIGGER trg_sync_chamada_situacao BEFORE INSERT OR UPDATE ON public.diario_chamada
FOR EACH ROW EXECUTE FUNCTION public.sync_chamada_situacao();

-- 4) DIARIO: observações + planejamento opcional
ALTER TABLE public.diario_classe ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE public.diario_classe ALTER COLUMN planejamento_proxima_aula DROP NOT NULL;

-- 5) AVALIACOES E NOTAS
CREATE SEQUENCE IF NOT EXISTS public.avaliacoes_codigo_seq;

CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_publico text UNIQUE,
  school_id uuid NOT NULL DEFAULT public.get_default_school_id() REFERENCES public.escolas(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas(id),
  titulo text NOT NULL,
  descricao text,
  data_avaliacao date NOT NULL DEFAULT CURRENT_DATE,
  peso numeric,
  nota_maxima numeric,
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT ALL ON public.avaliacoes TO service_role;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avaliacoes admin all" ON public.avaliacoes;
CREATE POLICY "avaliacoes admin all" ON public.avaliacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "avaliacoes auth select" ON public.avaliacoes;
CREATE POLICY "avaliacoes auth select" ON public.avaliacoes FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "avaliacoes professor insert" ON public.avaliacoes;
CREATE POLICY "avaliacoes professor insert" ON public.avaliacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'professor'));
DROP POLICY IF EXISTS "avaliacoes professor update" ON public.avaliacoes;
CREATE POLICY "avaliacoes professor update" ON public.avaliacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'professor') AND created_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (public.has_role(auth.uid(),'professor'));

CREATE OR REPLACE FUNCTION public.set_avaliacao_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.codigo_publico IS NULL OR length(trim(NEW.codigo_publico)) = 0 THEN
    NEW.codigo_publico := 'AVA-' || LPAD(nextval('public.avaliacoes_codigo_seq')::text, 6, '0');
  END IF;
  IF NEW.school_id IS NULL THEN NEW.school_id := public.get_default_school_id(); END IF;
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_set_avaliacao_defaults ON public.avaliacoes;
CREATE TRIGGER trg_set_avaliacao_defaults BEFORE INSERT OR UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.set_avaliacao_defaults();
DROP TRIGGER IF EXISTS trg_avaliacoes_updated_at ON public.avaliacoes;
CREATE TRIGGER trg_avaliacoes_updated_at BEFORE UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.avaliacao_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL DEFAULT public.get_default_school_id() REFERENCES public.escolas(id),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  nota numeric,
  parecer text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (avaliacao_id, aluno_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacao_notas TO authenticated;
GRANT ALL ON public.avaliacao_notas TO service_role;
ALTER TABLE public.avaliacao_notas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notas admin all" ON public.avaliacao_notas;
CREATE POLICY "notas admin all" ON public.avaliacao_notas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "notas auth select" ON public.avaliacao_notas;
CREATE POLICY "notas auth select" ON public.avaliacao_notas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "notas professor insert" ON public.avaliacao_notas;
CREATE POLICY "notas professor insert" ON public.avaliacao_notas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'professor'));
DROP POLICY IF EXISTS "notas professor update" ON public.avaliacao_notas;
CREATE POLICY "notas professor update" ON public.avaliacao_notas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'professor')) WITH CHECK (public.has_role(auth.uid(),'professor'));

CREATE OR REPLACE FUNCTION public.set_nota_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.school_id IS NULL THEN NEW.school_id := public.get_default_school_id(); END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_set_nota_defaults ON public.avaliacao_notas;
CREATE TRIGGER trg_set_nota_defaults BEFORE INSERT OR UPDATE ON public.avaliacao_notas
FOR EACH ROW EXECUTE FUNCTION public.set_nota_defaults();
DROP TRIGGER IF EXISTS trg_notas_updated_at ON public.avaliacao_notas;
CREATE TRIGGER trg_notas_updated_at BEFORE UPDATE ON public.avaliacao_notas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) INDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_alunos_deleted_at ON public.alunos (deleted_at);
CREATE INDEX IF NOT EXISTS idx_alunos_nome ON public.alunos (nome);
CREATE INDEX IF NOT EXISTS idx_disciplinas_turma ON public.disciplinas (turma_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_turmas_curso ON public.turmas (curso_id);
CREATE INDEX IF NOT EXISTS idx_diario_lookup ON public.diario_classe (turma_id, disciplina_id, data_aula) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chamada_diario ON public.diario_chamada (diario_id);
CREATE INDEX IF NOT EXISTS idx_chamada_aluno ON public.diario_chamada (aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_turma ON public.matriculas (turma_id, ano_letivo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno ON public.matriculas (aluno_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_avaliacoes_lookup ON public.avaliacoes (turma_id, disciplina_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notas_avaliacao ON public.avaliacao_notas (avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_aluno_resp_aluno ON public.aluno_responsavel (aluno_id);
CREATE UNIQUE INDEX IF NOT EXISTS diario_chamada_unico ON public.diario_chamada (diario_id, aluno_id);