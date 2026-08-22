import { getAdminSupabase } from './supabase';
import { runBackgroundSunoWorkflow, resumeSunoTaskWorkflow } from './workflow';
import { querySunoTask, normalizeLyricsArray } from './suno';
import { logInfo, logWarn, logError } from '../utils/logger';

const INTERVAL_MS = 5 * 60 * 1000;
// Uma geração legítima do Suno dura ~5-6 min (create-task + poll 30x10s). A música
// só é tratada como "presa" se não tiver updates há mais de 15 min — assim nunca
// interferimos com workflows em execução normal (que refrescam updated_at).
const STALE_THRESHOLD_MS = Number(process.env.STUCK_RECOVERY_THRESHOLD_MS || 15 * 60 * 1000);
// Máximo de tentativas de recuperação antes de marcar como failed (evita loop infinito).
const MAX_RECOVERY_ATTEMPTS = 5;
// Estados do pedido em que a geração de áudio está de facto a correr.
const ACTIVE_REQUEST_STATUSES = ['music_processing', 'voice_processing', 'processing'];
let intervalHandle: ReturnType<typeof setInterval> | null = null;

interface StuckSongRow {
  id: string;
  request_id?: string | null;
  title?: string | null;
  lyrics?: unknown;
  mureka_task_id?: string | null;
  mureka_status?: string | null;
  updated_at?: string | null;
  regeneration_count?: number | null;
  song_requests?: Array<Record<string, unknown>> | Record<string, unknown> | null;
}

function firstRelated<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// Task Suno definitivamente falhada? querySunoTask lança "Suno task failed" quando
// o estado é final de falha. Erros de rede/quota são transitórios e não contam.
function isTerminalTaskFailure(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Suno task failed');
}

async function recoverStuckSong(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  row: StuckSongRow
): Promise<void> {
  const req = firstRelated(row.song_requests) as Record<string, unknown> | null;
  if (!req || !row.request_id) return;
  if (req.deleted_at) return;
  const reqStatus = String(req.status || '');
  if (!ACTIVE_REQUEST_STATUSES.includes(reqStatus)) return;

  const requestId = row.request_id;
  const songId = row.id;
  const nowIso = new Date().toISOString();

  // Guarda de max retries: se já excedeu o limite, marca como failed e avisa admin.
  const attempts = row.regeneration_count || 0;
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    logWarn('[StuckMusicRecovery] Máximo de tentativas atingido — a marcar como failed', { requestId, songId, attempts });
    await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', songId);
    return;
  }

  // Claim atómico: só avança se a song ainda está no estado lido e sem áudio.
  // Incrementa regeneration_count no claim para contar a tentativa.
  const { data: claimed, error: claimErr } = await supabase
    .from('songs')
    .update({ updated_at: nowIso, regeneration_count: attempts + 1 })
    .eq('id', songId)
    .eq('mureka_status', String(row.mureka_status || ''))
    .is('audio_url', null)
    .select('id')
    .maybeSingle();
  if (claimErr) {
    logError('[StuckMusicRecovery] Falha ao reclamar música', claimErr, { songId });
    return;
  }
  if (!claimed) return;

  if (row.mureka_task_id) {
    // Se a task já foi retentada >= 2 vezes (regeneration_count >= 2), a task Suno
    // antiga provavelmente expirou — devolve "processing" infinitamente sem nunca
    // entregar áudio. Descartamos a task e caímos no runBackgroundSunoWorkflow para
    // gerar uma task NOVA — evita o loop infinito de resume sem resultado.
    if (attempts >= 2) {
      logWarn('[StuckMusicRecovery] Task ja retentada >= 2x sem sucesso — a descartar e gerar nova task Suno', { requestId, songId, taskId: row.mureka_task_id, attempts });
      await supabase.from('songs').update({ mureka_task_id: null }).eq('id', songId);
      // Fall through para runBackgroundSunoWorkflow abaixo
    } else {
      try {
        const sunoRes = await querySunoTask(row.mureka_task_id);
        const isTaskActive = !!sunoRes.audioUrl || ['processing', 'generating', 'text_success', 'pending'].includes(String(sunoRes.status || '').toLowerCase());
        const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        const isStuckLong = Date.now() - updatedMs > 15 * 60 * 1000;

        if (!isTaskActive && isStuckLong) {
          logWarn('[StuckMusicRecovery] Task Suno estagnada ha >15min sem audio — a reiniciar nova geracao', { requestId, songId, taskId: row.mureka_task_id });
        } else {
          logInfo('[StuckMusicRecovery] A retomar task Suno existente', { requestId, songId, taskId: row.mureka_task_id });
          resumeSunoTaskWorkflow(requestId, songId, row.mureka_task_id).catch(err =>
            logError('[StuckMusicRecovery] Falha ao retomar task', err, { requestId, songId })
          );
          return;
        }
      } catch (err: unknown) {
        if (isTerminalTaskFailure(err)) {
          logWarn('[StuckMusicRecovery] Task Suno falhou — a marcar musica como failed', { requestId, songId, taskId: row.mureka_task_id });
          await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', songId);
          return;
        }
        logWarn('[StuckMusicRecovery] Consulta Suno transitoria — adiar recuperacao', { requestId, songId, message: err instanceof Error ? err.message : String(err) });
        return;
      }
    }
  }

  logInfo('[StuckMusicRecovery] A reiniciar workflow Suno (sem task id)', { requestId, songId });
  runBackgroundSunoWorkflow(
    requestId,
    songId,
    String(req.music_style || 'Kizomba'),
    String(row.title || 'Música SeuBeat'),
    normalizeLyricsArray(row.lyrics),
    {
      voiceType: String(req.voice_type || '') || undefined,
      desiredEmotion: String(req.desired_emotion || '') || undefined,
    }
  ).catch(err => logError('[StuckMusicRecovery] Falha ao reiniciar workflow', err, { requestId, songId }));
}

