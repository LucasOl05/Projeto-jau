
-- =========================================================================
-- 1) TABELA ESCOLAS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.escolas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  padrao BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.escolas TO authenticated;
GRANT ALL ON public.escolas TO service_role;

ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escolas admin all" ON public.escolas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "escolas auth select" ON public.escolas
  FOR SELECT TO authenticated USING (true);

GRANT INSERT, UPDATE, DELETE ON public.escolas TO authenticated;

CREATE TRIGGER trg_escolas_updated
  BEFORE UPDATE ON public.escolas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed escola padrão
INSERT INTO public.escolas (nome, ativa, padrao)
SELECT 'JAU - JOVEM APRENDIZ UBERLÂNDIA', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.escolas WHERE padrao = true);

-- =========================================================================
-- 2) FUNÇÃO get_default_school_id
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_default_school_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.escolas WHERE padrao = true AND ativa = true LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_default_school_id() TO authenticated;

-- =========================================================================
-- 3) TURMAS: school_id + codigo_publico (aditivo)
-- =========================================================================
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.escolas(id);
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS codigo_publico TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.turmas_codigo_seq START 1;

UPDATE public.turmas SET school_id = public.get_default_school_id() WHERE school_id IS NULL;
UPDATE public.turmas
  SET codigo_publico = 'TUR-' || LPAD(nextval('public.turmas_codigo_seq')::text, 6, '0')
  WHERE codigo_publico IS NULL;

ALTER TABLE public.turmas ALTER COLUMN school_id SET DEFAULT public.get_default_school_id();
ALTER TABLE public.turmas ALTER COLUMN school_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_turma_codigo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo_publico IS NULL THEN
    NEW.codigo_publico := 'TUR-' || LPAD(nextval('public.turmas_codigo_seq')::text, 6, '0');
  END IF;
  IF NEW.school_id IS NULL THEN
    NEW.school_id := public.get_default_school_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turmas_codigo ON public.turmas;
CREATE TRIGGER trg_turmas_codigo BEFORE INSERT ON public.turmas
  FOR EACH ROW EXECUTE FUNCTION public.set_turma_codigo();

-- =========================================================================
-- 4) DISCIPLINAS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL DEFAULT public.get_default_school_id() REFERENCES public.escolas(id),
  turma_id UUID NOT NULL REFERENCES public.turmas(id),
  nome TEXT NOT NULL,
  professor_id UUID REFERENCES public.professores(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinas TO authenticated;
GRANT ALL ON public.disciplinas TO service_role;

ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disciplinas admin all" ON public.disciplinas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "disciplinas auth select" ON public.disciplinas
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_disciplinas_updated
  BEFORE UPDATE ON public.disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_disciplinas_turma ON public.disciplinas(turma_id);

-- =========================================================================
-- 5) DIARIO_CLASSE
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.diario_codigo_seq START 1;

CREATE TABLE IF NOT EXISTS public.diario_classe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_publico TEXT UNIQUE,
  school_id UUID NOT NULL DEFAULT public.get_default_school_id() REFERENCES public.escolas(id),
  turma_id UUID NOT NULL REFERENCES public.turmas(id),
  disciplina_id UUID NOT NULL REFERENCES public.disciplinas(id),
  data_aula DATE NOT NULL,
  conteudo_ministrado TEXT NOT NULL,
  planejamento_proxima_aula TEXT NOT NULL,
  justificativa_retroativa TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (turma_id, disciplina_id, data_aula)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_classe TO authenticated;
GRANT ALL ON public.diario_classe TO service_role;

ALTER TABLE public.diario_classe ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_diario_turma_data ON public.diario_classe(turma_id, data_aula);
CREATE INDEX IF NOT EXISTS idx_diario_disc ON public.diario_classe(disciplina_id);

-- =========================================================================
-- 6) DIARIO_CHAMADA
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.diario_chamada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL DEFAULT public.get_default_school_id() REFERENCES public.escolas(id),
  diario_id UUID NOT NULL REFERENCES public.diario_classe(id),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id),
  presente BOOLEAN NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diario_id, aluno_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_chamada TO authenticated;
GRANT ALL ON public.diario_chamada TO service_role;

ALTER TABLE public.diario_chamada ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chamada_aluno ON public.diario_chamada(aluno_id);
CREATE INDEX IF NOT EXISTS idx_chamada_diario ON public.diario_chamada(diario_id);

