ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url text,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url text,
  ADD COLUMN IF NOT EXISTS asaas_pix_payload text;

CREATE UNIQUE INDEX IF NOT EXISTS mensalidades_asaas_payment_id_key ON public.mensalidades (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;

ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS asaas_customer_id text;