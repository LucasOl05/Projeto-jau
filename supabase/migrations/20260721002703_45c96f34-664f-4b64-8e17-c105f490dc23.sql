
-- Sequence for public code
CREATE SEQUENCE IF NOT EXISTS public.disciplinas_codigo_seq START 1;

-- Add columns
ALTER TABLE public.disciplinas
  ADD COLUMN IF NOT EXISTS codigo_publico text UNIQUE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Ativo',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Backfill codigo_publico for existing rows
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.disciplinas WHERE codigo_publico IS NULL LOOP
    UPDATE public.disciplinas
      SET codigo_publico = 'DIS-' || LPAD(nextval('public.disciplinas_codigo_seq')::text, 6, '0')
      WHERE id = r.id;
  END LOOP;
END $$;

-- Defaults trigger function
CREATE OR REPLACE FUNCTION public.set_disciplina_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.codigo_publico IS NULL THEN
    NEW.codigo_publico := 'DIS-' || LPAD(nextval('public.disciplinas_codigo_seq')::text, 6, '0');
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
$function$;

DROP TRIGGER IF EXISTS trg_set_disciplina_defaults ON public.disciplinas;
CREATE TRIGGER trg_set_disciplina_defaults
BEFORE INSERT OR UPDATE ON public.disciplinas
FOR EACH ROW EXECUTE FUNCTION public.set_disciplina_defaults();

-- Soft delete trigger
CREATE OR REPLACE FUNCTION public.soft_delete_disciplina()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) THEN
    UPDATE public.disciplinas
      SET deleted_at = now(),
          status = 'Excluído',
          ativo = false,
          updated_by = auth.uid()
      WHERE id = OLD.id AND deleted_at IS NULL;
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'Exclusão não permitida.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_soft_delete_disciplina ON public.disciplinas;
CREATE TRIGGER trg_soft_delete_disciplina
BEFORE DELETE ON public.disciplinas
FOR EACH ROW EXECUTE FUNCTION public.soft_delete_disciplina();

-- updated_at trigger (if not already)
DROP TRIGGER IF EXISTS update_disciplinas_updated_at ON public.disciplinas;
CREATE TRIGGER update_disciplinas_updated_at
BEFORE UPDATE ON public.disciplinas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
