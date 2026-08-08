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
