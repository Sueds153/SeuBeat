-- 1c CRO: lembrete 24h após rejeição de comprovativo
-- Dedupe persistente do sendRejectedReminderEmail no abandonedRecoveryScheduler.
-- Aplicar ANTES do deploy (sem a coluna o código degrada graciosamente — o
-- dedupe fica só em memória — mas o update da flag é registado como warning).
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS rejected_reminder_sent_at timestamptz;
