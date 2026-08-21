import path from 'path';
import fs from 'fs';
import os from 'os';
import { getAdminSupabase } from './supabase';
import { uploadFileToStorage, createSignedStorageUrl } from './storage';
import { downloadFile, createPreviewAudio, applyFades, convertToWav, getAudioDuration } from './audio';
import { querySunoTask, generateFullSong } from './suno';
import { generateValidationPhrase, waitForValidationPhrase, createCustomVoice, waitForVoiceId, checkVoiceAvailability } from './suno-voice';
import { sendPersonalizedEmail, sendConfirmationEmail, sendAdminNotification, sendWorkflowFailedEmail } from './email';
import { getAudioFileInfo, getAppUrl } from '../utils/helpers';
import { logInfo, logWarn, logError } from '../utils/logger';
import { RequestProgress } from './types';

const PROGRESS_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Duração mínima (em segundos) para aceitar uma música como válida.
// O Suno devolve clips parciais (~8s) em TEXT_SUCCESS/FIRST_SUCCESS;
// estas devem ser rejeitadas para não entregar músicas incompletas.
const MIN_SONG_DURATION_SEC = 30;

export const requestProgressMap: Record<string, RequestProgress> = {};

export function setProgress(requestId: string, progress: Omit<RequestProgress, 'updatedAt'>) {
  requestProgressMap[requestId] = { ...progress, updatedAt: Date.now() };
}

// Periodic cleanup of stale progress entries
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of Object.entries(requestProgressMap)) {
    if (now - p.updatedAt > PROGRESS_TTL_MS) delete requestProgressMap[id];
  }
}, 60_000).unref();

const VOICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Suno Voice expiry)

interface SavedVoiceMeta {
  id: string;
  taskId: string;
  ts: number;
}

function parseSavedVoice(value: unknown): SavedVoiceMeta | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.taskId && parsed.ts) {
      return parsed as SavedVoiceMeta;
    }
  } catch {}
  return null;
}

function isVoiceExpired(ts: number): boolean {
  return Date.now() - ts > VOICE_MAX_AGE_MS;
}

function adminErrorDetails(stage: string, err: unknown) {
  return {
    stage,
    message: err instanceof Error ? err.message : String(err ?? ''),
    name: err instanceof Error ? err.name : typeof err,
    at: new Date().toISOString()
  };
}

export async function updateRequestStatus(requestId: string, status: string, err?: unknown) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  const payload: Record<string, unknown> = { status };
  if (err) payload.error_details = adminErrorDetails(status, err);

  const { error } = await supabase.from('song_requests').update(payload).eq('id', requestId);
  if (!error) return;

  if (err && /error_details/i.test(error.message || '')) {
    const { error: fallbackError } = await supabase.from('song_requests').update({ status }).eq('id', requestId);
    if (!fallbackError) return;
    throw fallbackError;
  }

  throw error;
}

