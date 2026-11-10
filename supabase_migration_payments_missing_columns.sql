-- Migration: Add missing columns to payments table
-- Date: 2026-11-10
-- Purpose: Add plan_type, amount_kz, payment_method, proof_hash, expires_at, video_upsell, ai_verified, verification_result, transaction_id

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS plan_type text,
ADD COLUMN IF NOT EXISTS amount_kz numeric,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'reference',
ADD COLUMN IF NOT EXISTS proof_hash text,
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS video_upsell boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_result jsonb,
ADD COLUMN IF NOT EXISTS transaction_id text;

-- Comments
COMMENT ON COLUMN public.payments.plan_type IS 'Type of plan (standard, premium, video_upsell)';
COMMENT ON COLUMN public.payments.amount_kz IS 'Payment amount in Angolan Kwanza (KZ)';
COMMENT ON COLUMN public.payments.payment_method IS 'Payment method: reference or express';
COMMENT ON COLUMN public.payments.proof_hash IS 'Hash of the payment proof file for deduplication';
COMMENT ON COLUMN public.payments.expires_at IS 'Expiration timestamp for pending payments (15 minutes from creation)';
COMMENT ON COLUMN public.payments.video_upsell IS 'Whether this payment is for video upsell';
COMMENT ON COLUMN public.payments.ai_verified IS 'Whether payment proof was auto-verified by AI';
COMMENT ON COLUMN public.payments.verification_result IS 'Full AI verification result as JSON';
COMMENT ON COLUMN public.payments.transaction_id IS 'Extracted transaction ID from proof';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON public.payments (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_plan_type ON public.payments (plan_type);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON public.payments (payment_method);