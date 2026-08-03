-- Migration: persistir campos opcionais do wizard em song_requests
-- Estes campos só eram usados pela IA na geração; agora ficam guardados para
-- regenerações fiéis (public + admin) sem perder contexto.

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS reference_artist text,
  ADD COLUMN IF NOT EXISTS why_created_today text,
  ADD COLUMN IF NOT EXISTS only_she_does text,
  ADD COLUMN IF NOT EXISTS where_it_happened text;