export async function persistGeneratedSunoAudio(songId: string, taskId: string, audioUrl: string) {
  const fileInfo = getAudioFileInfo(audioUrl);
  const tempSunoPath = path.join(os.tmpdir(), `${songId}_suno.${fileInfo.ext}`);
  const tempFadedPath = path.join(os.tmpdir(), `${songId}_faded.${fileInfo.ext}`);
  const tempPreviewPath = path.join(os.tmpdir(), `${songId}_preview.mp3`);

  try {
    await downloadFile(audioUrl, tempSunoPath);

    // Guarda de duração: rejeitar clips parciais do Suno (~8s)
    const durationSec = await getAudioDuration(tempSunoPath);
    logInfo('[Workflow] Audio duration check', { songId, taskId, durationSec });
    if (durationSec > 0 && durationSec < MIN_SONG_DURATION_SEC) {
      throw new Error(
        `Áudio gerado demasiado curto (${durationSec.toFixed(1)}s < ${MIN_SONG_DURATION_SEC}s). O Suno devolveu apenas um clip parcial.`
      );
    }
    const durationInt = durationSec > 0 ? Math.round(durationSec) : null;

    try {
      await applyFades(tempSunoPath, tempFadedPath);
    } catch (fadeErr) {
      logWarn('[Workflow] Fades falharam, a usar áudio original', fadeErr instanceof Error ? fadeErr : undefined);
      fs.copyFileSync(tempSunoPath, tempFadedPath);
    }

    const fadedFileExists = fs.existsSync(tempFadedPath) && fs.statSync(tempFadedPath).size > 0;
    const uploadSource = fadedFileExists ? tempFadedPath : tempSunoPath;

    const originalFilename = `songs/${songId}_original.${fileInfo.ext}`;
    const fullAudioUrl = await uploadFileToStorage('full-audio', originalFilename, uploadSource, fileInfo.mimeType);

    const previewFilename = `previews/${songId}_preview.mp3`;
    let publicPreviewUrl: string | null = null;
    try {
      await createPreviewAudio(uploadSource, tempPreviewPath);
      publicPreviewUrl = await uploadFileToStorage('preview', previewFilename, tempPreviewPath, 'audio/mpeg');
    } catch (err) {
      logWarn('[Workflow] Preview de 30s falhou; áudio completo não será usado como preview', err instanceof Error ? err : undefined);
    }

    return { taskId, fullAudioUrl, publicPreviewUrl, duration: durationInt };
  } finally {
    try { fs.unlinkSync(tempSunoPath); } catch {}
    try { fs.unlinkSync(tempFadedPath); } catch {}
    try { fs.unlinkSync(tempPreviewPath); } catch {}
  }
}

