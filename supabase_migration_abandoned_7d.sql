-- Migration: lembrete de abandono de 7 dias (5º email de recuperação)
-- Reativa leads >72h que nunca receberam o 4º lembrete ou já o receberam há dias.
-- Aditiva e idempotente — só adiciona a coluna se não existir.

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS abandoned_7d_sent_at TIMESTAMPTZ;