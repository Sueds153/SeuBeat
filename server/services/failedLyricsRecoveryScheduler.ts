import { getAdminSupabase } from './supabase';
import { generateLyrics } from './ai';
import { sendLyricsRecoveredEmail } from './email';
import { WizardFormData } from './types';
import { logInfo, logError, logWarn } from '../utils/logger';

const INTERVAL_MS = 10 * 60 * 1000;
// Só recupera pedidos falhados nas últimas 48h — não gasta créditos de IA em leads antigos.
const RECOVERY_WINDOW_MS = 48 * 60 * 60 * 1000;
// Emails que já têm um pedido recuperável (letra pronta) não recebem outra geração
// nem outro link de pagamento — evitam-se duplicados e confusão de ligações.
const RECOVERABLE_STATUSES = ['lyrics_ready', 'payment_submitted'];
let intervalHandle: ReturnType<typeof setInterval> | null = null;

interface RecoveryCandidate {
  id: string;
  email?: string | null;
  recipient_name?: string | null;
  recipient_gender?: string | null;
  relationship?: string | null;
  recipient_nick?: string | null;
  occasion?: string | null;
  music_style?: string | null;
  voice_type?: string | null;
  special_traits?: string | null;
  memory?: string | null;
  heart_message?: string | null;
  desired_emotion?: string | null;
  language?: string | null;
  reference_artist?: string | null;
  why_created_today?: string | null;
  only_she_does?: string | null;
  where_it_happened?: string | null;
  hook_phrase?: string | null;
  created_at?: string;
  error_details?: Record<string, unknown> | null;
  users?: { name?: string | null } | Array<{ name?: string | null }> | null;
  songs?: Array<{ id: string }> | null;
}

function firstRelated<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// Mapeamento idêntico ao usado no /api/song/resume-data e no regenerate do admin.
export function buildRecoveryFormData(req: RecoveryCandidate): WizardFormData {
  const user = firstRelated(req.users) as { name?: string | null } | null;
  return {
    userNick: user?.name || 'Autor',
    recipientName: req.recipient_name || 'Destinatario',
    recipientGender: req.recipient_gender || 'Masculino',
    recipientRelation: req.relationship || 'Parceiro',
    recipientNick: req.recipient_nick || '',
    occasion: req.occasion || 'Homenagem',
    musicStyle: req.music_style || 'Kizomba',
    voiceType: req.voice_type || 'Masculina',
    unforgettableMemory: req.memory || '',
    whatMakesSpecial: req.special_traits || '',
    onlySheDoes: req.only_she_does || '',
    whereItHappened: req.where_it_happened || '',
    whyCreatedToday: req.why_created_today || '',
    referenceArtist: req.reference_artist || '',
    messageFromTheHeart: req.heart_message || '',
    hookPhrase: req.hook_phrase || '',
    desiredEmotion: req.desired_emotion || 'Emocionante',
    language: req.language || 'português'
  };
}

// Dado o conjunto de pedidos falhados (ordenados do mais recente para o mais antigo),
// devolve no máximo um candidato por email — o mais recente — dentro da janela de 48h
// e sem música associada.
export function pickRecoveryCandidates(requests: RecoveryCandidate[], nowMs = Date.now()): RecoveryCandidate[] {
  const cutoff = nowMs - RECOVERY_WINDOW_MS;
  const byEmail = new Map<string, RecoveryCandidate>();
  for (const req of requests) {
    const createdAt = req.created_at ? new Date(req.created_at).getTime() : nowMs;
    if (Number.isNaN(createdAt) || createdAt < cutoff) continue;
    if (Array.isArray(req.songs) && req.songs.length > 0) continue;
    const email = (req.email || '').toLowerCase();
    if (!email) continue;
    if (byEmail.has(email)) continue;
    byEmail.set(email, req);
  }
  return [...byEmail.values()];
}

