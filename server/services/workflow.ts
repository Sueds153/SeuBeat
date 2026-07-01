import path from 'path';
import fs from 'fs';
import os from 'os';
import { getAdminSupabase, uploadToSupabase } from './supabase';
import { downloadFile, createPreviewAudio } from './audio';
import { querySunoTask, generateFullSong } from './suno';
import { generateValidationPhrase, waitForValidationPhrase, createCustomVoice, waitForVoiceId, checkVoiceAvailability } from './suno-voice';
import { sendPersonalizedEmail } from './email';
import { getAudioFileInfo } from '../utils/helpers';
import { logInfo, logWarn, logError } from '../utils/logger';
import { RequestProgress } from './types';

const PROGRESS_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

function adminErrorDetails(stage: string, err: any) {
  return {
    stage,
    message: err?.message || String(err),
    name: err?.name || 'Error',
    at: new Date().toISOString()
  };
}

export async function updateRequestStatus(requestId: string, status: string, err?: any) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  const payload: Record<string, any> = { status };
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

async function persistGeneratedSunoAudio(songId: string, taskId: string, audioUrl: string) {
  const fileInfo = getAudioFileInfo(audioUrl);
  const tempSunoPath = path.join(os.tmpdir(), `${songId}_suno.${fileInfo.ext}`);
  const tempPreviewPath = path.join(os.tmpdir(), `${songId}_preview.mp3`);

  try {
    await downloadFile(audioUrl, tempSunoPath);

    const originalFilename = `songs/${songId}_original.${fileInfo.ext}`;
    const fullAudioUrl = await uploadToSupabase('full-audio', originalFilename, tempSunoPath, fileInfo.mimeType);

    await createPreviewAudio(tempSunoPath, tempPreviewPath);

    const previewFilename = `previews/${songId}_preview.mp3`;
    const publicPreviewUrl = await uploadToSupabase('preview', previewFilename, tempPreviewPath, 'audio/mpeg');

    return { taskId, fullAudioUrl, publicPreviewUrl };
  } finally {
    try { fs.unlinkSync(tempSunoPath); } catch {}
    try { fs.unlinkSync(tempPreviewPath); } catch {}
  }
}

export async function completeSunoWorkflowFromAudio(
  requestId: string,
  songId: string,
  taskId: string,
  audioUrl: string
) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  setProgress(requestId, { status: 'generating', progress: 60, message: 'Geração concluída no Suno. A descarregar ficheiro...' });
  setProgress(requestId, { status: 'generating', progress: 75, message: 'A guardar áudio original no Supabase Storage...' });

  const { fullAudioUrl, publicPreviewUrl } = await persistGeneratedSunoAudio(songId, taskId, audioUrl);
  logInfo(`[Background Suno] Saved original to full-audio`, { songId, taskId });

  // Reusamos as colunas mureka_task_id e mureka_status no banco de dados para evitar migrations complexas
  const { error: songUpdateError } = await supabase
    .from('songs')
    .update({
      audio_url: fullAudioUrl,
      full_song_url: fullAudioUrl,
      preview_url: publicPreviewUrl,
      mureka_task_id: taskId,
      mureka_status: 'completed'
    })
    .eq('id', songId);
  if (songUpdateError) throw songUpdateError;

  await updateRequestStatus(requestId, 'music_ready');
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
  } catch (err: any) {
    logError('[Background Suno] Error while resuming task', err, { requestId, songId, taskId });
    setProgress(requestId, { status: 'failed', progress: 100, message: 'Erro na consulta Suno', error: err.message || String(err) });
    await updateRequestStatus(requestId, 'failed', err);
    await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', songId);
  }
}