export async function processStuckMusicRecovery(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) {
    logWarn('[StuckMusicRecovery] Admin Supabase client indisponivel');
    return;
  }

  const staleSince = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  // Dois queries para cobrir dois cenários:
  // 1. Songs com task_id mas presas há >15min (stale)
  // 2. Songs sem task_id (workflow nunca completou ou task perdida) — recover regardless de updated_at
  const [staleResult, tasklessResult] = await Promise.all([
    supabase
      .from('songs')
      .select('id, request_id, title, lyrics, mureka_task_id, mureka_status, updated_at, regeneration_count, song_requests!inner(*)')
      .in('mureka_status', ['generating', 'processing'])
      .is('audio_url', null)
      .not('mureka_task_id', 'is', null)
      .lt('updated_at', staleSince)
      .order('updated_at', { ascending: true }),
    supabase
      .from('songs')
      .select('id, request_id, title, lyrics, mureka_task_id, mureka_status, updated_at, regeneration_count, song_requests!inner(*)')
      .in('mureka_status', ['generating', 'processing'])
      .is('audio_url', null)
      .is('mureka_task_id', null)
      .order('updated_at', { ascending: true }),
  ]);

  if (staleResult.error) {
    logError('[StuckMusicRecovery] Erro ao consultar músicas presas (stale)', staleResult.error);
    return;
  }
  if (tasklessResult.error) {
    logError('[StuckMusicRecovery] Erro ao consultar músicas presas (taskless)', tasklessResult.error);
    return;
  }

  // Merge e dedup por id
  const seen = new Set<string>();
  const rows: StuckSongRow[] = [];
  for (const r of [...(staleResult.data || []), ...(tasklessResult.data || [])]) {
    if (!seen.has(r.id)) { seen.add(r.id); rows.push(r as StuckSongRow); }
  }

  if (!rows || rows.length === 0) return;

  logInfo(`[StuckMusicRecovery] ${rows.length} música(s) presa(s) detectadas`);
  for (const row of rows as StuckSongRow[]) {
    await recoverStuckSong(supabase, row);
  }
}

export function startStuckMusicRecoveryScheduler(): void {
  if (intervalHandle) return;
  logInfo('[StuckMusicRecovery] Iniciado (intervalo: 5min)');
  processStuckMusicRecovery();
  intervalHandle = setInterval(processStuckMusicRecovery, INTERVAL_MS);
  intervalHandle.unref();
}
