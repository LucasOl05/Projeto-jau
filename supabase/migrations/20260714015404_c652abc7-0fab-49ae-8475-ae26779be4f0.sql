
-- 1) Expandir enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'professor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'responsavel';

-- 2) Adicionar coluna email em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill a partir de auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS DISTINCT FROM u.email;

-- 3) Função is_super_admin (SECURITY DEFINER, lê auth.users)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND LOWER(email) = LOWER('matheusoliveiralopes0166@gmail.com')
  )
$$;

-- 4) Atualizar handle_new_user para gravar email e continuar promovendo super admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );

  IF LOWER(NEW.email) = LOWER('matheusoliveiralopes0166@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Ajustar RLS de profiles: admins não veem o super admin
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_super_admin(profiles.id)
);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_super_admin(profiles.id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_super_admin(profiles.id)
);

-- 6) Ajustar RLS de user_roles: admins não veem papéis do super admin
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_super_admin(user_roles.user_id)
);

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_super_admin(user_roles.user_id)
);

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_super_admin(user_roles.user_id)
);
