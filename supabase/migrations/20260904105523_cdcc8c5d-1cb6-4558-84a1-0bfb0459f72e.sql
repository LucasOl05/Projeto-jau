ALTER TABLE public.diario_classe
  ADD COLUMN IF NOT EXISTS tipo_aula text NOT NULL DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS data_aula_original date,
  ADD COLUMN IF NOT EXISTS motivo_reposicao text;

ALTER TABLE public.diario_classe
  DROP CONSTRAINT IF EXISTS diario_classe_tipo_aula_check;

ALTER TABLE public.diario_classe
  ADD CONSTRAINT diario_classe_tipo_aula_check CHECK (tipo_aula IN ('Normal', 'Reposição'));

CREATE INDEX IF NOT EXISTS idx_diario_classe_tipo_aula ON public.diario_classe (tipo_aula);