-- Migration: analytics_events table
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   text NOT NULL,
  request_id   uuid REFERENCES public.song_requests(id) ON DELETE SET NULL,
  session_id   text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by event name + date (funnel queries)
CREATE INDEX IF NOT EXISTS analytics_events_event_name_created_at
  ON public.analytics_events (event_name, created_at DESC);

-- Index for per-request event lookup
CREATE INDEX IF NOT EXISTS analytics_events_request_id
  ON public.analytics_events (request_id)
  WHERE request_id IS NOT NULL;

-- RLS: only service role can read/write
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass (Supabase default). No anon access needed.
