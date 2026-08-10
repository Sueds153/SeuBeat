-- Migration: indice para email_events(request_id)
-- Fachada a query do fluxo de emails (join por request_id).
-- Sinalizada pelo Supabase advisor de performance (missing FK index).

CREATE INDEX IF NOT EXISTS idx_email_events_request_id
  ON public.email_events (request_id);