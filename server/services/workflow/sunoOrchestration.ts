import { getAdminSupabase } from '../supabase';
import { querySunoTask, startSunoMusic, pollSunoTask } from '../suno';
import { sendPersonalizedEmail, sendConfirmationEmail } from '../email';
import { sendDeliveryWhatsApp, sendPaymentApprovedWhatsApp } from '../whatsapp';
import { getAppUrl } from '../../utils/helpers';
import { logInfo, logWarn, logError } from '../../utils/logger';
import { setProgress, withTimeout } from './progress';
import { updateRequestStatus } from './statusPersistence';
import { persistGeneratedSunoAudio, PERSIST_AUDIO_TIMEOUT_MS, PERSIST_LIGHT_TIMEOUT_MS } from './audioPersistence';
import { rollbackSunoWorkflow } from './rollback';
import { processSunoVoice, parseSavedVoice, isVoiceExpired } from './voiceCloning';

async function completeSunoWorkflowFromAudio(
  requestId: string,
  songId: string,
  taskId: string,
  audioUrl: string,
  audioUrlV2: string | null | undefined,
  opts?: { skipProcessing?: boolean; hintDuration?: number | null }
) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  setProgress(requestId, { status: 'generating', progress: 60, message: 'Geração concluída no Suno. A descarregar ficheiro...' });
  setProgress(requestId, { status: 'generating', progress: 75, message: 'A guardar áudio original no Supabase Storage...' });

  const persistTimeout = opts?.skipProcessing ? PERSIST_LIGHT_TIMEOUT_MS : PERSIST_AUDIO_TIMEOUT_MS;
  const { fullAudioUrl, publicPreviewUrl, duration } = await withTimeout(
    persistGeneratedSunoAudio(songId, taskId, audioUrl, opts),
    persistTimeout,
    `persistGeneratedSunoAudio(${songId})`
  );
  logInfo(`[Background Suno] Saved original to full-audio`, { songId, taskId, skipProcessing: !!opts?.skipProcessing });

  let fullAudioUrlV2: string | null = null;
  if (audioUrlV2) {
    try {
      logInfo(`[Background Suno] Processing v2 audio`, { songId, taskId });
      const v2Result = await withTimeout(
        persistGeneratedSunoAudio(`${songId}_v2`, taskId, audioUrlV2, opts),
        persistTimeout,
        `persistGeneratedSunoAudio(${songId}_v2)`
      );
      fullAudioUrlV2 = v2Result.fullAudioUrl;
      logInfo(`[Background Suno] v2 audio saved`, { songId, fullAudioUrlV2 });
    } catch (v2Err) {
      logWarn(`[Background Suno] v2 audio processing failed, continuing with v1 only`, { songId, error: v2Err instanceof Error ? v2Err.message : String(v2Err) });
    }
  }

  const songUpdate: Record<string, unknown> = {
    audio_url: fullAudioUrl,
    full_song_url: fullAudioUrl,
    preview_url: null,
    duration,
    mureka_task_id: taskId,
    mureka_status: 'completed'
  };
  if (fullAudioUrlV2) {
    songUpdate.audio_url_v2 = fullAudioUrlV2;
    songUpdate.full_song_url_v2 = fullAudioUrlV2;
  }
  const { error: songUpdateError } = await supabase
    .from('songs')
    .update(songUpdate)
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
  const nextStatus = approvedPayment ? (isStandard ? 'approved' : 'delivered') : 'music_ready';

  await supabase
    .from('song_requests')
    .update({
      status: nextStatus,
      deliver_at: deliverAt,
      final_mixed_audio_url: fullAudioUrl,
      ...(nextStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
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

    const { data: songData } = await supabase
      .from('songs')
      .select('regeneration_count, duration')
      .eq('id', songId)
      .maybeSingle();
    const regenCount = songData?.regeneration_count ?? 0;
    const dbDuration = songData?.duration ?? null;
    const skipProcessing = regenCount > 0;
    if (skipProcessing) {
      logInfo(`[Background Suno] Recovery path: skipping fades/preview to avoid OOM`, { songId, regenCount, mem: `${(process.memoryUsage().rss / 1048576).toFixed(0)}MB` });
    }

    await updateRequestStatus(requestId, 'music_processing');
    const { error: resumeSongError } = await supabase.from('songs').update({ mureka_status: 'processing' }).eq('id', songId);
    if (resumeSongError) throw resumeSongError;

    for (let attempt = 0; attempt < 60; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 10000));
      const { audioUrl, audioUrlV2 } = await querySunoTask(taskId);
      logInfo(`[Background Suno] Resume poll`, { attempt: attempt + 1, status, hasAudio: !!audioUrl, hasV2: !!audioUrlV2, requestId });

      if (audioUrl) {
        await completeSunoWorkflowFromAudio(requestId, songId, taskId, audioUrl, audioUrlV2, {
          skipProcessing,
          hintDuration: dbDuration,
        });
        logInfo(`[Background Suno] Existing task completed`, { requestId, skipProcessing });

        try {
          const { data: sr } = await supabase
            .from('song_requests')
            .select('status, email, phone, recipient_name, users!inner(email, name), songs!inner(id, letter_text, title)')
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
                if (sr.phone) {
                  sendPaymentApprovedWhatsApp({
                    requestId,
                    phone: sr.phone,
                    recipientName: sr.recipient_name,
                  }).catch(err => logError('[Resume] Payment approved WhatsApp failed', err, { requestId }));
                }
              } else {
                sendPersonalizedEmail(userEmail, sr.recipient_name, url, song?.letter_text || 'Dedicatória.')
                  .catch(err => logError('[Resume] Delivery email failed', err, { requestId }));
                if (sr.phone) {
                  sendDeliveryWhatsApp({
                    requestId,
                    phone: sr.phone,
                    recipientName: sr.recipient_name,
                    songUrl: url,
                  }).catch(err => logError('[Resume] Delivery WhatsApp failed', err, { requestId }));
                }
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

    logWarn('[Background Suno] Resume: 60 polls sem audio — a limpar task_id para scheduler criar nova task', { requestId, songId, taskId });
    setProgress(requestId, {
      status: 'processing',
      progress: 85,
      message: 'A verificacao Suno esgotou. Uma nova musica sera gerada automaticamente.'
    });
    const { data: pollSong } = await supabase
      .from('songs')
      .select('mureka_task_id')
      .eq('id', songId)
      .maybeSingle();
    if (pollSong?.mureka_task_id === taskId) {
      await supabase.from('songs').update({ mureka_task_id: null }).eq('id', songId);
    }
    return;
  } catch (err: unknown) {
    logError('[Background Suno] Error while resuming task', err instanceof Error ? err : new Error(String(err)), { requestId, songId, taskId });
    setProgress(requestId, { status: 'failed', progress: 100, message: 'Erro na consulta Suno', error: err instanceof Error ? err.message : String(err) });
    await updateRequestStatus(requestId, 'failed', err instanceof Error ? err : new Error(String(err)));
    const resumeClearUpdate: Record<string, unknown> = { mureka_status: 'failed' };
    const { data: resumeSong } = await supabase
      .from('songs')
      .select('mureka_task_id')
      .eq('id', songId)
      .maybeSingle();
    if (resumeSong && resumeSong.mureka_task_id === taskId) {
      resumeClearUpdate.mureka_task_id = null;
    } else if (resumeSong?.mureka_task_id) {
      logInfo('[Resume] Preserving task_id from concurrent workflow', { songId, currentTaskId: resumeSong.mureka_task_id, ourTaskId: taskId });
    }
    await supabase.from('songs').update(resumeClearUpdate).eq('id', songId);

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

  let ourTaskId: string | null = null;

  try {
    logInfo(`[Background Suno] Starting workflow`, { requestId, songId });
    setProgress(requestId, { status: 'generating', progress: 10, message: 'A iniciar fluxo de geração Suno...' });

    await updateRequestStatus(requestId, 'music_processing');

    const { error: initialSongUpdateError } = await supabase
      .from('songs')
      .update({ mureka_status: 'generating' })
      .eq('id', songId);
    if (initialSongUpdateError) throw initialSongUpdateError;

    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(*), users(*)')
      .eq('id', requestId)
      .single();

    if (reqError || !requestData) {
      throw new Error(`Failed to fetch song request: ${reqError?.message}`);
    }

    const hasVoiceSample = !!requestData.voice_sample_url;

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

    const { taskId } = await startSunoMusic(lyrics, musicStyle, songTitle, personaId, extraParams);

    const { error: taskUpdateError } = await supabase
      .from('songs')
      .update({
        mureka_task_id: taskId,
        mureka_status: 'processing'
      })
      .eq('id', songId);
    if (taskUpdateError) throw taskUpdateError;
    ourTaskId = taskId;
    logInfo(`[Background Suno] Task ID saved to DB before polling`, { taskId, songId, requestId });

    const pollResult = await pollSunoTask(taskId, null, 'Suno');
    const finalAudioUrl = pollResult.audioUrl;
    const finalAudioUrlV2 = pollResult.audioUrlV2;

    if (!finalAudioUrl) {
      logWarn(`[Background Suno] Task sem áudio após polling — a marcar como failed`, { taskId, requestId });
      await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', songId);
      setProgress(requestId, {
        status: 'failed',
        progress: 100,
        message: 'Suno não devolveu áudio. A recriar automaticamente...'
      });
      return;
    }

    logInfo(`[Background Suno] Generated successfully`, { taskId, requestId });
    setProgress(requestId, { status: 'generating', progress: 60, message: 'Geração concluída no Suno. A descarregar ficheiro...' });
    setProgress(requestId, { status: 'generating', progress: 75, message: 'A guardar áudio original no Supabase Storage...' });

    const { fullAudioUrl, publicPreviewUrl, duration } = await persistGeneratedSunoAudio(songId, taskId, finalAudioUrl);
    logInfo(`[Background Suno] Audio saved to storage`, { songId, taskId });

    let fullAudioUrlV2: string | null = null;
    if (finalAudioUrlV2) {
      try {
        logInfo(`[Background Suno] Processing v2 audio`, { songId, taskId });
        const v2Result = await persistGeneratedSunoAudio(`${songId}_v2`, taskId, finalAudioUrlV2);
        fullAudioUrlV2 = v2Result.fullAudioUrl;
        logInfo(`[Background Suno] v2 audio saved`, { songId, fullAudioUrlV2 });
      } catch (v2Err) {
        logWarn(`[Background Suno] v2 audio processing failed, continuing with v1 only`, { songId, error: v2Err instanceof Error ? v2Err.message : String(v2Err) });
      }
    }

    const songUpdate: Record<string, unknown> = {
      audio_url: fullAudioUrl,
      full_song_url: fullAudioUrl,
      preview_url: null,
      duration,
      mureka_task_id: taskId,
      mureka_status: 'completed'
    };
    if (fullAudioUrlV2) {
      songUpdate.audio_url_v2 = fullAudioUrlV2;
      songUpdate.full_song_url_v2 = fullAudioUrlV2;
    }
    const { error: completedSongUpdateError } = await supabase
      .from('songs')
      .update(songUpdate)
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
        ...(nextStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
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
        if (requestData.phone) {
          sendPaymentApprovedWhatsApp({
            requestId,
            phone: requestData.phone,
            recipientName: requestData.recipient_name,
          }).catch((waErr) => {
            logError('[Background Suno] Payment approved WhatsApp failed (Standard)', waErr, { requestId });
          });
        }
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
        if (requestData.phone) {
          sendDeliveryWhatsApp({
            requestId,
            phone: requestData.phone,
            recipientName: requestData.recipient_name,
            songUrl: personalizedUrl,
          }).catch((waErr) => {
            logError('[Background Suno] Delivery WhatsApp failed', waErr, { requestId });
          });
        }
      }
    }
    logInfo(`[Background Suno] Workflow completed`, { requestId, nextStatus });
  } catch (err: unknown) {
    logError('[Background Suno] Error in background workflow', err instanceof Error ? err : new Error(String(err)), { requestId, songId });
    setProgress(requestId, { status: 'failed', progress: 100, message: 'Erro na geração Suno', error: err instanceof Error ? err.message : String(err) });
    await updateRequestStatus(requestId, 'failed', err instanceof Error ? err : new Error(String(err)));

    const clearUpdate: Record<string, unknown> = { mureka_status: 'failed' };
    if (ourTaskId) {
      const { data: currentSong } = await supabase
        .from('songs')
        .select('mureka_task_id')
        .eq('id', songId)
        .maybeSingle();
      if (currentSong && currentSong.mureka_task_id === ourTaskId) {
        clearUpdate.mureka_task_id = null;
      } else if (currentSong?.mureka_task_id) {
        logInfo('[Background Suno] Preserving task_id from concurrent workflow', { songId, currentTaskId: currentSong.mureka_task_id, ourTaskId });
      }
    } else {
      clearUpdate.mureka_task_id = null;
    }
    await supabase.from('songs').update(clearUpdate).eq('id', songId);

    await rollbackSunoWorkflow(supabase, requestId, songId, err);
  }
}
