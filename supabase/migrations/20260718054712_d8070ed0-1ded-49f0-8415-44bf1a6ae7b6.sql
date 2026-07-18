
-- =========================
-- PROFESSORES
-- =========================
CREATE TABLE public.professores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professores TO authenticated;
GRANT ALL ON public.professores TO service_role;

ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar professores"
  ON public.professores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria e Professores podem visualizar professores"
  ON public.professores FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
    OR public.has_role(auth.uid(), 'professor')
  );

CREATE TRIGGER update_professores_updated_at
  BEFORE UPDATE ON public.professores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ALUNOS
-- =========================
CREATE SEQUENCE public.alunos_matricula_seq START 1000;

CREATE TABLE public.alunos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula INTEGER NOT NULL UNIQUE DEFAULT nextval('public.alunos_matricula_seq'),
  nome TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente','Ativo','Trancado','Concluído','Inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.alunos_matricula_seq OWNED BY public.alunos.matricula;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO authenticated;
GRANT ALL ON public.alunos TO service_role;
GRANT USAGE ON SEQUENCE public.alunos_matricula_seq TO authenticated, service_role;

ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar alunos"
  ON public.alunos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria e Professores podem visualizar alunos"
  ON public.alunos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
    OR public.has_role(auth.uid(), 'professor')
  );

CREATE TRIGGER update_alunos_updated_at
  BEFORE UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- RESPONSAVEIS
-- =========================
CREATE TABLE public.responsaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO authenticated;
GRANT ALL ON public.responsaveis TO service_role;

ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar responsaveis"
  ON public.responsaveis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria e Professores podem visualizar responsaveis"
  ON public.responsaveis FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
    OR public.has_role(auth.uid(), 'professor')
  );

CREATE TRIGGER update_responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ALUNO_RESPONSAVEL (N:N)
-- =========================
CREATE TABLE public.aluno_responsavel (
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES public.responsaveis(id) ON DELETE CASCADE,
  parentesco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (aluno_id, responsavel_id)
);

CREATE INDEX idx_aluno_responsavel_aluno ON public.aluno_responsavel(aluno_id);
CREATE INDEX idx_aluno_responsavel_responsavel ON public.aluno_responsavel(responsavel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_responsavel TO authenticated;
GRANT ALL ON public.aluno_responsavel TO service_role;

ALTER TABLE public.aluno_responsavel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar aluno_responsavel"
  ON public.aluno_responsavel FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria e Professores podem visualizar aluno_responsavel"
  ON public.aluno_responsavel FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
    OR public.has_role(auth.uid(), 'professor')
  );
