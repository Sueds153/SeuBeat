-- Migration: WhatsApp Business Cloud API (Meta) — substitui o envio via Baileys/QR
-- Aditivo — não altera tabelas existentes além de novas colunas no log.

-- 1. Colunas extra no whatsapp_send_log para mapear os webhooks de delivery da Meta
--    (message_id devolvido pela API; template_name para auditoria)
ALTER TABLE public.whatsapp_send_log
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS template_name text;

-- 2. Sessão do Baileys deixou de ser usada (envio passa a ser via Cloud API,
--    sem credenciais persistidas). Remove a tabela órfã.
DROP TABLE IF EXISTS public.whatsapp_session;