-- =========================================================================
-- 7) TRIGGERS: defaults + janela de edição + soft delete
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_diario_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo_publico IS NULL THEN
    NEW.codigo_publico := 'DIA-' || LPAD(nextval('public.diario_codigo_seq')::text, 6, '0');
  END IF;
  IF NEW.school_id IS NULL THEN
    NEW.school_id := public.get_default_school_id();
  END IF;
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diario_defaults ON public.diario_classe;
CREATE TRIGGER trg_diario_defaults BEFORE INSERT OR UPDATE ON public.diario_classe
  FOR EACH ROW EXECUTE FUNCTION public.set_diario_defaults();

CREATE OR REPLACE FUNCTION public.enforce_diario_window()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid());

  IF is_admin THEN
    -- Admin pode editar retroativamente, mas se a data for anterior a hoje exige justificativa
    IF NEW.data_aula < CURRENT_DATE
       AND (NEW.justificativa_retroativa IS NULL OR length(trim(NEW.justificativa_retroativa)) < 5) THEN
      RAISE EXCEPTION 'Justificativa obrigatória para edição retroativa (mínimo 5 caracteres).';
    END IF;
    RETURN NEW;
  END IF;

  -- Professor: só pode inserir/editar até 23:59 da data_aula
  IF NEW.data_aula <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Fora da janela: o lançamento só é permitido na data da aula (%). Solicite ao administrador para edição retroativa.', NEW.data_aula;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diario_window ON public.diario_classe;
CREATE TRIGGER trg_diario_window BEFORE INSERT OR UPDATE ON public.diario_classe
  FOR EACH ROW EXECUTE FUNCTION public.enforce_diario_window();

-- Janela também para chamada (via diário associado)
CREATE OR REPLACE FUNCTION public.enforce_chamada_window()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_data DATE;
  is_admin BOOLEAN;
BEGIN
  SELECT data_aula INTO v_data FROM public.diario_classe WHERE id = NEW.diario_id;
  is_admin := public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid());
  IF NEW.school_id IS NULL THEN NEW.school_id := public.get_default_school_id(); END IF;
  NEW.updated_by := auth.uid();
  IF is_admin THEN RETURN NEW; END IF;
  IF v_data <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Fora da janela: chamada só pode ser lançada/editada na data da aula (%).', v_data;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamada_window ON public.diario_chamada;
CREATE TRIGGER trg_chamada_window BEFORE INSERT OR UPDATE ON public.diario_chamada
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chamada_window();

-- Triggers de updated_at
CREATE TRIGGER trg_diario_updated BEFORE UPDATE ON public.diario_classe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_chamada_updated BEFORE UPDATE ON public.diario_chamada
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Soft delete: bloqueia DELETE físico para não-admin, converte em soft delete
CREATE OR REPLACE FUNCTION public.soft_delete_diario()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) THEN
    UPDATE public.diario_classe
      SET deleted_at = now(), status = 'Excluído', updated_by = auth.uid()
      WHERE id = OLD.id AND deleted_at IS NULL;
    RETURN NULL; -- cancela DELETE físico
  END IF;
  RAISE EXCEPTION 'Exclusão não permitida.';
END;
$$;

DROP TRIGGER IF EXISTS trg_diario_soft_delete ON public.diario_classe;
CREATE TRIGGER trg_diario_soft_delete BEFORE DELETE ON public.diario_classe
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_diario();

-- =========================================================================
-- 8) POLICIES diario_classe / diario_chamada
-- =========================================================================
-- Admin: ALL
CREATE POLICY "diario admin all" ON public.diario_classe
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Professor + Secretaria + demais autenticados: SELECT (apenas não excluídos)
CREATE POLICY "diario auth select" ON public.diario_classe
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

-- Professor: INSERT/UPDATE (janela é validada no trigger)
CREATE POLICY "diario professor insert" ON public.diario_classe
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'professor'));

CREATE POLICY "diario professor update" ON public.diario_classe
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'professor') AND created_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (public.has_role(auth.uid(), 'professor'));

-- Chamada
CREATE POLICY "chamada admin all" ON public.diario_chamada
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chamada auth select" ON public.diario_chamada
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chamada professor write" ON public.diario_chamada
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'professor')
    AND EXISTS (SELECT 1 FROM public.diario_classe d WHERE d.id = diario_id AND d.created_by = auth.uid())
  );

CREATE POLICY "chamada professor update" ON public.diario_chamada
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'professor')
    AND EXISTS (SELECT 1 FROM public.diario_classe d WHERE d.id = diario_id AND d.created_by = auth.uid())
  )
  WITH CHECK (public.has_role(auth.uid(), 'professor'));
