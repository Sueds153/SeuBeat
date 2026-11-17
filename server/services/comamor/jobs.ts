import { createHash, randomUUID } from 'node:crypto';
import { generateLyrics } from '../ai';
import type { WizardFormData } from '../types';
import { getAdminSupabase } from '../supabase';
import { runBackgroundSunoWorkflow } from '../workflow';
import { assertAllowedComAmorAudioUrl, ComAmorIntegrationError, sendComAmorCallback, type ComAmorAuthorization } from './client';

const MAX_CALLBACK_ATTEMPTS = 12;
const MAX_CALLBACK_DELAY_MS = 6 * 60 * 60 * 1000;

function getComAmorSupabase() {
  const supabase = getAdminSupabase();
  if (!supabase) throw new ComAmorIntegrationError('Serviço temporariamente indisponível.', 503, 'database_unavailable');
  return supabase;
}

export interface ComAmorJobInput {
  instruction?: string;
  lyrics?: string;
  musicStyle: string;
}

export interface ComAmorJobRow {
  id: string;
  order_id: string;
  campaign_id: string;
  generation_attempt: number;
  idempotency_key: string;
  payload_hash: string;
  occasion: string;
  music_style: string;
  content_mode: 'instruction' | 'lyrics';
  request_id: string;
  status: 'queued' | 'generating' | 'completed' | 'failed' | 'expired';
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

function payloadHash(input: ComAmorJobInput): string {
  return createHash('sha256').update(JSON.stringify({
    instruction: input.instruction || '',
    lyrics: input.lyrics || '',
    musicStyle: input.musicStyle,
  })).digest('hex');
}

export function publicJobStatus(status: ComAmorJobRow['status']): 'generating' | 'completed' | 'failed' {
  return status === 'completed' ? 'completed' : status === 'failed' || status === 'expired' ? 'failed' : 'generating';
}

export function buildComAmorCallbackBody(job: ComAmorJobRow, status: 'generating' | 'completed' | 'failed', result?: { title: string; audioUrl: string }): string {
  const body: Record<string, unknown> = {
    orderId: job.order_id,
    jobId: job.id,
    generationAttempt: job.generation_attempt,
    status,
  };
  if (status === 'completed' && result) {
    // Callback fields must stay non-personal even when an organizer included
    // names in their prompt or a generated title echoes those names.
    body.title = 'Canção personalizada';
    body.genre = job.music_style;
    body.audioUrl = result.audioUrl;
  }
  if (status === 'failed') body.errorCode = job.error_code || 'generation_failed';
  return JSON.stringify(body);
}

async function queueCallback(job: ComAmorJobRow, status: 'generating' | 'completed' | 'failed', result?: { title: string; audioUrl: string }): Promise<void> {
  const supabase = getComAmorSupabase();
  const { data: existing, error: readError } = await supabase.from('comamor_callback_outbox')
    .select('id, status').eq('job_id', job.id).eq('event_status', status).maybeSingle();
  if (readError) throw new ComAmorIntegrationError('Não foi possível agendar a notificação.', 503, 'callback_queue_unavailable');
  if (existing?.status === 'sent' || existing?.status === 'pending' || existing?.status === 'sending') return;
  if (existing?.id) {
    const { error } = await supabase.from('comamor_callback_outbox').update({
      body_text: buildComAmorCallbackBody(job, status, result), status: 'pending', attempts: 0,
      next_attempt_at: new Date().toISOString(), locked_until: null, last_error_code: null,
    }).eq('id', existing.id);
    if (error) throw new ComAmorIntegrationError('Não foi possível agendar a notificação.', 503, 'callback_queue_unavailable');
    return;
  }
  const { error } = await supabase.from('comamor_callback_outbox').insert({
    job_id: job.id, event_status: status, body_text: buildComAmorCallbackBody(job, status, result),
    status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(),
  });
  if (error) throw new ComAmorIntegrationError('Não foi possível agendar a notificação.', 503, 'callback_queue_unavailable');
}

export async function queueJobStatusCallback(
  job: ComAmorJobRow,
  status: 'generating' | 'completed' | 'failed',
  song: Record<string, unknown> | null
): Promise<void> {
  if (status !== 'completed') {
    await queueCallback(job, status);
    return;
  }
  const audioUrl = assertAllowedComAmorAudioUrl(String(song?.audio_url || ''));
  await queueCallback(job, status, {
    title: typeof song?.title === 'string' ? song.title : 'Canção personalizada',
    audioUrl,
  });
}

export async function createOrGetComAmorJob(auth: ComAmorAuthorization, input: ComAmorJobInput): Promise<ComAmorJobRow> {
  const supabase = getComAmorSupabase();
  const jobId = randomUUID();
  const { data, error } = await supabase.rpc('create_comamor_job', {
    p_job_id: jobId,
    p_order_id: auth.orderId,
    p_campaign_id: auth.campaignId,
    p_generation_attempt: auth.generationAttempt,
    p_idempotency_key: auth.idempotencyKey,
    p_payload_hash: payloadHash(input),
    p_occasion: auth.occasion,
    p_music_style: input.musicStyle,
    p_content_mode: input.lyrics ? 'lyrics' : 'instruction',
    p_instruction: input.instruction || null,
    p_lyrics: input.lyrics || null,
  });
  if (error) {
    if (/idempotency_conflict/i.test(error.message || '')) {
      throw new ComAmorIntegrationError('Esta tentativa já foi enviada com outro conteúdo.', 409, 'idempotency_conflict');
    }
    if (/stale_attempt/i.test(error.message || '')) {
      throw new ComAmorIntegrationError('Esta tentativa já expirou. Atualiza a página e verifica o pedido.', 409, 'stale_attempt');
    }
    throw new ComAmorIntegrationError('Não foi possível registar o pedido. Tenta novamente.', 503, 'job_unavailable');
  }

  const job = (Array.isArray(data) ? data[0] : data) as ComAmorJobRow | null;
  if (!job?.id) throw new ComAmorIntegrationError('Não foi possível registar o pedido. Tenta novamente.', 503, 'job_unavailable');
  if (job.status === 'queued') void processComAmorJob(job).catch(() => {});
  return job;
}

async function setJobStatus(
  job: ComAmorJobRow,
  status: 'completed' | 'failed',
  errorCode?: string,
  result?: { title: string; audioUrl: string }
): Promise<ComAmorJobRow> {
  const supabase = getComAmorSupabase();
  const { data, error } = await supabase.from('comamor_jobs').update({
    status,
    error_code: status === 'failed' ? errorCode || 'generation_failed' : null,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).select('*').single();
  if (error || !data) throw new ComAmorIntegrationError('Não foi possível atualizar o pedido.', 503, 'job_update_failed');
  const updatedJob = data as ComAmorJobRow;
  await queueCallback(updatedJob, status, result);
  return updatedJob;
}

export async function processComAmorJob(job: ComAmorJobRow): Promise<void> {
  const supabase = getComAmorSupabase();
  const { data: claimed, error: claimError } = await supabase.from('comamor_jobs')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', job.id).eq('status', 'queued').select('*').maybeSingle();
  if (claimError || !claimed) return;

  const activeJob = claimed as ComAmorJobRow;
  try {
    await queueCallback(activeJob, 'generating');
    const { data: request, error: requestError } = await supabase.from('song_requests')
      .select('heart_message, special_traits, occasion, music_style')
      .eq('id', job.request_id).single();
    if (requestError || !request) throw new Error('request_missing');

    // The input is intentionally stored only in the existing request record, under
    // the same retention policy as ordinary song requests.
    const content = String(request.heart_message || request.special_traits || '').trim();
    if (!content) throw new Error('content_missing');

    let title = 'Canção personalizada';
    let lyrics: string[] = [];
    let lyricsSnippet = '';
    let letterText = '';
    const isUserLyrics = job.content_mode === 'lyrics';

    if (isUserLyrics) {
      lyrics = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (!lyrics.length) lyrics = [content];
      lyricsSnippet = content.slice(0, 280);
    } else {
      const formData: WizardFormData = {
        recipientName: 'pessoa homenageada',
        recipientRelation: 'pessoa especial',
        occasion: request.occasion || job.occasion,
        musicStyle: request.music_style || job.music_style,
        voiceType: 'Masculina',
        whatMakesSpecial: content,
        messageFromTheHeart: '',
        desiredEmotion: 'Emocionante',
        language: 'português',
      };
      const generated = await generateLyrics(formData, { requestId: job.request_id });
      title = generated.result.songTitle || title;
      lyrics = generated.result.lyrics;
      lyricsSnippet = generated.result.lyricsSnippet || lyrics.join('\n').slice(0, 280);
      letterText = generated.result.letterText || '';
    }

    const { error: songError } = await supabase.from('songs').upsert({
      id: job.id,
      request_id: job.request_id,
      title,
      lyrics,
      lyrics_snippet: lyricsSnippet,
      letter_text: letterText,
      mureka_status: 'not_started',
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (songError) throw new Error('song_persist_failed');

    await runBackgroundSunoWorkflow(job.request_id, job.id, job.music_style, title, lyrics);

    const { data: song, error: resultError } = await supabase.from('songs')
      .select('title, audio_url, mureka_status')
      .eq('id', job.id).single();
    if (resultError || !song) throw new Error('result_missing');
    if (song.mureka_status !== 'completed' || !song.audio_url) {
      await setJobStatus(activeJob, 'failed', 'generation_failed');
      return;
    }

    await setJobStatus(activeJob, 'completed', undefined, { title: song.title || title, audioUrl: song.audio_url });
  } catch {
    try {
      await supabase.from('song_requests').update({ status: 'failed' }).eq('id', job.request_id);
      await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', job.id);
      await setJobStatus(activeJob, 'failed', 'generation_failed');
    } catch {
      // The durable job remains non-complete. A caller can retry delivery/status
      // checks without exposing provider errors or private request content.
    }
  }
}

/** Recover jobs reserved in SQL just before a process restart interrupted the handoff. */
export async function processQueuedComAmorJobs(limit = 5): Promise<void> {
  try {
    const supabase = getComAmorSupabase();
    const { data, error } = await supabase.from('comamor_jobs').select('*')
      .eq('status', 'queued').order('created_at', { ascending: true }).limit(limit);
    if (error || !data?.length) return;
    for (const job of data as ComAmorJobRow[]) void processComAmorJob(job).catch(() => {});
  } catch {
    // The next scheduler tick retries the durable queued reservation.
  }
}

export async function getComAmorJob(jobId: string): Promise<{ job: ComAmorJobRow; song: Record<string, unknown> | null }> {
  const supabase = getComAmorSupabase();
  const { data: job, error } = await supabase.from('comamor_jobs').select('*').eq('id', jobId).maybeSingle();
  if (error || !job) throw new ComAmorIntegrationError('Pedido não encontrado.', 404, 'job_not_found');
  const { data: song } = await supabase.from('songs').select('title, audio_url, mureka_status')
    .eq('id', job.id).maybeSingle();
  return { job: job as ComAmorJobRow, song: song || null };
}

export async function dispatchComAmorCallbacks(limit = 10): Promise<void> {
  const supabase = getComAmorSupabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const [pending, staleSending] = await Promise.all([
    supabase.from('comamor_callback_outbox').select('*').eq('status', 'pending')
      .lte('next_attempt_at', nowIso).order('created_at', { ascending: true }).limit(limit),
    supabase.from('comamor_callback_outbox').select('*').eq('status', 'sending')
      .lt('locked_until', nowIso).order('created_at', { ascending: true }).limit(limit),
  ]);
  if (pending.error || staleSending.error) return;
  const due = [...(pending.data || []), ...(staleSending.data || [])].slice(0, limit);
  if (!due.length) return;

  for (const event of due) {
    let claimQuery = supabase.from('comamor_callback_outbox').update({
      status: 'sending', locked_until: new Date(Date.now() + 30000).toISOString(),
    }).eq('id', event.id).eq('status', event.status);
    if (event.status === 'sending') claimQuery = claimQuery.eq('locked_until', event.locked_until);
    const claim = await claimQuery.select('*').maybeSingle();
    if (claim.error || !claim.data) continue;

    const { data: job } = await supabase.from('comamor_jobs').select('id, order_id, generation_attempt')
      .eq('id', event.job_id).maybeSingle();
    if (!job) {
      await supabase.from('comamor_callback_outbox').update({ status: 'dead', locked_until: null, last_error_code: 'job_missing' }).eq('id', event.id);
      continue;
    }
    const { data: latest } = await supabase.from('comamor_jobs').select('id')
      .eq('order_id', job.order_id).order('generation_attempt', { ascending: false }).limit(1).maybeSingle();
    if (latest?.id !== job.id) {
      await supabase.from('comamor_callback_outbox').update({ status: 'dead', locked_until: null, last_error_code: 'stale_attempt' }).eq('id', event.id);
      continue;
    }

    try {
      await sendComAmorCallback(String(event.body_text));
      await supabase.from('comamor_callback_outbox').update({
        status: 'sent', sent_at: new Date().toISOString(), locked_until: null, last_error_code: null,
      }).eq('id', event.id).eq('status', 'sending');
    } catch (err) {
      const attempts = Number(event.attempts || 0) + 1;
      const dead = attempts >= MAX_CALLBACK_ATTEMPTS;
      const delay = Math.min(30000 * 2 ** Math.min(attempts - 1, 10), MAX_CALLBACK_DELAY_MS);
      await supabase.from('comamor_callback_outbox').update({
        status: dead ? 'dead' : 'pending', attempts,
        next_attempt_at: new Date(Date.now() + delay).toISOString(),
        locked_until: null,
        last_error_code: err instanceof ComAmorIntegrationError ? err.code : 'callback_unavailable',
      }).eq('id', event.id).eq('status', 'sending');
    }
  }
}
