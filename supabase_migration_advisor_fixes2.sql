-- ═══════════════════════════════════════════════════════════════════════════════
-- SeuBeat — Migration #4: handle_new_user SECURITY DEFINER exposure
-- ═══════════════════════════════════════════════════════════════════════════════
-- O Supabase Auth Auto-schema Management recria handle_new_user com EXECUTE
-- público. A solução é mover a lógica para um schema privado e deixar na
-- public apenas um wrapper SEM EXECUTE público.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Criar schema privado para funções internas
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Mover a função original para o schema privado com SECURITY DEFINER
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, auth_user_id)
  VALUES (
    gen_random_uuid(),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.id
  );
  RETURN NEW;
END;
$$;

-- 3. Substituir a função pública por um wrapper que apenas chama a privada
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.handle_new_user();
END;
$$;

-- 4. Revogar EXECUTE da pública (o trigger continua a funcionar porque
--    corre no contexto de quem fez INSERT em auth.users — o próprio Supabase)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 5. Garantir que a privada não é exposta via RPC
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Leaked password protection (Dashboard manual)
--    Ir a: https://supabase.com/dashboard/project/xdlssfxbndwuirwcofdx/auth/settings
--    Activar "Leaked password protection"
-- ═══════════════════════════════════════════════════════════════════════════════
