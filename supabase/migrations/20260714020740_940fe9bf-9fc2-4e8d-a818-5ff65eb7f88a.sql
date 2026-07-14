
-- Tabela cursos
CREATE TABLE public.cursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  carga_horaria INTEGER,
  valor NUMERIC(10,2),
  frequencia_minima INTEGER NOT NULL DEFAULT 75,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT ALL ON public.cursos TO service_role;

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem visualizar cursos"
  ON public.cursos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar cursos"
  ON public.cursos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cursos_updated_at
  BEFORE UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela turmas
CREATE TABLE public.turmas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  horario TEXT,
  dias_semana TEXT[] NOT NULL DEFAULT '{}',
  vagas_totais INTEGER,
  data_inicio DATE,
  data_termino DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_turmas_curso_id ON public.turmas(curso_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas TO authenticated;
GRANT ALL ON public.turmas TO service_role;

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem visualizar turmas"
  ON public.turmas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar turmas"
  ON public.turmas FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_turmas_updated_at
  BEFORE UPDATE ON public.turmas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
