-- ═══════════════════════════════════════════════════════════════════════════════
-- SeuBeat — Migration #3: Corrigir todos os warnings do Advisor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. FUNCTION_SEARCH_PATH_MUTABLE
--    Warnings: public.handle_new_user, public.set_updated_at
-- ───────────────────────────────────────────────────────────────────────────────

-- Corrigir set_updated_at (nossa função)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- handle_new_user (trigger de auth) — adicionar search_path
-- NOTA: Mantém SECURITY DEFINER porque é um trigger que precisa criar registos
CREATE OR REPLACE FUNCTION public.handle_new_user()
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

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. RLS_POLICY_ALWAYS_TRUE
--    Warnings:
--      - public.downloads UPDATE "Permitir atualização de downloads pública"
--      - public.payments INSERT "Permitir submissão de pagamento"
--      - public.song_requests INSERT "Permitir inserção de pedidos por anon"
-- ───────────────────────────────────────────────────────────────────────────────

-- 2a. downloads: política UPDATE muito permissiva
--     Remover política permissiva (service_role continua com acesso total via bypass RLS)
DROP POLICY IF EXISTS "Permitir atualização de downloads pública" ON public.downloads;

-- 2b. payments INSERT: em vez de CHECK(true), validar campos obrigatórios
DROP POLICY IF EXISTS "Permitir submissão de pagamento" ON public.payments;
CREATE POLICY "Permitir submissão de pagamento" ON public.payments
  FOR INSERT
  WITH CHECK (
    request_id IS NOT NULL
    AND user_email IS NOT NULL
    AND plan IS NOT NULL
    AND amount IS NOT NULL
  );

-- 2c. song_requests INSERT: validar campos obrigatórios em vez de CHECK(true)
DROP POLICY IF EXISTS "Permitir inserção de pedidos por anon" ON public.song_requests;
CREATE POLICY "Permitir inserção de pedidos por anon" ON public.song_requests
  FOR INSERT
  WITH CHECK (
    recipient_name IS NOT NULL
    AND relationship IS NOT NULL
    AND occasion IS NOT NULL
    AND music_style IS NOT NULL
    AND voice_type IS NOT NULL
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. PUBLIC_BUCKET_ALLOWS_LISTING
--    Warning: bucket "songs" has broad SELECT policy
-- ───────────────────────────────────────────────────────────────────────────────

-- Remover política de listagem pública no bucket songs
DROP POLICY IF EXISTS "Músicas públicas para leitura" ON storage.objects;

-- Recriar apenas para service_role (pode ler em todos os buckets)
-- NOTA: já existe "Acesso total para service_role" da migração anterior

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. SECURITY DEFINER FUNCTION EXECUTABLE (anon + authenticated)
--    Warning: public.handle_new_user() pode ser executada por anon/authenticated
-- ───────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. AUTH_LEAKED_PASSWORD_PROTECTION
--    Isto é uma configuração no Dashboard (Auth > Settings > Security),
--    não pode ser alterada via SQL. O utilizador precisa de activar manualmente.
--    Para referência: https://supabase.com/dashboard/project/xdlssfxbndwuirwcofdx/auth/settings
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
