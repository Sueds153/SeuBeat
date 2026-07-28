-- SeuBeat — Migration: Add phantom columns referenced in server code
-- Columns used by abandonedRecoveryScheduler.ts and followUpScheduler.ts
-- but never added to the schema or any prior migration.

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS abandoned_30min_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS abandoned_24h_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_7d_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_30d_sent_at   timestamptz;

CREATE TABLE IF NOT EXISTS public.email_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event           text NOT NULL,
  recipient_email text NOT NULL,
  message_id      text,
  reason          text,
  subject         text,
  raw_payload     jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_song_requests_abandoned
  ON public.song_requests (abandoned_30min_sent_at, abandoned_24h_sent_at)
  WHERE status IN ('lyrics_ready', 'payment_submitted', 'lyrics_generating');

CREATE INDEX IF NOT EXISTS idx_song_requests_followup
  ON public.song_requests (follow_up_7d_sent_at, follow_up_30d_sent_at)
  WHERE status = 'delivered';

CREATE INDEX IF NOT EXISTS idx_email_events_recipient
  ON public.email_events (recipient_email);

CREATE INDEX IF NOT EXISTS idx_email_events_event
  ON public.email_events (event);