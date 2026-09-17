-- Migration: Add AI verification result columns to payments table
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS verification_result jsonb,
  ADD COLUMN IF NOT EXISTS ai_verified boolean DEFAULT false;

-- Index for querying auto-verified payments
CREATE INDEX IF NOT EXISTS idx_payments_ai_verified ON public.payments (ai_verified) WHERE ai_verified = true;

COMMENT ON COLUMN public.payments.verification_result IS 'AI proof verification result: { confidence, decision, extracted, checks, provider }';
COMMENT ON COLUMN public.payments.ai_verified IS 'Whether the payment was auto-approved by AI verification';
