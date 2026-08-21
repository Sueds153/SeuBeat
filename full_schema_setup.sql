-- SEUBEAT FULL SCHEMA SETUP --

-- FILE: supabase_setup.sql --
-- =============================================================================
-- SeuBeat — Schema de Configuração do Supabase (regenerado a partir da produção)
-- Data: 2026-08-17 | Regenerado via dump do schema real (pg_dump / information_schema)
-- Uso: cola no "SQL Editor" do painel Supabase e clica em "Run" (idempotente)
--
-- ⚠️ Este ficheiro é gerado a partir do schema real da produção para servir de
--    referência/bootstrap. As alterações incrementais são feitas nos ficheiros
--    supabase_migration_*.sql. Se houver discrepância, as migrations mandam.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA USERS (clientes sem autenticação obrigatória)
--    id usa gen_random_uuid(); backend usa service_role para bypass de RLS.
--    NOTA: users_id_fkey (auto-referenciada) foi removida em produção — impedia
--    QUALQUER novo insert. Não recriar.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE,
  number text,
  name text,
  phone text,
  auth_user_id uuid UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA SONG_REQUESTS (pedidos do wizard)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.song_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id),
  recipient_name text NOT NULL,
  recipient_nick text,
  recipient_gender text,
  relationship text NOT NULL,
  occasion text NOT NULL,
  music_style text NOT NULL,
  voice_type text NOT NULL,
  special_traits text,
  memory text,
  heart_message text,
  desired_emotion text NOT NULL,
  email text NOT NULL,
  phone text,
  status text DEFAULT 'draft',
  photo_url text,
  voice_sample_url text,
  elevenlabs_voice_id text,
  cloned_speech_url text,
  final_mixed_audio_url text,
  error_details jsonb,
  language text DEFAULT 'português',
  hook_phrase text,
  deliver_at timestamptz,
  delivered_at timestamptz,
  deleted_at timestamptz,
  reference_artist text,
  why_created_today text,
  only_she_does text,
  where_it_happened text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  abandoned_30min_sent_at timestamptz,
  abandoned_24h_sent_at timestamptz,
  abandoned_48h_sent_at timestamptz,
  abandoned_72h_sent_at timestamptz,
  abandoned_7d_sent_at timestamptz,
  whatsapp_30min_sent_at timestamptz,
  whatsapp_24h_sent_at timestamptz,
  whatsapp_48h_sent_at timestamptz,
  whatsapp_72h_sent_at timestamptz,
  follow_up_7d_sent_at timestamptz,
  follow_up_30d_sent_at timestamptz,
  manual_contacted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA SONGS (músicas geradas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.song_requests(id) ON DELETE CASCADE,
  title text,
  lyrics jsonb,
  lyrics_snippet text,
  letter_text text,
  audio_url text,
  preview_url text,
  full_song_url text,
  duration integer,
  mureka_task_id text,
  mureka_status text DEFAULT 'not_started',
  regeneration_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABELA PAYMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.song_requests(id) ON DELETE CASCADE,
  user_email text,
  plan text NOT NULL,
  amount numeric NOT NULL,
  payment_reference text,
  proof_url text,
  proof_filename text,
  proof_path text,
  status text DEFAULT 'pending',
  notes text,
  approved_at timestamptz,
  meta_purchase_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABELA DOWNLOADS (contagem de downloads da dedicatória)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.downloads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.song_requests(id) ON DELETE CASCADE,
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABELA EMAIL_EVENTS (rastreio de eventos de email / webhook Brevo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event text NOT NULL,
  recipient_email text NOT NULL,
  message_id text,
  reason text,
  subject text,
  request_id uuid REFERENCES public.song_requests(id),
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TABELA VOICE_CLONES (clonagem de voz)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_clones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.song_requests(id) ON DELETE CASCADE,
  voice_sample_url text NOT NULL,
  voice_model_id text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TABELA WHATSAPP_SEND_LOG (envio WhatsApp Cloud API)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_send_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.song_requests(id) ON DELETE CASCADE,
  phone text NOT NULL,
  status text NOT NULL,
  error text,
  message_id text,
  template_name text,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. TABELA ADMIN_AUDIT_LOG (auditoria de acções admin + undo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_data jsonb,
  new_data jsonb,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES (otimização de queries comuns + unique guards)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_song_requests_user_id     ON public.song_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_song_requests_created_at  ON public.song_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_song_requests_deliver_at  ON public.song_requests(deliver_at);
CREATE INDEX IF NOT EXISTS idx_song_requests_utm_campaign ON public.song_requests(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_song_requests_abandoned_status ON public.song_requests(status);
CREATE INDEX IF NOT EXISTS idx_songs_request_id          ON public.songs(request_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at          ON public.songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at       ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_pending_request  ON public.payments(request_id) WHERE status = 'pending_verification';
CREATE INDEX IF NOT EXISTS idx_email_events_request_id   ON public.email_events(request_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_created ON public.whatsapp_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity    ON public.admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created   ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id        ON public.users(auth_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_clones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

-- users: apenas o próprio perfil (auth_user_id ou id) — leitura/edição
DROP POLICY IF EXISTS "Utilizadores podem ver o seu próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Utilizadores podem editar o seu próprio perfil" ON public.users;
CREATE POLICY "Utilizadores podem ver o seu próprio perfil" ON public.users
  FOR SELECT TO public
  USING (auth.uid() = auth_user_id OR auth.uid() = id);
CREATE POLICY "Utilizadores podem editar o seu próprio perfil" ON public.users
  FOR UPDATE TO public
  USING (auth.uid() = auth_user_id OR auth.uid() = id)
  WITH CHECK (auth.uid() = auth_user_id OR auth.uid() = id);

-- song_requests: leitura pública p/ dedicatória (anon) + dono (authenticated) + insert anon
DROP POLICY IF EXISTS "Anon pode ler song_requests para dedicatória" ON public.song_requests;
DROP POLICY IF EXISTS "Clientes podem ver os seus pedidos" ON public.song_requests;
DROP POLICY IF EXISTS "Permitir inserção de pedidos por anon" ON public.song_requests;
CREATE POLICY "Anon pode ler song_requests para dedicatória" ON public.song_requests
  FOR SELECT TO anon
  USING (true);
CREATE POLICY "Clientes podem ver os seus pedidos" ON public.song_requests
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Permitir inserção de pedidos por anon" ON public.song_requests
  FOR INSERT TO public
  WITH CHECK (recipient_name IS NOT NULL AND relationship IS NOT NULL AND occasion IS NOT NULL AND music_style IS NOT NULL AND voice_type IS NOT NULL);

-- songs: músicas e previews são públicos
DROP POLICY IF EXISTS "Músicas e previews são públicos" ON public.songs;
CREATE POLICY "Músicas e previews são públicos" ON public.songs
  FOR SELECT TO public
  USING (true);

-- payments: dono vê os seus; insert com campos obrigatórios
DROP POLICY IF EXISTS "Clientes podem ver os seus pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Permitir submissão de pagamento" ON public.payments;
CREATE POLICY "Clientes podem ver os seus pagamentos" ON public.payments
  FOR SELECT TO public
  USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Permitir submissão de pagamento" ON public.payments
  FOR INSERT TO public
  WITH CHECK (request_id IS NOT NULL AND user_email IS NOT NULL AND plan IS NOT NULL AND amount IS NOT NULL);

-- downloads: leitura pública (contador)
DROP POLICY IF EXISTS "Permitir visualização de downloads pública" ON public.downloads;
CREATE POLICY "Permitir visualização de downloads pública" ON public.downloads
  FOR SELECT TO public
  USING (true);

-- email_events: leitura apenas service_role/authenticated; insert service_role
DROP POLICY IF EXISTS "admin_select" ON public.email_events;
DROP POLICY IF EXISTS "service_role_insert" ON public.email_events;
CREATE POLICY "admin_select" ON public.email_events
  FOR SELECT TO public
  USING ((SELECT auth.role()) = 'service_role' OR (SELECT auth.role()) = 'authenticated');
CREATE POLICY "service_role_insert" ON public.email_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- voice_clones: dono vê as suas amostras
DROP POLICY IF EXISTS "Utilizadores vêem apenas as suas amostras de voz" ON public.voice_clones;
CREATE POLICY "Utilizadores vêem apenas as suas amostras de voz" ON public.voice_clones
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.song_requests WHERE song_requests.id = voice_clones.request_id AND (song_requests.user_id = auth.uid() OR song_requests.user_id IS NULL)));

-- admin_audit_log e whatsapp_send_log: DENY all a anon/authenticated (só service_role)
DROP POLICY IF EXISTS "deny_all" ON public.admin_audit_log;
CREATE POLICY "deny_all" ON public.admin_audit_log
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

DROP POLICY IF EXISTS "deny_all" ON public.whatsapp_send_log;
CREATE POLICY "deny_all" ON public.whatsapp_send_log
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
REVOKE ALL ON public.whatsapp_send_log FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS DE UPDATED_AT
-- ─────────────────────────────────────────────────────────────────────────────
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

DROP TRIGGER IF EXISTS trg_users_updated_at         ON public.users;
DROP TRIGGER IF EXISTS trg_song_requests_updated_at ON public.song_requests;
DROP TRIGGER IF EXISTS trg_songs_updated_at         ON public.songs;
DROP TRIGGER IF EXISTS trg_payments_updated_at      ON public.payments;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_song_requests_updated_at
  BEFORE UPDATE ON public.song_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_songs_updated_at
  BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEMA PRIVADO (funções internas não expostas via /rest/v1/rpc)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;

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

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE (BUCKETS + POLÍTICAS)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('payment-proofs', 'payment-proofs', false, 52428800),
  ('full-audio', 'full-audio', false, 52428800),
  ('preview', 'preview', true, 52428800),
  ('voice-samples', 'voice-samples', false, 52428800),
  ('photos', 'photos', true, 52428800),
  ('avatars', 'avatars', true, null),
  ('discount-images', 'discount-images', true, null),
  ('receipts', 'receipts', false, null),
  ('songs', 'songs', true, null),
  ('voices', 'voices', false, null)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage (idempotentes)
DROP POLICY IF EXISTS "Leitura pública para preview e photos" ON storage.objects;
DROP POLICY IF EXISTS "Upload para anon nos buckets do fluxo" ON storage.objects;
DROP POLICY IF EXISTS "Upload para anon em payment-proofs, voice-samples, photos" ON storage.objects;
DROP POLICY IF EXISTS "Leitura total para service_role" ON storage.objects;
DROP POLICY IF EXISTS "Upload total para service_role" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Upload público de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Upload público de amostras de voz" ON storage.objects;

CREATE POLICY "Leitura pública para preview e photos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id IN ('preview', 'photos'));

CREATE POLICY "Upload para anon nos buckets do fluxo" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id IN ('photos'));

CREATE POLICY "Leitura total para service_role" ON storage.objects
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Upload total para service_role" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (true);

-- FILE: supabase_migration_utm.sql --
-- Migration: Adicionar colunas UTM à tabela song_requests
-- Permite rastrear de que campanha veio cada pedido

ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Índice para filtrar por campanha
CREATE INDEX IF NOT EXISTS idx_song_requests_utm_campaign ON song_requests(utm_campaign);

-- FILE: supabase_migration_scheduler.sql --
-- Migration: adicionar colunas deliver_at, delivered_at, deleted_at em song_requests
-- Estas colunas existem em producao mas nunca foram versionadas.

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS deliver_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Indice para a query do scheduler (status=approved + deliver_at <= now)
CREATE INDEX IF NOT EXISTS idx_song_requests_deliver_at
  ON public.song_requests (deliver_at)
  WHERE status = 'approved';


-- FILE: supabase_migration_phantom_columns.sql --
-- SeuBeat — Migration: Add phantom columns referenced in server code
-- Columns used by abandonedRecoveryScheduler.ts and followUpScheduler.ts
-- but never added to the schema or any prior migration.

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS abandoned_30min_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS abandoned_24h_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_7d_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_30d_sent_at   timestamptz;

CREATE TABLE IF NOT EXISTS public.email_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event           text NOT NULL,
  recipient_email text NOT NULL,
  message_id      text,
  reason          text,
  subject         text,
  raw_payload     jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_song_requests_abandoned
  ON public.song_requests (abandoned_30min_sent_at, abandoned_24h_sent_at)
  WHERE status IN ('lyrics_ready', 'payment_submitted', 'lyrics_generating');

CREATE INDEX IF NOT EXISTS idx_song_requests_followup
  ON public.song_requests (follow_up_7d_sent_at, follow_up_30d_sent_at)
  WHERE status = 'delivered';

CREATE INDEX IF NOT EXISTS idx_email_events_recipient
  ON public.email_events (recipient_email);

CREATE INDEX IF NOT EXISTS idx_email_events_event
  ON public.email_events (event);

-- FILE: supabase_migration_fix_auth_rls_initplan.sql --
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


-- FILE: supabase_migration_email_events_request_id_idx.sql --
-- Migration: indice para email_events(request_id)
-- Fachada a query do fluxo de emails (join por request_id).
-- Sinalizada pelo Supabase advisor de performance (missing FK index).

CREATE INDEX IF NOT EXISTS idx_email_events_request_id
  ON public.email_events (request_id);

-- FILE: supabase_migration_authlink.sql --
-- ═══════════════════════════════════════════════════════════════════════════════
-- SeuBeat — Migration #2: Link users table com auth.users
-- ═══════════════════════════════════════════════════════════════════════════════
-- Resolve o warning do Advisor: "users.id should reference auth.users"
-- ═══════════════════════════════════════════════════════════════════════════════

-- Adicionar coluna auth_user_id opcional (para quando houver Supabase Auth)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id);

-- Criar índice para joins futuros
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- Atualizar RLS para usar auth_user_id em vez de id (quando disponível)
DROP POLICY IF EXISTS "Utilizadores podem ver o seu próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Utilizadores podem editar o seu próprio perfil" ON public.users;

CREATE POLICY "Utilizadores podem ver o seu próprio perfil" ON public.users
  FOR SELECT USING (
    auth.uid() = auth_user_id OR auth.uid() = id
  );

CREATE POLICY "Utilizadores podem editar o seu próprio perfil" ON public.users
  FOR UPDATE USING (
    auth.uid() = auth_user_id OR auth.uid() = id
  )
  WITH CHECK (
    auth.uid() = auth_user_id OR auth.uid() = id
  );

-- Atualizar RLS de song_requests para aceitar ambos
DROP POLICY IF EXISTS "Clientes podem ver os seus pedidos" ON public.song_requests;

CREATE POLICY "Clientes podem ver os seus pedidos" ON public.song_requests
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR
    user_id = auth.uid()
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════


-- FILE: supabase_migration_analytics_events.sql --
-- Migration: analytics_events table
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   text NOT NULL,
  request_id   uuid REFERENCES public.song_requests(id) ON DELETE SET NULL,
  session_id   text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by event name + date (funnel queries)
CREATE INDEX IF NOT EXISTS analytics_events_event_name_created_at
  ON public.analytics_events (event_name, created_at DESC);

-- Index for per-request event lookup
CREATE INDEX IF NOT EXISTS analytics_events_request_id
  ON public.analytics_events (request_id)
  WHERE request_id IS NOT NULL;

-- RLS: only service role can read/write
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass (Supabase default). No anon access needed.


-- FILE: supabase_migration_advisor.sql --
-- ═══════════════════════════════════════════════════════════════════════════════
-- SeuBeat — Migration para resolver warnings do Supabase Advisor
-- ═══════════════════════════════════════════════════════════════════════════════
-- Copia e cola no SQL Editor do Supabase Dashboard e clica em "Run"
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Função trigger para updated_at (evita warning "missing updated_at")
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Adicionar coluna updated_at às tabelas que não a têm
ALTER TABLE public.users         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.songs         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.payments      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Dropar triggers se já existirem (para evitar erro de duplicação)
DROP TRIGGER IF EXISTS trg_users_updated_at         ON public.users;
DROP TRIGGER IF EXISTS trg_song_requests_updated_at ON public.song_requests;
DROP TRIGGER IF EXISTS trg_songs_updated_at         ON public.songs;
DROP TRIGGER IF EXISTS trg_payments_updated_at      ON public.payments;

-- Criar triggers
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_song_requests_updated_at
  BEFORE UPDATE ON public.song_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_songs_updated_at
  BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. Storage: payment-proofs não deve ser público (dados sensíveis de pagamento)
--    Apenas service_role (backend) pode ler.
-- ───────────────────────────────────────────────────────────────────────────────

-- Remover política de leitura pública para payment-proofs
DROP POLICY IF EXISTS "Permitir leitura pública para anon" ON storage.objects;

-- Criar política para leitura por bucket:
--   - payment-proofs → apenas service_role (pela ausência de policy para anon/authenticated)
--   - preview, photos → público (para partilha de links)
CREATE POLICY "Leitura pública para preview e photos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id IN ('preview', 'photos'));

-- Política de leitura para service_role em todos os buckets
CREATE POLICY "Leitura total para service_role" ON storage.objects
  FOR SELECT TO service_role
  USING (true);

-- Upload de anon permitido apenas nos buckets necessários
DROP POLICY IF EXISTS "Permitir upload público para anon" ON storage.objects;
CREATE POLICY "Upload para anon em payment-proofs, voice-samples, photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id IN ('payment-proofs', 'voice-samples', 'photos'));

-- Upload de service_role em qualquer bucket
CREATE POLICY "Upload total para service_role" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. Políticas para client anon (página pública de dedicatória)
--    O GET /api/song/:id usa anon key (em vez de service_role) para reduzir
--    o blast radius em caso de vulnerabilidade server-side.
-- ───────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon pode ler song_requests para dedicatória" ON public.song_requests;
DROP POLICY IF EXISTS "Anon pode ler nome do utilizador" ON public.users;

CREATE POLICY "Anon pode ler song_requests para dedicatória" ON public.song_requests
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon pode ler nome do utilizador" ON public.users
  FOR SELECT TO anon
  USING (true);

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. Índices em falta recomendados pelo Advisor (foreign key coverage)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_song_requests_created_at ON public.song_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at      ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_created_at         ON public.songs(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. Nota sobre users.id e auth.users
--    O Advisor pode avisar que users.id não referencia auth.users(id).
--    Isto é intencional: o SeuBeat permite encomendas sem autenticação,
--    usando service_role no backend. Se no futuro houver login com Supabase Auth,
--    executar o bloco comentado abaixo.
-- ───────────────────────────────────────────────────────────────────────────────
-- Opcional: descomentar quando migrar para Supabase Auth
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);
-- CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════


-- FILE: supabase_migration_advisor_fixes.sql --
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


-- FILE: supabase_migration_advisor_fixes2.sql --
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


-- FILE: supabase_migration_advisor_fixes3.sql --
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


-- FILE: supabase_migration_abandoned_whatsapp.sql --
-- Migration: painel de Abandonados + envio WhatsApp automático (Baileys)
-- Aditivo — não altera tabelas existentes.

-- 1. Rastrear contacto manual pelo admin (painel de Abandonados)
ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS manual_contacted_at timestamptz;

-- Índice para a query do painel (status abandonado + não pago)
CREATE INDEX IF NOT EXISTS idx_song_requests_abandoned_status
  ON public.song_requests (created_at DESC)
  WHERE status IN ('lyrics_ready', 'lyrics_generating');

-- 2. Sessão do Baileys (credenciais WhatsApp) — RLS fechada, só service role
CREATE TABLE IF NOT EXISTS public.whatsapp_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_session ENABLE ROW LEVEL SECURITY;

-- 3. Registo de envios WhatsApp da campanha de Abandonados
CREATE TABLE IF NOT EXISTS public.whatsapp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.song_requests (id) ON DELETE CASCADE,
  phone text NOT NULL,
  status text NOT NULL, -- 'sent' | 'skipped' | 'failed'
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_request
  ON public.whatsapp_send_log (request_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_created
  ON public.whatsapp_send_log (created_at);

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;




-- COLUNAS ADICIONAIS DO BANCO ORIGINAL --

-- ADICIONAR COLUNAS EM FALTA PARA RESTAURO TOTAL DOS DADOS --

-- users --
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "auth_user_id" TEXT;

-- song_requests --
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "special_traits" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "memory" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "heart_message" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "voice_sample_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "elevenlabs_voice_id" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "cloned_speech_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "final_mixed_audio_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "error_details" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_30min_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_24h_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_48h_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_72h_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_7d_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "follow_up_7d_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "follow_up_30d_sent_at" TIMESTAMPTZ;

-- songs --
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "full_song_url" TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "mureka_task_id" TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "mureka_status" TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "regeneration_count" INTEGER DEFAULT 0;

-- payments --
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "amount" NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "payment_reference" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "proof_filename" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "proof_url" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "proof_path" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "user_email" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "meta_purchase_sent_at" TIMESTAMPTZ;

-- email_events --
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "event" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "message_id" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "raw_payload" JSONB;

-- whatsapp_send_log --
ALTER TABLE public.whatsapp_send_log ADD COLUMN IF NOT EXISTS "message_id" TEXT;
ALTER TABLE public.whatsapp_send_log ADD COLUMN IF NOT EXISTS "template_name" TEXT;

-- admin_audit_log --
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS "previous_data" JSONB;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS "new_data" JSONB;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS "notes" TEXT;