export async function runBackgroundSunoWorkflow(
  requestId: string,
  songId: string,
  musicStyle: string,
  songTitle: string,
  lyrics: string[]
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
      } catch (voiceErr: any) {
        logError(`[Background Suno] Suno Voice failed, generating without voice`, voiceErr, { requestId });
        await supabase
          .from('song_requests')
          .update({
            error_details: JSON.stringify({
              stage: 'voice_cloning',
              message: voiceErr?.message || String(voiceErr),
              at: new Date().toISOString()
            })
          })
          .eq('id', requestId);
      }

      setProgress(requestId, { status: 'music_processing', progress: 30, message: 'Voz processada. A gerar música...' });
    }

    setProgress(requestId, { status: 'generating', progress: 30, message: 'A submeter letra ao Suno AI...' });

    const { taskId, audioUrl: finalAudioUrl } = await generateFullSong(lyrics, musicStyle, songTitle, personaId);

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

    const { fullAudioUrl, publicPreviewUrl } = await persistGeneratedSunoAudio(songId, taskId, finalAudioUrl);
    logInfo(`[Background Suno] Audio saved to storage`, { songId, taskId });

    const { error: completedSongUpdateError } = await supabase
      .from('songs')
      .update({
        audio_url: fullAudioUrl,
        full_song_url: fullAudioUrl,
        preview_url: publicPreviewUrl,
        mureka_task_id: taskId,
        mureka_status: 'completed'
      })
      .eq('id', songId);
    if (completedSongUpdateError) throw completedSongUpdateError;

    // Entregar a música (com ou sem voz personalizada)
    logInfo(`[Background Suno] Delivering song`, { requestId });
    const userEmail = requestData.email || requestData.users?.email;
    const letterText = requestData.songs?.[0]?.letter_text || 'Dedicatória.';

    await supabase
      .from('song_requests')
      .update({
        final_mixed_audio_url: fullAudioUrl,
        status: 'delivered',
      })
      .eq('id', requestId);

    setProgress(requestId, { status: 'completed', progress: 100, message: 'Música gerada e entregue com sucesso!' });

    if (userEmail) {
      const slug = (requestData.recipient_name || 'especial')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const personalizedUrl = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${songId}`;

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
    logInfo(`[Background Suno] Workflow completed`, { requestId });
  } catch (err: any) {
    logError('[Background Suno] Error in background workflow', err, { requestId, songId });
    setProgress(requestId, { status: 'failed', progress: 100, message: 'Erro na geração Suno', error: err.message || String(err) });
    await updateRequestStatus(requestId, 'failed', err);
    await supabase
      .from('songs')
      .update({ mureka_status: 'failed' })
      .eq('id', songId);
  }
}

async function resolveVoiceSampleUrl(supabase: NonNullable<ReturnType<typeof getAdminSupabase>>, urlOrPath: string): Promise<string> {
  if (urlOrPath.startsWith('http')) return urlOrPath;
  // É um path de storage — gerar signed URL para download
  const { data } = await supabase.storage.from('voice-samples').createSignedUrl(urlOrPath, 604800);
  if (!data?.signedUrl) throw new Error('Não foi possível gerar URL para a amostra de voz.');
  return data.signedUrl;
}

export async function processSunoVoice(
  requestId: string,
  songId: string,
  voiceSampleUrl: string
): Promise<string | null> {
  const supabase = getAdminSupabase();
  if (!supabase) return null;

  try {
    logInfo(`[Suno Voice] Starting voice cloning`, { requestId });
    setProgress(requestId, { status: 'voice_processing', progress: 10, message: 'A iniciar clonagem de voz Suno Voice...' });

    // Resolve o URL (pode ser path ou URL completa)
    const resolvedUrl = await resolveVoiceSampleUrl(supabase, voiceSampleUrl);

    // Download voice sample
    const tempSamplePath = path.join(os.tmpdir(), `${requestId}_sample`);
    await downloadFile(resolvedUrl, tempSamplePath);

    // Check file extension or default to .wav
    const cleanUrl = resolvedUrl.split('?')[0];
    const ext = path.extname(cleanUrl) || '.wav';
    const tempFile = `${tempSamplePath}${ext}`;
    fs.renameSync(tempSamplePath, tempFile);

    // Upload para bucket público (preview) para a API Suno Voice conseguir aceder
    const publicFilename = `sunovoice/${requestId}_${Date.now()}${ext}`;
    const publicVoiceUrl = await uploadToSupabase('preview', publicFilename, tempFile, 'audio/wav');

    try { fs.unlinkSync(tempFile); } catch {}

    if (!publicVoiceUrl) {
      throw new Error('Failed to upload voice sample to public URL');
    }

    logInfo(`[Suno Voice] Voice sample uploaded`, { requestId, publicVoiceUrl });
    setProgress(requestId, { status: 'voice_processing', progress: 25, message: 'A gerar frase de validação...' });

    const voiceLang = requestData.language === 'inglês' ? 'en' : 'pt';
    const validationResult = await generateValidationPhrase(publicVoiceUrl, 0, 30, voiceLang);
    logInfo(`[Suno Voice] Validation task created`, { taskId: validationResult.taskId, requestId });

    setProgress(requestId, { status: 'voice_processing', progress: 40, message: 'A aguardar frase de validação...' });

    // Step 2: Wait for validation phrase
    const phraseResult = await waitForValidationPhrase(validationResult.taskId);
    logInfo(`[Suno Voice] Validation phrase received`, { requestId });

    setProgress(requestId, { status: 'voice_processing', progress: 55, message: 'A criar voz personalizada...' });

    // Step 3: Create custom voice using the same audio as verification
    const voiceResult = await createCustomVoice(
      validationResult.taskId,
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
  } catch (err: any) {
    logError('[Suno Voice] Error', err, { requestId });
    setProgress(requestId, { status: 'music_processing', progress: 30, message: 'Voz não disponível, a gerar música sem voz personalizada.' });
    const supabase2 = getAdminSupabase();
    if (supabase2) {
      await supabase2.from('song_requests').update({ elevenlabs_voice_id: '{"failed":true}' }).eq('id', requestId).maybeSingle();
    }
    return null;
  }
}