// Emails que já têm outro pedido recuperável (letra pronta) não são regenerados.
async function userHasRecoverableRequest(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  email: string,
  excludeRequestId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('song_requests')
    .select('id')
    .eq('email', email)
    .in('status', RECOVERABLE_STATUSES)
    .is('deleted_at', null)
    .neq('id', excludeRequestId)
    .limit(1);

  if (error) {
    logWarn('[FailedLyricsRecovery] Erro ao verificar pedido recuperável', { error, email });
    return true;
  }
  return !!data && data.length > 0;
}

// One-shot: marca recovery_retried_at em error_details e devolve true se o update
// foi aplicado. Se outra execução já tiver reclamado o pedido, devolve false.
// Nas raras falhas da geração em si, o pedido permanece failed mas com o marcador —
// nunca volta a ser tentado pelo scheduler.
async function claimRequest(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  req: RecoveryCandidate,
  nowIso: string
): Promise<boolean> {
  const current = req.error_details || {};
  const nextDetails = { ...current, recovery_retried_at: nowIso };
  const { data, error } = await supabase
    .from('song_requests')
    .update({ error_details: nextDetails })
    .eq('id', req.id)
    .eq('status', 'failed')
    .filter('error_details->>recovery_retried_at', 'is', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logError('[FailedLyricsRecovery] Falha ao reclamar pedido', error, { requestId: req.id });
    return false;
  }
  return !!data;
}

async function recoverRequest(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  req: RecoveryCandidate
): Promise<void> {
  const now = new Date().toISOString();
  if (!req.email) return;

  if (await userHasRecoverableRequest(supabase, req.email, req.id)) {
    logInfo('[FailedLyricsRecovery] Email já tem pedido recuperável — skip', { requestId: req.id, email: req.email });
    return;
  }

  if (!(await claimRequest(supabase, req, now))) return;

  try {
    const formData = buildRecoveryFormData(req);
    logInfo('[FailedLyricsRecovery] A recuperar letra', { requestId: req.id, email: req.email });
    const { result: parsedData } = await generateLyrics(formData, {
      requestId: req.id,
      email: req.email
    });

    const { error: songError } = await supabase.from('songs').insert([{
      request_id: req.id,
      title: parsedData.songTitle,
      lyrics: parsedData.lyrics,
      lyrics_snippet: parsedData.lyricsSnippet,
      letter_text: parsedData.letterText,
      mureka_status: 'not_started'
    }]);
    if (songError) throw songError;

    const { error: statusError } = await supabase
      .from('song_requests')
      .update({ status: 'lyrics_ready', error_details: null })
      .eq('id', req.id);
    if (statusError) throw statusError;

    await sendLyricsRecoveredEmail(req.email, req.recipient_name || '', req.id);
    logInfo('[FailedLyricsRecovery] Pedido recuperado com sucesso', { requestId: req.id, email: req.email });
  } catch (err) {
    // error_details mantém recovery_retried_at → não volta a ser tentado pelo scheduler.
    logError('[FailedLyricsRecovery] Falha ao recuperar pedido', err, { requestId: req.id, email: req.email });
  }
}

export async function processFailedLyricsRecovery(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) {
    logWarn('[FailedLyricsRecovery] Admin Supabase client indisponivel');
    return;
  }

  const since = new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString();

  const { data: candidates, error } = await supabase
    .from('song_requests')
    .select('*, songs(id), users(name)')
    .eq('status', 'failed')
    .is('deleted_at', null)
    .not('error_details', 'is', null)
    .filter('error_details->>recovery_retried_at', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    logError('[FailedLyricsRecovery] Erro ao consultar pedidos falhados', error);
    return;
  }

  if (!candidates || candidates.length === 0) return;

  const picked = pickRecoveryCandidates(candidates as RecoveryCandidate[]);
  if (picked.length === 0) return;

  logInfo(`[FailedLyricsRecovery] ${picked.length} candidato(s) a recuperação`);
  await Promise.all(picked.map(req => recoverRequest(supabase, req)));
}

export function startFailedLyricsRecoveryScheduler(): void {
  if (intervalHandle) return;
  logInfo('[FailedLyricsRecovery] Iniciado (intervalo: 10min)');
  processFailedLyricsRecovery();
  intervalHandle = setInterval(processFailedLyricsRecovery, INTERVAL_MS);
  intervalHandle.unref();
}