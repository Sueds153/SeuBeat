-- Migration: Add expires_at column to payments table for 15-minute payment expiry
-- Date: 2026-08-24

-- Add expires_at column to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_payments_expires_at 
ON payments (expires_at) 
WHERE expires_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN payments.expires_at IS 'Expiration timestamp for pending payments (15 minutes from creation)';