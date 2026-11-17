-- ComAmor integration: isolated, additive job registry and callback outbox.
-- This migration is intentionally not applied to any hosted database here.

CREATE TABLE IF NOT EXISTS public.comamor_jobs (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  generation_attempt integer NOT NULL CHECK (generation_attempt > 0),
  idempotency_key text NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  occasion text NOT NULL,
  music_style text NOT NULL,
  content_mode text NOT NULL CHECK (content_mode IN ('instruction', 'lyrics')),
  request_id uuid NOT NULL UNIQUE REFERENCES public.song_requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'completed', 'failed', 'expired')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, generation_attempt)
);

CREATE INDEX IF NOT EXISTS idx_comamor_jobs_status_updated
  ON public.comamor_jobs (status, updated_at);

CREATE TABLE IF NOT EXISTS public.comamor_callback_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.comamor_jobs(id) ON DELETE CASCADE,
  event_status text NOT NULL CHECK (event_status IN ('generating', 'completed', 'failed')),
  body_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, event_status)
);

CREATE INDEX IF NOT EXISTS idx_comamor_callback_outbox_pending
  ON public.comamor_callback_outbox (next_attempt_at, created_at)
  WHERE status = 'pending';

ALTER TABLE public.comamor_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comamor_callback_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comamor_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.comamor_callback_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.comamor_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.comamor_callback_outbox TO service_role;

-- Atomically reserve one authorization attempt and create its internal request.
-- SECURITY INVOKER keeps normal table grants/RLS in force; only service_role can call it.
CREATE OR REPLACE FUNCTION public.create_comamor_job(
  p_job_id uuid,
  p_order_id uuid,
  p_campaign_id uuid,
  p_generation_attempt integer,
  p_idempotency_key text,
  p_payload_hash text,
  p_occasion text,
  p_music_style text,
  p_content_mode text,
  p_instruction text,
  p_lyrics text
)
RETURNS SETOF public.comamor_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_job public.comamor_jobs%ROWTYPE;
  v_existing_job_id uuid;
  v_max_attempt integer;
BEGIN
  IF p_idempotency_key <> p_order_id::text || ':' || p_generation_attempt::text
    OR p_generation_attempt < 1
    OR p_content_mode NOT IN ('instruction', 'lyrics')
    OR (p_content_mode = 'instruction' AND COALESCE(length(trim(p_instruction)), 0) < 10)
    OR (p_content_mode = 'lyrics' AND COALESCE(length(trim(p_lyrics)), 0) < 10) THEN
    RAISE EXCEPTION 'invalid_job_input' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  SELECT id INTO v_existing_job_id
  FROM public.comamor_jobs
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_existing_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.comamor_jobs WHERE id = v_existing_job_id;
    IF v_job.order_id <> p_order_id
      OR v_job.campaign_id <> p_campaign_id
      OR v_job.generation_attempt <> p_generation_attempt
      OR v_job.payload_hash <> p_payload_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN NEXT v_job;
    RETURN;
  END IF;

  SELECT COALESCE(max(generation_attempt), 0) INTO v_max_attempt
  FROM public.comamor_jobs
  WHERE order_id = p_order_id;
  IF p_generation_attempt <= v_max_attempt THEN
    RAISE EXCEPTION 'stale_attempt' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.song_requests (
    id, user_id, recipient_name, relationship, occasion, music_style,
    voice_type, special_traits, heart_message, desired_emotion, email,
    status, language
  ) VALUES (
    p_job_id, NULL, 'Pessoa homenageada', 'Homenagem', p_occasion, p_music_style,
    'masculina', '', COALESCE(p_instruction, p_lyrics, ''),
    'Amor', '', 'music_processing', 'português'
  );

  UPDATE public.comamor_jobs
  SET status = 'expired', updated_at = now()
  WHERE order_id = p_order_id AND generation_attempt < p_generation_attempt;

  INSERT INTO public.comamor_jobs (
    id, order_id, campaign_id, generation_attempt, idempotency_key,
    payload_hash, occasion, music_style, content_mode, request_id, status
  ) VALUES (
    p_job_id, p_order_id, p_campaign_id, p_generation_attempt, p_idempotency_key,
    p_payload_hash, p_occasion, p_music_style, p_content_mode, p_job_id, 'queued'
  );

  SELECT * INTO v_job FROM public.comamor_jobs WHERE id = p_job_id;
  RETURN NEXT v_job;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_comamor_job(uuid, uuid, uuid, integer, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_comamor_job(uuid, uuid, uuid, integer, text, text, text, text, text, text, text)
  TO service_role;
