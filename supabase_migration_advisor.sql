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
-- 3. Índices em falta recomendados pelo Advisor (foreign key coverage)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_song_requests_created_at ON public.song_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at      ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_created_at         ON public.songs(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. Nota sobre users.id e auth.users
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
