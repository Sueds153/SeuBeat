-- Migration: Adicionar coluna regeneration_count à tabela songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS regeneration_count integer DEFAULT 0;
