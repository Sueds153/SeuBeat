import fs from 'fs';

const sql = `
-- ADICIONAR COLUNAS EM FALTA PARA RESTAURO TOTAL DOS DADOS --

-- users --
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "auth_user_id" TEXT;

-- song_requests --
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "special_traits" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "memory" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "heart_message" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "voice_sample_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "elevenlabs_voice_id" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "cloned_speech_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "final_mixed_audio_url" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "error_details" TEXT;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_30min_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_24h_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_48h_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_72h_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "abandoned_7d_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "follow_up_7d_sent_at" TIMESTAMPTZ;
ALTER TABLE public.song_requests ADD COLUMN IF NOT EXISTS "follow_up_30d_sent_at" TIMESTAMPTZ;

-- songs --
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "full_song_url" TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "mureka_task_id" TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "mureka_status" TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS "regeneration_count" INTEGER DEFAULT 0;

-- payments --
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "amount" NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "payment_reference" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "proof_filename" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "proof_url" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "proof_path" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "user_email" TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "meta_purchase_sent_at" TIMESTAMPTZ;

-- email_events --
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "event" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "message_id" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE public.email_events ADD COLUMN IF NOT EXISTS "raw_payload" JSONB;

-- whatsapp_send_log --
ALTER TABLE public.whatsapp_send_log ADD COLUMN IF NOT EXISTS "message_id" TEXT;
ALTER TABLE public.whatsapp_send_log ADD COLUMN IF NOT EXISTS "template_name" TEXT;

-- admin_audit_log --
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS "previous_data" JSONB;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS "new_data" JSONB;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS "notes" TEXT;
`;

fs.writeFileSync('add_all_missing_columns.sql', sql);
console.log('Ficheiro add_all_missing_columns.sql criado!');