async function completeSunoWorkflowFromAudio(
  requestId: string,
  songId: string,
  taskId: string,
  audioUrl: string
) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  setProgress(requestId, { status: 'generating', progress: 60, message: 'Geração concluída no Suno. A descarregar ficheiro...' });
  setProgress(requestId, { status: 'generating', progress: 75, message: 'A guardar áudio original no Supabase Storage...' });

  const { fullAudioUrl, publicPreviewUrl, duration } = await persistGeneratedSunoAudio(songId, taskId, audioUrl);
  logInfo(`[Background Suno] Saved original to full-audio`, { songId, taskId });

  // Reusamos as colunas mureka_task_id e mureka_status no banco de dados para evitar migrations complexas
  const { error: songUpdateError } = await supabase
    .from('songs')
    .update({
      audio_url: fullAudioUrl,
      full_song_url: fullAudioUrl,
      preview_url: publicPreviewUrl,
      duration,
      mureka_task_id: taskId,
      mureka_status: 'completed'
    })
    .eq('id', songId);
  if (songUpdateError) throw songUpdateError;

  const { data: approvedPayment } = await supabase
    .from('payments')
    .select('id, plan, created_at')
    .eq('request_id', requestId)
    .eq('status', 'approved')
    .maybeSingle();

  const isStandard = approvedPayment && approvedPayment.plan === 'standard';
  const paymentCreatedAt = approvedPayment?.created_at || new Date().toISOString();
  const deliverAt = isStandard ? new Date(new Date(paymentCreatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : null;

  await supabase
    .from('song_requests')
    .update({
      status: approvedPayment ? (isStandard ? 'approved' : 'delivered') : 'music_ready',
      deliver_at: deliverAt,
      final_mixed_audio_url: fullAudioUrl
    })
    .eq('id', requestId);

  setProgress(requestId, { status: 'completed', progress: 100, message: 'Fluxo Suno concluído com sucesso!' });
}

export async function resumeSunoTaskWorkflow(requestId: string, songId: string, taskId: string) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  try {
    logInfo(`[Background Suno] Resuming task for Request`, { requestId, songId, taskId });
    setProgress(requestId, { status: 'processing', progress: 25, message: 'A consultar task Suno existente...' });

    await updateRequestStatus(requestId, 'music_processing');
    const { error: resumeSongError } = await supabase.from('songs').update({ mureka_status: 'processing' }).eq('id', songId);
    if (resumeSongError) throw resumeSongError;

    for (let attempt = 0; attempt < 60; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 10000));
      const { audioUrl, status } = await querySunoTask(taskId);
      logInfo(`[Background Suno] Resume poll`, { attempt: attempt + 1, status, hasAudio: !!audioUrl, requestId });

      if (audioUrl) {
        await completeSunoWorkflowFromAudio(requestId, songId, taskId, audioUrl);
        logInfo(`[Background Suno] Existing task completed`, { requestId });

        // Send delivery/confirmation email after resume
        try {
          const { data: sr } = await supabase
            .from('song_requests')
            .select('status, email, recipient_name, users!inner(email, name), songs!inner(id, letter_text, title)')
            .eq('id', requestId)
            .single();
          if (sr) {
            const song = sr.songs?.[0];
            const userEmail = sr.email || sr.users?.[0]?.email;
            const songReqStatus = sr.status;
            if (userEmail && (songReqStatus === 'approved' || songReqStatus === 'delivered')) {
              const slug = (sr.recipient_name || 'especial')
                .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
              const url = `${getAppUrl()}/song/${slug}?id=${song?.id || songId}`;
              if (songReqStatus === 'approved') {
                sendConfirmationEmail(userEmail, sr.recipient_name, requestId, 'standard_approved')
                  .catch(err => logError('[Resume] Confirmation email failed', err, { requestId }));
              } else {
                sendPersonalizedEmail(userEmail, sr.recipient_name, url, song?.letter_text || 'Dedicatória.')
                  .catch(err => logError('[Resume] Delivery email failed', err, { requestId }));
              }
            }
          }
        } catch (emailErr) {
          logError('[Resume] Failed to send notification email', emailErr, { requestId });
        }

        return;
      }

      setProgress(requestId, {
        status: 'processing',
        progress: Math.min(85, 30 + attempt),
        message: `Suno ainda está a processar (${status || 'processing'}).`
      });
    }

    setProgress(requestId, {
      status: 'processing',
      progress: 85,
      message: 'Suno ainda está a processar. Tente novamente daqui a pouco para continuar a verificação.'
    });
  } catch (err: unknown) {
    logError('[Background Suno] Error while resuming task', err instanceof Error ? err : new Error(String(err)), { requestId, songId, taskId });
    setProgress(requestId, { status: 'failed', progress: 100, message: 'Erro na consulta Suno', error: err instanceof Error ? err.message : String(err) });
    await updateRequestStatus(requestId, 'failed', err instanceof Error ? err : new Error(String(err)));
    await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', songId);

    await rollbackSunoWorkflow(supabase, requestId, songId, err);
  }
}

