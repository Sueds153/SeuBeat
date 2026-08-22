-- Migration: Fix RLS policies — remove anon SELECT that exposes PII
-- Date: 2026-08-22
-- Context: The anon key (exposed in frontend JS bundle via VITE_SUPABASE_ANON_KEY)
--          has blanket SELECT access to song_requests and users tables via USING(true).
--          This allows anyone to query email, phone, photo_url from all rows.
--
-- Fix: Drop permissive anon SELECT policies. The server now uses getAdminSupabase()
-- (service_role, bypasses RLS) for all queries that need PII. The frontend never
-- queries Supabase directly — all data goes through Express API endpoints.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

-- 1. Drop permissive anon SELECT on song_requests (exposes email, phone, photo_url)
DROP POLICY IF EXISTS "Anon pode ler song_requests para dedicatória" ON public.song_requests;

-- 2. Drop permissive anon SELECT on users (exposes email, phone, name)
DROP POLICY IF EXISTS "Anon pode ler nome do utilizador" ON public.users;

-- 3. Verify remaining policies (should still have INSERT for form submissions)
-- SELECT: no anon SELECT on song_requests or users
-- INSERT: "Permitir inserção de pedidos por anon" on song_requests (form submissions)
-- INSERT: payments INSERT for payment submissions
-- songs: "Músicas e previews são públicos" stays (no PII in songs table)

-- 4. Audit: list remaining anon policies after fix
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon' = ANY(roles)
  AND tablename IN ('song_requests', 'users', 'songs', 'payments')
ORDER BY tablename, policyname;
