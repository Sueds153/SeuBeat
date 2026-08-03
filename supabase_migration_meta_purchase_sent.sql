-- Migration: guard idempotente para o evento Meta Purchase (CAPI).
-- Garante que o evento de compra é enviado UMA única vez por pagamento aprovado,
-- mesmo que o approve seja re-executado (retry/redeploy).
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS meta_purchase_sent_at TIMESTAMPTZ;
