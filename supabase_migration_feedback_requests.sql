-- Migration: Add feedback_requests table for video feedback requests
-- Date: 2026-08-24

-- Create feedback_requests table
CREATE TABLE IF NOT EXISTS feedback_requests (
  request_id UUID PRIMARY KEY REFERENCES song_requests(id) ON DELETE CASCADE,
  recipient_name TEXT,
  email TEXT,
  phone TEXT,
  song_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient scheduled queries
CREATE INDEX IF NOT EXISTS idx_feedback_requests_scheduled 
ON feedback_requests (scheduled_at) 
WHERE status = 'pending';

-- Index for request_id lookups
CREATE INDEX IF NOT EXISTS idx_feedback_requests_request_id 
ON feedback_requests (request_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_feedback_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_feedback_requests_updated_at ON feedback_requests;
CREATE TRIGGER trigger_update_feedback_requests_updated_at
  BEFORE UPDATE ON feedback_requests
  FOR EACH ROW EXECUTE FUNCTION update_feedback_requests_updated_at();

-- Add comment
COMMENT ON TABLE feedback_requests IS 'Agendamento de pedidos de feedback em vídeo pós-entrega via WhatsApp';
COMMENT ON COLUMN feedback_requests.scheduled_at IS 'Quando o pedido de feedback deve ser enviado (24h após entrega)';
COMMENT ON COLUMN feedback_requests.status IS 'pending | sent | failed';