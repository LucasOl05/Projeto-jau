ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS telefone text;
CREATE INDEX IF NOT EXISTS idx_alunos_codigo_publico ON public.alunos (codigo_publico);
CREATE INDEX IF NOT EXISTS idx_alunos_cpf ON public.alunos (cpf);
CREATE INDEX IF NOT EXISTS idx_mensalidades_aluno_venc ON public.mensalidades (aluno_id, vencimento DESC);