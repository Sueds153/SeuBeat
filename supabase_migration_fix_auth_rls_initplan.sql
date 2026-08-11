-- Migration: Corrigir warnings do Supabase Advisor
-- 1) WARN performance `auth_rls_initplan` — policy `admin_select` em email_events
--    reavalia auth.role() por cada linha. Fix: envolver em (select ...) → initplan.
-- 2) INFO `unused_index` — índices nunca usados (candidatos a remoção).
-- 3) WARN security `auth_leaked_password_protection` — NÃO é possível via SQL;
--    passo manual: Dashboard > Authentication > Password Protection > ativar.
--
-- Aplicar no Dashboard > SQL Editor (o MCP não tem permissão de DDL).

-- ─── 1) auth_rls_initplan (WARN) ─────────────────────────────────────────────
DROP POLICY IF EXISTS admin_select ON public.email_events;

CREATE POLICY admin_select ON public.email_events
  FOR SELECT
  USING (
    (SELECT auth.role()) = 'service_role'::text
    OR (SELECT auth.role()) = 'authenticated'::text
  );

-- ─── 2) unused_index (INFO) — remover índices que o Advisor reporta como nunca usados ───
-- email_events só recebe inserts do webhook Brevo; as leituras não filtram por estes campos.
DROP INDEX IF EXISTS idx_email_events_recipient;
DROP INDEX IF EXISTS idx_email_events_event;

-- Criados manualmente (sem ficheiro de migration) e nunca usados pelo scheduler
-- (abandonedRecoveryScheduler filtra por status/deleted_at via idx_song_requests_abandoned_status).
DROP INDEX IF EXISTS idx_song_requests_abandoned_48h;
DROP INDEX IF EXISTS idx_song_requests_abandoned_72h;

-- as queries de whatsapp_send_log usam phone/status/created_at, não request_id.
DROP INDEX IF EXISTS idx_whatsapp_send_log_request;
