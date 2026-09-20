-- Migration: Proof dedup columns for payment fraud prevention
-- Applied: 20/Set/2026

-- SHA-256 hash of the proof image (computed server-side on submission)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS proof_hash text;
-- Indexed for fast cross-request duplicate detection
CREATE INDEX IF NOT EXISTS idx_payments_proof_hash ON public.payments (proof_hash) WHERE proof_hash IS NOT NULL;

-- Transaction ID extracted by AI from the proof (e.g. Multicaixa transaction number)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_id text;
-- Indexed for fast cross-payment transaction dedup
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments (transaction_id) WHERE transaction_id IS NOT NULL;

-- Reload PostgREST schema cache so the new columns are immediately available
NOTIFY pgrst, 'reload schema';
