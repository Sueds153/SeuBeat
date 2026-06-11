-- SQL Setup Script para o SeuBeat
-- Copia e cola este código no "SQL Editor" do teu painel Supabase e clica em "Run"

-- 1. Criação da tabela de utilizadores (clientes)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE,
  phone text,
  name text,
  created_at timestamptz DEFAULT now()
);

-- Garantir que as colunas críticas existem se a tabela já tiver sido criada antes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;

-- 2. Criação da tabela de pedidos de música
CREATE TABLE IF NOT EXISTS public.song_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_name text,
  recipient_relation text,
  occasion text,
  music_style text,
  voice_type text,
  status text DEFAULT 'draft',
  photo_url text,
  voice_sample_url text,
  elevenlabs_voice_id text,
  cloned_speech_url text,
  final_mixed_audio_url text,
  created_at timestamptz DEFAULT now()
);

-- Garantir que as colunas adicionais existem se a tabela já tiver sido criada antes
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS voice_sample_url text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS cloned_speech_url text;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS final_mixed_audio_url text;
ALTER TABLE public.song_requests ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Criação da tabela de músicas geradas
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES public.song_requests(id) ON DELETE CASCADE,
  title text,
  lyrics text[],
  lyrics_snippet text,
  letter_text text,
  audio_url text,
  mureka_task_id text,
  mureka_status text DEFAULT 'not_started',
  created_at timestamptz DEFAULT now()
);

-- Garantir que as colunas críticas existem se a tabela já tiver sido criada antes
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics text[];
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics_snippet text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS letter_text text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS mureka_task_id text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS mureka_status text;
ALTER TABLE public.songs ALTER COLUMN mureka_status SET DEFAULT 'not_started';

-- 4. Tabela de pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  song_request_id uuid REFERENCES public.song_requests(id) ON DELETE CASCADE,
  user_email text,
  plan text,
  amount text,
  proof_url text,
  proof_filename text,
  status text DEFAULT 'pending_verification',
  notes text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Garantir que todas as colunas críticas existem (seguro para tabelas já criadas)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS plan text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount text;
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

-- Criar as políticas
CREATE POLICY "Enable insert for everyone" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for everyone" ON public.song_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for everyone" ON public.songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for everyone" ON public.payments FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read for everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable read for everyone" ON public.song_requests FOR SELECT USING (true);
CREATE POLICY "Enable read for everyone" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Enable read for everyone" ON public.payments FOR SELECT USING (true);

CREATE POLICY "Enable update for everyone" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Enable update for everyone" ON public.songs FOR UPDATE USING (true);
CREATE POLICY "Enable update for everyone" ON public.song_requests FOR UPDATE USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIGURAÇÃO DE STORAGE (BUCKETS E POLÍTICAS)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Criar os buckets diretamente via SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('payment-proofs', 'payment-proofs', true, 52428800),
  ('full-audio', 'full-audio', false, 52428800),
  ('preview', 'preview', true, 52428800),
  ('voice-samples', 'voice-samples', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar RLS no storage
-- 3. Criar políticas para permitir uploads e leituras públicas/anon seguras
DROP POLICY IF EXISTS "Permitir upload público para anon" ON storage.objects;
CREATE POLICY "Permitir upload público para anon" 
ON storage.objects FOR INSERT TO anon 
WITH CHECK (bucket_id IN ('payment-proofs', 'voice-samples'));

DROP POLICY IF EXISTS "Permitir leitura pública para anon" ON storage.objects;
CREATE POLICY "Permitir leitura pública para anon" 
ON storage.objects FOR SELECT TO anon 
USING (bucket_id IN ('payment-proofs', 'preview'));


