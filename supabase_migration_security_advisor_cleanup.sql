-- ============================================================================
-- Migration: Security Advisor cleanup (10/Ago/2026)
--
-- 1) REVOKE DML de anon/authenticated + deny policies nas 3 tabelas SeuBeat
--    com RLS ativo mas sem policies (admin_audit_log, whatsapp_send_log,
--    whatsapp_session). service_role continua a ter acesso (bypass RLS).
-- 2) Apagar funções e tabelas do projeto AngoLife (multicaixa_*,
--    generate_referral_code, profiles, multicaixas, ...) que poluem a DB
--    do SeuBeat e disparam os warnings do Supabase Advisor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) SeuBeat admin/ops tables: keep RLS, deny anon/authenticated
-- ---------------------------------------------------------------------------
revoke all on public.admin_audit_log   from anon, authenticated;
revoke all on public.whatsapp_send_log from anon, authenticated;
revoke all on public.whatsapp_session  from anon, authenticated;

create policy "deny_all" on public.admin_audit_log
  for all to anon, authenticated using (false) with check (false);
create policy "deny_all" on public.whatsapp_send_log
  for all to anon, authenticated using (false) with check (false);
create policy "deny_all" on public.whatsapp_session
  for all to anon, authenticated using (false) with check (false);

-- ---------------------------------------------------------------------------
-- 2) AngoLife objects — tabelas extra (não usadas pelo SeuBeat)
-- ---------------------------------------------------------------------------
-- Ordem: tabelas-folha primeiro, profiles por último (policies de
-- product_deals/jobs/news_articles/orders e FKs dependem de profiles).
drop table if exists public.news_articles;
drop table if exists public.product_deals;
drop table if exists public.orders;
drop table if exists public.exchange_rates;
drop table if exists public.push_subscriptions;
drop table if exists public.jobs;
drop table if exists public.reportes_multicaixa;
drop table if exists public.subscriptions_pending;
drop table if exists public.multicaixas;
drop table if exists public.profiles;

-- Funções depois das tabelas (a trigger tr_generate_referral_code dependia de
-- generate_referral_code e foi removida com o drop de profiles).
drop function if exists public.generate_referral_code;
drop function if exists public.multicaixa_adicionar;
drop function if exists public.multicaixa_aprovar;
drop function if exists public.multicaixa_distancia;
drop function if exists public.multicaixa_estados;
drop function if exists public.multicaixa_mais_proximo_com_dinheiro;
drop function if exists public.multicaixa_nivel;
drop function if exists public.multicaixa_ranking;
drop function if exists public.multicaixa_recalcular_precisao;
drop function if exists public.multicaixa_rejeitar;
drop function if exists public.multicaixa_reportar;