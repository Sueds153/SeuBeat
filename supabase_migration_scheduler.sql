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
