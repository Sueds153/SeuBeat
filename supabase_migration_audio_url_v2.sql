-- Migration: Adicionar colunas para a segunda versão de áudio (Suno retorna 2 músicas por pedido)
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_url_v2 text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS full_song_url_v2 text;
