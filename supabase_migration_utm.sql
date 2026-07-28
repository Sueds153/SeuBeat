-- Migration: Adicionar colunas UTM à tabela song_requests
-- Permite rastrear de que campanha veio cada pedido

ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Índice para filtrar por campanha
CREATE INDEX IF NOT EXISTS idx_song_requests_utm_campaign ON song_requests(utm_campaign);