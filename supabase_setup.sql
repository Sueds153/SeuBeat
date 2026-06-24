-- SQL Setup Script para o SeuBeat
-- Copia e cola este código no "SQL Editor" do teu painel Supabase e clica em "Run"

-- 1. Criação da tabela de utilizadores (clientes)
-- NOTA: id usa gen_random_uuid() em vez de references auth.users(id)
--       porque o SeuBeat permite encomendas sem autenticação.
--       O backend usa service_role para bypass de RLS.
CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE,
  phone text,
  name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garantir que as colunas críticas existem se a tabela já tiver sido criada antes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;

-- 2. Criação da tabela de pedidos de música
CREATE TABLE IF NOT EXISTS public.song_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_name text,
  relationship text,
  occasion text,
  music_style text,
  voice_type text,
  special_traits text,
  memory text,
  heart_message text,
  desired_emotion text,
  email text,
  phone text,
  status text DEFAULT 'draft',
  photo_url text,
  voice_sample_url text,
  elevenlabs_voice_id text,
  final_mixed_audio_url text,
  error_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garantir que as colunas adicionais existem se a tabela já tiver sido criada antes
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS relationship text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS special_traits text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS memory text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS heart_message text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS desired_emotion text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS voice_sample_url text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS final_mixed_audio_url text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS error_details jsonb;
ALTER TABLE public.song_requests ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Criação da tabela de músicas geradas
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES public.song_requests(id) ON DELETE CASCADE,
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garantir que as colunas críticas existem se a tabela já tiver sido criada antes
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics jsonb;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics_snippet text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS letter_text text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS full_song_url text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS duration integer;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS mureka_task_id text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS mureka_status text;
ALTER TABLE public.songs ALTER COLUMN mureka_status SET DEFAULT 'not_started';

-- 4. Tabela de pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES public.song_requests(id) ON DELETE CASCADE,
  user_email text,
  plan text,
  amount numeric,
  payment_reference text,
  proof_url text,
  proof_filename text,
  status text DEFAULT 'pending_verification',
  notes text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garantir que todas as colunas críticas existem (seguro para tabelas já criadas)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.song_requests(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS plan text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS proof_url text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS proof_filename text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Configuração de Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para tabelas
-- Remover se já existirem para evitar erro de duplicidade
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.users;
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.song_requests;
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.songs;
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.payments;

DROP POLICY IF EXISTS "Enable read for everyone" ON public.users;
DROP POLICY IF EXISTS "Enable read for everyone" ON public.song_requests;
DROP POLICY IF EXISTS "Enable read for everyone" ON public.songs;
DROP POLICY IF EXISTS "Enable read for everyone" ON public.payments;

DROP POLICY IF EXISTS "Enable update for everyone" ON public.payments;
DROP POLICY IF EXISTS "Enable update for everyone" ON public.songs;
DROP POLICY IF EXISTS "Enable update for everyone" ON public.song_requests;
DROP POLICY IF EXISTS "Enable update for everyone" ON public.users;
DROP POLICY IF EXISTS "Utilizadores podem ver o próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Utilizadores podem ver o seu próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Utilizadores podem atualizar o próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Utilizadores podem editar o seu próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Utilizadores vêem apenas os seus pedidos" ON public.song_requests;
DROP POLICY IF EXISTS "Clientes podem ver os seus pedidos" ON public.song_requests;
DROP POLICY IF EXISTS "Permitir criação pública de song_requests" ON public.song_requests;
DROP POLICY IF EXISTS "Permitir inserção de pedidos por anon" ON public.song_requests;
DROP POLICY IF EXISTS "Músicas são públicas para visualização" ON public.songs;
DROP POLICY IF EXISTS "Músicas e previews são públicos" ON public.songs;
DROP POLICY IF EXISTS "Utilizadores vêem apenas os seus pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Clientes podem ver os seus pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Permitir criação pública de pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Permitir submissão de pagamento" ON public.payments;

-- Políticas de acesso mais seguras
-- 1. USERS: Apenas o próprio utilizador ou o service_role pode ver/editar
CREATE POLICY "Utilizadores podem ver o seu próprio perfil" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Utilizadores podem editar o seu próprio perfil" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 2. SONG_REQUESTS: Apenas o dono pode ver. Inserção permitida para anon (início do fluxo).
CREATE POLICY "Clientes podem ver os seus pedidos" ON public.song_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Permitir inserção de pedidos por anon" ON public.song_requests FOR INSERT WITH CHECK (true);

-- 3. SONGS: Letras e previews são públicos. Áudio completo apenas se pago.
CREATE POLICY "Músicas e previews são públicos" ON public.songs FOR SELECT USING (true);

-- 4. PAYMENTS: Apenas o dono pode ver os seus pagamentos. Inserção permitida.
CREATE POLICY "Clientes podem ver os seus pagamentos" ON public.payments FOR SELECT USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Permitir submissão de pagamento" ON public.payments FOR INSERT WITH CHECK (true);

-- Nota: O painel Admin utiliza o "service_role" ou bypassa RLS via Server-Side, pelo que estas restrições não o afetam.


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER PARA UPDATED_AT
-- ─────────────────────────────────────────────────────────────────────────────

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
-- CONFIGURAÇÃO DE STORAGE (BUCKETS E POLÍTICAS)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Criar os buckets diretamente via SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('payment-proofs', 'payment-proofs', true, 52428800),
  ('full-audio', 'full-audio', false, 52428800),
  ('preview', 'preview', true, 52428800),
  ('voice-samples', 'voice-samples', false, 52428800),
  ('photos', 'photos', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar políticas de storage:
--    - payment-proofs → apenas service_role (dados sensíveis)
--    - preview, photos → público (partilha de links)
--    - voice-samples → apenas service_role
--    - full-audio → apenas service_role

DROP POLICY IF EXISTS "Permitir upload público para anon"               ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura pública para anon"              ON storage.objects;
DROP POLICY IF EXISTS "Leitura pública para preview e photos"           ON storage.objects;
DROP POLICY IF EXISTS "Leitura total para service_role"                 ON storage.objects;
DROP POLICY IF EXISTS "Upload para anon em payment-proofs, voice-samples, photos" ON storage.objects;
DROP POLICY IF EXISTS "Upload total para service_role"                  ON storage.objects;

-- Upload permitido para anon nos buckets necessários ao fluxo
CREATE POLICY "Upload para anon nos buckets do fluxo" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id IN ('payment-proofs', 'voice-samples', 'photos'));

-- Leitura pública apenas para preview e photos (partilha de links)
CREATE POLICY "Leitura pública para preview e photos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id IN ('preview', 'photos'));

-- Service_role tem acesso total a todos os buckets
CREATE POLICY "Acesso total para service_role" ON storage.objects
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Índices para optimização de queries comuns
CREATE INDEX IF NOT EXISTS idx_song_requests_user_id   ON public.song_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_request_id         ON public.songs(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_request_id      ON public.payments(request_id);
CREATE INDEX IF NOT EXISTS idx_song_requests_email      ON public.song_requests(email);
CREATE INDEX IF NOT EXISTS idx_payments_status          ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_song_requests_status     ON public.song_requests(status);
CREATE INDEX IF NOT EXISTS idx_song_requests_created_at ON public.song_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at      ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_created_at         ON public.songs(created_at DESC);
