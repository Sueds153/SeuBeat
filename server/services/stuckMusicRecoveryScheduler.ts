import { getAdminSupabase } from './supabase';
import { runBackgroundSunoWorkflow, resumeSunoTaskWorkflow } from './workflow';
import { querySunoTask, normalizeLyricsArray } from './suno';
import { logInfo, logWarn, logError } from '../utils/logger';

const INTERVAL_MS = 5 * 60 * 1000;
// Uma geração legítima do Suno dura ~5-6 min (create-task + poll 30x10s). A música
// só é tratada como "presa" se não tiver updates há mais de 15 min — assim nunca
// interferimos com workflows em execução normal (que refrescam updated_at).
const STALE_THRESHOLD_MS = Number(process.env.STUCK_RECOVERY_THRESHOLD_MS || 15 * 60 * 1000);
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
  song_requests?: Array<Record<string, unknown>> | Record<string, unknown> | null;
}

function firstRelated<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

// Task Suno definitivamente falhada? querySunoTask lança "Suno task failed" quando
// o estado é final de falha. Erros de rede/quota são transitórios e não contam.
function isTerminalTaskFailure(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Suno task failed');
}

async function claimSong(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  songId: string,
  expectedStatus: string,
  nowIso: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('songs')
    .update({ updated_at: nowIso })
    .eq('id', songId)
    .eq('mureka_status', expectedStatus)
    .is('audio_url', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logError('[StuckMusicRecovery] Falha ao reclamar música', error, { songId });
    return false;
  }
  return !!data;
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

  // Claim atómico: só avança se a song ainda está no estado lido e sem áudio.
  if (!(await claimSong(supabase, songId, String(row.mureka_status || ''), nowIso))) return;

  if (row.mureka_task_id) {
    try {
      const sunoRes = await querySunoTask(row.mureka_task_id);
      const isTaskActive = !!sunoRes.audioUrl || ['processing', 'generating', 'text_success', 'pending'].includes(String(sunoRes.status || '').toLowerCase());
      const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const isStuckLong = Date.now() - updatedMs > 15 * 60 * 1000;

      if (!isTaskActive && isStuckLong) {
        logWarn('[StuckMusicRecovery] Task Suno estagnada há >15min sem áudio — a reiniciar nova geração', { requestId, songId, taskId: row.mureka_task_id });
      } else {
        logInfo('[StuckMusicRecovery] A retomar task Suno existente', { requestId, songId, taskId: row.mureka_task_id });
        resumeSunoTaskWorkflow(requestId, songId, row.mureka_task_id).catch(err =>
          logError('[StuckMusicRecovery] Falha ao retomar task', err, { requestId, songId })
        );
        return;
      }
    } catch (err: unknown) {
      if (isTerminalTaskFailure(err)) {
        logWarn('[StuckMusicRecovery] Task Suno falhou — a marcar música como failed', { requestId, songId, taskId: row.mureka_task_id });
        await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', songId);
        return;
      }
      logWarn('[StuckMusicRecovery] Consulta Suno transitória — adiar recuperação', { requestId, songId, message: err instanceof Error ? err.message : String(err) });
      return;
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

  const { data: rows, error } = await supabase
    .from('songs')
    .select('id, request_id, title, lyrics, mureka_task_id, mureka_status, updated_at, song_requests!inner(*)')
    .in('mureka_status', ['generating', 'processing'])
    .is('audio_url', null)
    .lt('updated_at', staleSince)
    .order('updated_at', { ascending: true });

  if (error) {
    logError('[StuckMusicRecovery] Erro ao consultar músicas presas', error);
    return;
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
