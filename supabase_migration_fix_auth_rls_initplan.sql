-- Migration: Fix lint 0003_auth_rls_initplan (WARN Performance)
-- Table `public.email_events` reavalia auth.role() por cada linha na policy `admin_select`.
-- Fix recomendado pelo Supabase: envolver auth.<function>() em (select ...) para avaliar uma vez por query (initplan).
-- Aplicar no Dashboard > SQL Editor (o MCP não tem permissão de DDL).

DROP POLICY IF EXISTS admin_select ON public.email_events;

CREATE POLICY admin_select ON public.email_events
  FOR SELECT
  USING (
    (SELECT auth.role()) = 'service_role'::text
    OR (SELECT auth.role()) = 'authenticated'::text
  );
