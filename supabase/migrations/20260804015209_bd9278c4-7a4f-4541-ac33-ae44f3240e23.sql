-- 1. Configurações por escola
CREATE TABLE public.configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE UNIQUE,
  notas_habilitadas BOOLEAN NOT NULL DEFAULT false,
  asaas_ambiente TEXT NOT NULL DEFAULT 'sandbox',
  asaas_api_key TEXT,
  waseller_token TEXT,
  waseller_endpoint TEXT,
  portal_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem configuracoes"
  ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerenciam configuracoes"
  ON public.configuracoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.configuracoes (school_id)
SELECT id FROM public.escolas WHERE padrao = true AND ativa = true
ON CONFLICT (school_id) DO NOTHING;

-- 2. Solicitações de acesso
CREATE TABLE public.solicitacoes_acesso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.escolas(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  recurso TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  decidido_por UUID,
  decidido_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_acesso TO authenticated;
GRANT ALL ON public.solicitacoes_acesso TO service_role;
ALTER TABLE public.solicitacoes_acesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve suas solicitacoes"
  ON public.solicitacoes_acesso FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "Usuario cria suas solicitacoes"
  ON public.solicitacoes_acesso FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins atualizam solicitacoes"
  ON public.solicitacoes_acesso FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins removem solicitacoes"
  ON public.solicitacoes_acesso FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_solicitacoes_acesso_updated_at
  BEFORE UPDATE ON public.solicitacoes_acesso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_solicitacoes_acesso_status ON public.solicitacoes_acesso(status);
CREATE INDEX idx_solicitacoes_acesso_user ON public.solicitacoes_acesso(user_id);

-- 3. Bloqueio de conta
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- 4. Total de aulas previstas por turma
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS total_aulas_previstas INTEGER;
