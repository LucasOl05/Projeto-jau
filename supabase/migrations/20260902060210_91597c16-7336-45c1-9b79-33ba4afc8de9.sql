CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_publico TEXT UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  email TEXT,
  telefone TEXT,
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  contato_nome TEXT,
  contato_email TEXT,
  contato_telefone TEXT,
  valor_contrato NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Inativa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE SEQUENCE IF NOT EXISTS public.empresas_codigo_seq START 1;
CREATE OR REPLACE FUNCTION public.set_empresas_codigo_publico()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo_publico IS NULL THEN
    NEW.codigo_publico := 'EMP-' || lpad(nextval('public.empresas_codigo_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_empresas_codigo BEFORE INSERT ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.set_empresas_codigo_publico();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam empresas" ON public.empresas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria visualiza empresas" ON public.empresas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'secretaria') AND deleted_at IS NULL);
CREATE TABLE public.faturas_empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_publico TEXT UNIQUE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia TEXT,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  asaas_payment_id TEXT,
  asaas_invoice_url TEXT,
  asaas_pix_payload TEXT,
  nfse_numero TEXT,
  nfse_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE SEQUENCE IF NOT EXISTS public.faturas_empresas_codigo_seq START 1;
CREATE OR REPLACE FUNCTION public.set_faturas_empresas_codigo_publico()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo_publico IS NULL THEN
    NEW.codigo_publico := 'FAT-' || lpad(nextval('public.faturas_empresas_codigo_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_faturas_empresas_codigo BEFORE INSERT ON public.faturas_empresas FOR EACH ROW EXECUTE FUNCTION public.set_faturas_empresas_codigo_publico();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturas_empresas TO authenticated;
GRANT ALL ON public.faturas_empresas TO service_role;
ALTER TABLE public.faturas_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam faturas b2b" ON public.faturas_empresas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria visualiza faturas b2b" ON public.faturas_empresas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'secretaria') AND deleted_at IS NULL);
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faturas_empresas_updated_at BEFORE UPDATE ON public.faturas_empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();