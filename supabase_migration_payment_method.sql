-- Migration: método de pagamento no wizard (Referência vs Multicaixa Express)
-- Aditiva e idempotente. Valores: 'reference' | 'express' (default 'reference').
-- Ajuda o admin a saber como verificar o comprovativo (a referência dá para
-- confirmar no Multicaixa; o express é uma transferência para um nº de telemóvel).

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT;