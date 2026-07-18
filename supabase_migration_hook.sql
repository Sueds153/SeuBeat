-- Migration: adicionar coluna hook_phrase em song_requests
-- Usada para definir o gancho principal do refrão na letra gerada pela IA

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS hook_phrase text;
