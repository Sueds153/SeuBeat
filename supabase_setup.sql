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