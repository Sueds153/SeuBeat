-- Migration: Add voice_free_sample_url column to song_requests table
-- Date: 2026-08-28

ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS voice_free_sample_url TEXT;
