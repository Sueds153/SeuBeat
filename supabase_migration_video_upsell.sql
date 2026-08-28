-- Migration: video_upsell fields for post-payment upsell
-- Adds tracking columns for the videoclipe upsell feature

ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS video_upsell boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_upsell_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_upsell_sent_at timestamptz;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS video_upsell boolean DEFAULT false;
