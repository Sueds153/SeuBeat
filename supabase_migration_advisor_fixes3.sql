-- ═══════════════════════════════════════════════════════════════════════════════
-- SeuBeat — Migration #5: Remover handle_new_user do schema public
-- ═══════════════════════════════════════════════════════════════════════════════
-- Abordagem definitiva: mover a função para schema privado para que
-- PostgREST não a exponha via /rest/v1/rpc/handle_new_user
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Criar schema privado (se não existir)
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Recriar a função no schema privado
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

-- 3. Dropar o trigger antigo e a função pública
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 4. Criar novo trigger apontando para a função privada
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- 5. Garantir que ninguém executa a privada via RPC
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Nota: Se o Auth Hook "on_user_created" estiver ativo no Dashboard,
-- o Supabase pode recriar public.handle_new_user(). Nesse caso, desativar
-- o hook em Auth > Settings > Auth Hooks e manter apenas o trigger SQL.
-- ═══════════════════════════════════════════════════════════════════════════════
