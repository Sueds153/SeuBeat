-- Migration: Add amount_kz column to payments table
-- Date: 2026-11-10
-- Purpose: Store amount in KZ (Angolan Kwanza) alongside the numeric amount

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS amount_kz numeric;

-- Add comment
COMMENT ON COLUMN public.payments.amount_kz IS 'Payment amount in Angolan Kwanza (KZ)';