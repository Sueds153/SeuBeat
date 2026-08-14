-- Migration: colunas de dedupe WhatsApp no abandoned recovery scheduler
-- Separam o dedupe do WhatsApp (whatsapp_*_sent_at) do dedupe do email
-- (abandoned_*_sent_at), que antes partilhavam as mesmas flags e entravam
-- em conflito. Aditiva e idempotente.

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS whatsapp_30min_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_48h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_72h_sent_at TIMESTAMPTZ;
