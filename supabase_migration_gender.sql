-- Migration: adicionar coluna recipient_gender em song_requests
-- Usada para concordância gramatical na letra gerada pela IA (português)

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS recipient_gender text;
