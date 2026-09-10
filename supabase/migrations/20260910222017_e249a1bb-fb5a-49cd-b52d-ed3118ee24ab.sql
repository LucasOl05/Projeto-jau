ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS asaas_customer_id text;

ALTER TABLE public.faturas_empresas
  ADD COLUMN IF NOT EXISTS status_fiscal text NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS numero_nfse text,
  ADD COLUMN IF NOT EXISTS url_pdf_nfse text,
  ADD COLUMN IF NOT EXISTS url_xml_nfse text,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

CREATE INDEX IF NOT EXISTS idx_faturas_empresas_asaas_payment ON public.faturas_empresas(asaas_payment_id);

CREATE TABLE IF NOT EXISTS public.mensalidades_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao text,
  valor numeric NOT NULL,
  dia_vencimento integer NOT NULL DEFAULT 10,
  forma_pagamento text NOT NULL DEFAULT 'BOLETO',
  status text NOT NULL DEFAULT 'ATIVA',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensalidades_empresas TO authenticated;
GRANT ALL ON public.mensalidades_empresas TO service_role;

ALTER TABLE public.mensalidades_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam mensalidades de empresas"
ON public.mensalidades_empresas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Secretaria consulta mensalidades de empresas"
ON public.mensalidades_empresas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'));

CREATE TRIGGER trg_mensalidades_empresas_updated_at
BEFORE UPDATE ON public.mensalidades_empresas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.aluno_responsavel
  DROP CONSTRAINT IF EXISTS aluno_responsavel_aluno_id_fkey,
  ADD CONSTRAINT aluno_responsavel_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

ALTER TABLE public.aluno_responsavel
  DROP CONSTRAINT IF EXISTS aluno_responsavel_responsavel_id_fkey,
  ADD CONSTRAINT aluno_responsavel_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.responsaveis(id) ON DELETE CASCADE;