export async function runBackgroundSunoWorkflow(
  requestId: string,
  songId: string,
  musicStyle: string,
  songTitle: string,
  lyrics: string[] | string,
  extraParams?: { voiceType?: string; desiredEmotion?: string; referenceArtist?: string }
) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  try {
    logInfo(`[Background Suno] Starting workflow`, { requestId, songId });
    setProgress(requestId, { status: 'generating', progress: 10, message: 'A iniciar fluxo de geração Suno...' });

    await updateRequestStatus(requestId, 'music_processing');

    const { error: initialSongUpdateError } = await supabase
      .from('songs')
      .update({ mureka_status: 'generating' })
      .eq('id', songId);
    if (initialSongUpdateError) throw initialSongUpdateError;

    // Verificar se existe amostra de voz e obter dados do pedido
    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(*), users(*)')
      .eq('id', requestId)
      .single();

    if (reqError || !requestData) {
      throw new Error(`Failed to fetch song request: ${reqError?.message}`);
    }

    const hasVoiceSample = !!requestData.voice_sample_url;

    // Verificar se já existe voiceId guardado e ainda válido (evita regravar voz)
    let personaId: string | undefined;
    if (hasVoiceSample) {
      const savedVoice = parseSavedVoice(requestData.elevenlabs_voice_id);
      if (savedVoice && !isVoiceExpired(savedVoice.ts)) {
        logInfo(`[Background Suno] Reusing saved voiceId`, { voiceId: savedVoice.id, created: new Date(savedVoice.ts).toISOString() });
        personaId = savedVoice.id;
      }
    }

    if (hasVoiceSample && !personaId) {
      logInfo(`[Background Suno] Voice sample found, starting Suno Voice`, { requestId });
      setProgress(requestId, { status: 'generating', progress: 20, message: 'A processar clonagem de voz Suno Voice...' });

      await supabase.from('song_requests').update({ status: 'voice_processing' }).eq('id', requestId);

      try {
        const voiceId = await processSunoVoice(requestId, songId, requestData.voice_sample_url!);
        if (voiceId) {
          personaId = voiceId;
          logInfo(`[Background Suno] Suno Voice ID obtained`, { voiceId });
        }
      } catch (voiceErr: unknown) {
        logError(`[Background Suno] Suno Voice failed, generating without voice`, voiceErr instanceof Error ? voiceErr : new Error(String(voiceErr)), { requestId });
        await supabase
          .from('song_requests')
          .update({
            error_details: {
              stage: 'voice_cloning',
              message: voiceErr instanceof Error ? voiceErr.message : String(voiceErr ?? ''),
              at: new Date().toISOString()
            }
          })
          .eq('id', requestId);
      }

      setProgress(requestId, { status: 'music_processing', progress: 30, message: 'Voz processada. A gerar música...' });
    }

    setProgress(requestId, { status: 'generating', progress: 30, message: 'A submeter letra ao Suno AI...' });

    const { taskId, audioUrl: finalAudioUrl } = await generateFullSong(lyrics, musicStyle, songTitle, personaId, extraParams);

    const { error: taskUpdateError } = await supabase
      .from('songs')
      .update({
        mureka_task_id: taskId,
        mureka_status: 'processing'
      })
      .eq('id', songId);
    if (taskUpdateError) throw taskUpdateError;

    if (!finalAudioUrl) {
      setProgress(requestId, {
        status: 'processing',
        progress: 85,
        message: 'Suno ainda está a processar. A música ainda não está pronta.'
      });
      logWarn(`[Background Suno] Task still processing after generation`, { taskId, requestId });
      return;
    }

    logInfo(`[Background Suno] Generated successfully`, { taskId, requestId });
    setProgress(requestId, { status: 'generating', progress: 60, message: 'Geração concluída no Suno. A descarregar ficheiro...' });
    setProgress(requestId, { status: 'generating', progress: 75, message: 'A guardar áudio original no Supabase Storage...' });

    const { fullAudioUrl, publicPreviewUrl, duration } = await persistGeneratedSunoAudio(songId, taskId, finalAudioUrl);
    logInfo(`[Background Suno] Audio saved to storage`, { songId, taskId });

    const { error: completedSongUpdateError } = await supabase
      .from('songs')
      .update({
        audio_url: fullAudioUrl,
        full_song_url: fullAudioUrl,
        preview_url: publicPreviewUrl,
        duration,
        mureka_task_id: taskId,
        mureka_status: 'completed'
      })
      .eq('id', songId);
    if (completedSongUpdateError) throw completedSongUpdateError;

    const { data: approvedPayment } = await supabase
      .from('payments')
      .select('id, plan, created_at')
      .eq('request_id', requestId)
      .eq('status', 'approved')
      .maybeSingle();

    const isStandard = approvedPayment && approvedPayment.plan === 'standard';
    const nextStatus = approvedPayment ? (isStandard ? 'approved' : 'delivered') : 'music_ready';
    logInfo(`[Background Suno] Updating request after generation`, { requestId, nextStatus, paid: !!approvedPayment, isStandard });
    const userEmail = requestData.email || requestData.users?.email;
    const letterText = requestData.songs?.[0]?.letter_text || 'Dedicatória.';

    const paymentCreatedAt = approvedPayment?.created_at || new Date().toISOString();
    const deliverAt = isStandard ? new Date(new Date(paymentCreatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : null;

    await supabase
      .from('song_requests')
      .update({
        final_mixed_audio_url: fullAudioUrl,
        status: nextStatus,
        deliver_at: deliverAt,
      })
      .eq('id', requestId);

    setProgress(requestId, { status: 'completed', progress: 100, message: approvedPayment ? (isStandard ? 'Música gerada. Será entregue em 24h.' : 'Música gerada e entregue com sucesso!') : 'Música pronta. Aguardando confirmação do pagamento.' });

    if (approvedPayment && userEmail) {
      const slug = (requestData.recipient_name || 'especial')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const personalizedUrl = `${getAppUrl()}/song/${slug}?id=${songId}`;

      if (isStandard) {
        logInfo(`[Background Suno] Sending confirmation email (Standard - 24h delay)`, { userEmail });
        sendConfirmationEmail(
          userEmail,
          requestData.recipient_name,
          requestId,
          'standard_approved'
        ).catch((emailErr) => {
          logError('[Background Suno] Confirmation email failed', emailErr, { requestId, userEmail });
        });
      } else {
        logInfo(`[Background Suno] Sending delivery email`, { userEmail });
        sendPersonalizedEmail(
          userEmail,
          requestData.recipient_name,
          personalizedUrl,
          letterText
        ).catch((emailErr) => {
          logError('[Background Suno] Delivery email failed (song already delivered)', emailErr, { requestId, userEmail });
        });
      }
    }
    logInfo(`[Background Suno] Workflow completed`, { requestId, nextStatus });
  } catch (err: unknown) {
    logError('[Background Suno] Error in background workflow', err instanceof Error ? err : new Error(String(err)), { requestId, songId });
    setProgress(requestId, { status: 'failed', progress: 100, message: 'Erro na geração Suno', error: err instanceof Error ? err.message : String(err) });
    await updateRequestStatus(requestId, 'failed', err instanceof Error ? err : new Error(String(err)));
    await supabase
      .from('songs')
      .update({ mureka_status: 'failed' })
      .eq('id', songId);

    await rollbackSunoWorkflow(supabase, requestId, songId, err);
  }
}

async function rollbackStorageForSong(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  songId: string,
  requestId: string,
  voiceSampleUrl?: string | null
) {
  const { deleteStorageFiles, listStorageFiles } = await import('./storage');
  
  // full-audio: songs/{songId}_original.{ext}
  try {
    const files = await listStorageFiles('full-audio', 'songs/');
    const matches = files.filter(f => f.name.startsWith(`${songId}`)).map(f => `songs/${f.name}`);
    if (matches.length > 0) {
      await deleteStorageFiles('full-audio', matches);
      logInfo(`[Rollback] Storage limpo: ${matches.length} ficheiro(s) em full-audio`, { songId });
    }
  } catch {}
  // preview: previews/{songId}_preview.mp3
  try {
    await deleteStorageFiles('preview', [`previews/${songId}_preview.mp3`]);
  } catch {}
  // preview: sunovoice/{requestId}_*
  try {
    const voiceFiles = await listStorageFiles('preview', 'sunovoice/');
    const matches = voiceFiles.filter(f => f.name.startsWith(requestId)).map(f => `sunovoice/${f.name}`);
    if (matches.length > 0) {
      await deleteStorageFiles('preview', matches);
      logInfo(`[Rollback] Storage limpo: ${matches.length} ficheiro(s) de voz em preview`, { requestId });
    }
  } catch {}
  // voice-samples: original sample (apenas se for path, nao URL externo)
  if (voiceSampleUrl && !voiceSampleUrl.startsWith('http')) {
    try {
      await deleteStorageFiles('voice-samples', [voiceSampleUrl]);
    } catch {}
  }
}

export async function rollbackSunoWorkflow(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  requestId: string,
  songId: string,
  err: unknown
) {
  // Dados do cliente (email + nome) usados nas notificações — consultados uma vez
  let userEmail: string | null | undefined;
  let recipientName: string | undefined;
  try {
    const { data: failedRequest } = await supabase
      .from('song_requests')
      .select('email, recipient_name, users(email)')
      .eq('id', requestId)
      .single();
    userEmail = failedRequest?.email || failedRequest?.users?.[0]?.email || null;
    recipientName = failedRequest?.recipient_name || undefined;
  } catch (infoErr) {
    logError('[Rollback] Não foi possível obter dados do cliente', infoErr, { requestId });
  }

  // Reverter pagamentos aprovados para 'failed' + limpar approved_at
  let revertedCount = 0;
  try {
    const { data: approvedPayments } = await supabase
      .from('payments')
      .select('id')
      .eq('request_id', requestId)
      .eq('status', 'approved');

    if (approvedPayments && approvedPayments.length > 0) {
      revertedCount = approvedPayments.length;
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          approved_at: null,
          notes: 'Revertido automaticamente — falha na geração Suno'
        })
        .eq('request_id', requestId)
        .eq('status', 'approved');
      logWarn(`[Rollback] ${revertedCount} pagamento(s) revertido(s) para 'failed'`, { requestId });
    }
  } catch (rollbackErr) {
    logError('[Rollback] Payment rollback failed', rollbackErr, { requestId });
  }

  // Limpar ficheiros órfãos do storage
  try {
    const { data: sr } = await supabase
      .from('song_requests')
      .select('voice_sample_url')
      .eq('id', requestId)
      .maybeSingle();
    await rollbackStorageForSong(supabase, songId, requestId, sr?.voice_sample_url);
  } catch {}

  // Notificar admin (com contexto completo para ação)
  try {
    const adminUrl = `${getAppUrl()}/admin`;
    await sendAdminNotification(
      'Falha na geração Suno — Pedido ' + requestId.slice(0, 8),
      'Ocorreu um erro ao gerar a música no Suno.\n\n' +
        'Pedido: ' + requestId + '\n' +
        'Música (songId): ' + songId + '\n' +
        'Cliente: ' + (recipientName || '—') + (userEmail ? ` <${userEmail}>` : '') + '\n' +
        'Pagamentos revertidos: ' + revertedCount + '\n' +
        'Erro: ' + (err instanceof Error ? err.message : String(err ?? '')) + '\n\n' +
        'Admin: ' + adminUrl
    );
  } catch (emailErr) {
    logError('[Rollback] Admin notification failed', emailErr, { requestId });
  }

  // Notificar cliente
  try {
    if (userEmail) {
      await sendWorkflowFailedEmail(userEmail, recipientName || 'Cliente');
    }
  } catch (emailErr) {
    logError('[Rollback] Client notification failed', emailErr, { requestId });
  }
}

function normalizePhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function resolveVoiceSampleUrl(_supabase: NonNullable<ReturnType<typeof getAdminSupabase>>, urlOrPath: string): Promise<string> {
  if (urlOrPath.startsWith('http')) return urlOrPath;
  // É um path de storage — gerar signed URL para download (via storage.ts → R2 ou Supabase)
  const signedUrl = await createSignedStorageUrl('voice-samples', urlOrPath, 604800);
  if (!signedUrl) throw new Error('Não foi possível gerar URL para a amostra de voz.');
  return signedUrl;
}

export async function processSunoVoice(
  requestId: string,
  songId: string,
  voiceSampleUrl: string
): Promise<string | null> {
  const supabase = getAdminSupabase();
  if (!supabase) return null;

  try {
    const { data: voiceRequestData, error: voiceReqError } = await supabase
      .from('song_requests')
      .select('language, elevenlabs_voice_id')
      .eq('id', requestId)
      .single();
    if (voiceReqError || !voiceRequestData) {
      throw new Error(`Failed to fetch song request: ${voiceReqError?.message}`);
    }

    logInfo(`[Suno Voice] Starting voice cloning`, { requestId });
    setProgress(requestId, { status: 'voice_processing', progress: 10, message: 'A iniciar clonagem de voz Suno Voice...' });

    // Resolve o URL (pode ser path ou URL completa)
    const resolvedUrl = await resolveVoiceSampleUrl(supabase, voiceSampleUrl);

    // Download voice sample
    const tempSamplePath = path.join(os.tmpdir(), `${requestId}_sample_raw`);
    await downloadFile(resolvedUrl, tempSamplePath);

    // Converter para WAF real com FFmpeg (o browser grava em WebM/Opus, mas a API Suno espera WAV genuíno)
    const tempWavPath = path.join(os.tmpdir(), `${requestId}_converted.wav`);
    await convertToWav(tempSamplePath, tempWavPath);
    try { fs.unlinkSync(tempSamplePath); } catch {}

    // Upload para storage (R2/Supabase) para a API Suno Voice conseguir aceder
    const publicFilename = `sunovoice/${requestId}_${Date.now()}.wav`;
    const publicVoiceUrl = await uploadFileToStorage('preview', publicFilename, tempWavPath, 'audio/wav');

    try { fs.unlinkSync(tempWavPath); } catch {}

    if (!publicVoiceUrl) {
      throw new Error('Failed to upload voice sample to public URL');
    }

    logInfo(`[Suno Voice] Voice sample uploaded`, { requestId, publicVoiceUrl });
    setProgress(requestId, { status: 'voice_processing', progress: 25, message: 'A preparar validação da voz...' });

    // Se o cliente já leu a frase de validação no wizard (validation_task_id),
    // reutilizar essa task — a amostra aqui é a gravação da frase lida por ele.
    let validationTaskId: string | null = null;
    let storedPhrase: string | null = null;
    try {
      const storedVoice = typeof voiceRequestData.elevenlabs_voice_id === 'string'
        ? JSON.parse(voiceRequestData.elevenlabs_voice_id)
        : null;
      if (storedVoice && typeof storedVoice.validation_task_id === 'string' && storedVoice.validation_task_id) {
        validationTaskId = storedVoice.validation_task_id;
        storedPhrase = typeof storedVoice.phrase === 'string' ? storedVoice.phrase : null;
      }
    } catch {
      // JSON inválido — segue para o caminho de geração da frase
    }

    if (validationTaskId) {
      // A task foi criada no wizard (frase que o cliente leu/gravou). Antes de a
      // reutilizar, confirma que ainda é válida — se a API a tiver expirado, o
      // createCustomVoice falharia; recupera gerando uma nova frase a partir da
      // gravação do cliente (pode ser rejeitada se a gravação não contiver a
      // frase nova, mas é a única via automática e degrada com elegância).
      try {
        const phraseCheck = await waitForValidationPhrase(validationTaskId, 5);
        if (
          storedPhrase &&
          phraseCheck.validateInfo &&
          normalizePhrase(phraseCheck.validateInfo) !== normalizePhrase(storedPhrase)
        ) {
          logWarn(`[Suno Voice] Task de validação não corresponde à frase gravada pelo cliente`, {
            taskId: validationTaskId,
            requestId,
          });
          throw new Error('task_phrase_mismatch');
        }
      } catch (verifyErr) {
        logWarn(`[Suno Voice] Task de validação expirada/inválida — a tentar nova frase`, {
          taskId: validationTaskId,
          requestId,
          error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
        });
        validationTaskId = null;
      }
    }

    if (validationTaskId) {
      logInfo(`[Suno Voice] Reutilizando frase de validação do wizard`, { taskId: validationTaskId, requestId });
      setProgress(requestId, { status: 'voice_processing', progress: 40, message: 'Frase de validação registada. A criar voz personalizada...' });
    } else {
      // Fallback legado + recuperação de task expirada: gera a frase a partir da
      // amostra. Nota: se a task expirou, o cliente gravou a frase antiga e a API
      // pode rejeitar a nova ("didn't sound like you said the phrase").
      setProgress(requestId, { status: 'voice_processing', progress: 25, message: 'A gerar frase de validação...' });

      const langMap: Record<string, string> = {
        'inglês': 'en',
        'português': 'pt',
        'kikongo': 'kg',
        'lingala': 'ln',
        'kimbundu': 'pt',
        'umbundu': 'pt',
      };
      const voiceLang = langMap[voiceRequestData.language] || 'pt';
      const validationResult = await generateValidationPhrase(publicVoiceUrl, 0, 30, voiceLang);
      logInfo(`[Suno Voice] Validation task created`, { taskId: validationResult.taskId, requestId });

      setProgress(requestId, { status: 'voice_processing', progress: 40, message: 'A aguardar frase de validação...' });

      // Step 2: Wait for validation phrase
      const phraseResult = await waitForValidationPhrase(validationResult.taskId);
      logInfo(`[Suno Voice] Validation phrase received`, { requestId });
      validationTaskId = validationResult.taskId;
    }

    setProgress(requestId, { status: 'voice_processing', progress: 55, message: 'A criar voz personalizada...' });

    // Step 3: Create custom voice using the phrase recording (verifyUrl)
    const voiceResult = await createCustomVoice(
      validationTaskId,
      publicVoiceUrl,
      `SeuBeat_${requestId}`,
      'Custom voice from SeuBeat',
      '',
      'professional'
    );
    logInfo(`[Suno Voice] Voice creation task`, { taskId: voiceResult.taskId, requestId });

    setProgress(requestId, { status: 'voice_processing', progress: 70, message: 'A aguardar criação da voz (pode levar alguns minutos)...' });

    // Step 4: Wait for voice ID
    const recordResult = await waitForVoiceId(voiceResult.taskId);
    logInfo(`[Suno Voice] Voice created successfully`, { voiceId: recordResult.voiceId, requestId });

    // Step 5: Check availability
    const checkResult = await checkVoiceAvailability(voiceResult.taskId);
    if (!checkResult.isAvailable) {
      logWarn(`[Suno Voice] Voice not yet available, continuing`, { voiceId: recordResult.voiceId, requestId });
    }

    // Save voice metadata (JSON com voiceId + taskId + timestamp para controlo de expiração)
    const voiceMeta: SavedVoiceMeta = { id: recordResult.voiceId || 'unknown', taskId: voiceResult.taskId, ts: Date.now() };
    const { error: voiceUpdateErr } = await supabase
      .from('song_requests')
      .update({ elevenlabs_voice_id: JSON.stringify(voiceMeta) })
      .eq('id', requestId);
    if (voiceUpdateErr) logWarn('[Suno Voice] Failed to save voice metadata', { error: voiceUpdateErr, requestId });

    setProgress(requestId, { status: 'music_processing', progress: 80, message: 'Voz clonada com sucesso! A gerar música...' });

    return recordResult.voiceId;
  } catch (err: unknown) {
    logError('[Suno Voice] Error', err instanceof Error ? err : new Error(String(err)), { requestId });
    setProgress(requestId, { status: 'music_processing', progress: 30, message: 'Voz não disponível, a gerar música sem voz personalizada.' });
    const supabase2 = getAdminSupabase();
    if (supabase2) {
      await supabase2.from('song_requests').update({
        elevenlabs_voice_id: '{"failed":true}',
        error_details: {
          stage: 'voice_cloning',
          message: err instanceof Error ? err.message : String(err ?? ''),
          at: new Date().toISOString()
        }
      }).eq('id', requestId).maybeSingle();
    }
    return null;
  }
}
