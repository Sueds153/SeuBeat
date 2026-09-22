import path from 'path';
import fs from 'fs';
import os from 'os';
import { getAdminSupabase } from '../supabase';
import { createSignedStorageUrl } from '../storage';
import { downloadFile, convertToWav } from '../audio';
import { uploadFileToStorage } from '../storage';
import { generateValidationPhrase, waitForValidationPhrase, createCustomVoice, waitForVoiceId, checkVoiceAvailability } from '../suno-voice';
import { sendAdminNotification } from '../email';
import { logInfo, logWarn, logError } from '../../utils/logger';
import { setProgress } from './progress';

const VOICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SavedVoiceMeta {
  id: string;
  taskId: string;
  ts: number;
}

export function parseSavedVoice(value: unknown): SavedVoiceMeta | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.taskId && parsed.ts) {
      return parsed as SavedVoiceMeta;
    }
  } catch {}
  return null;
}

export function isVoiceExpired(ts: number): boolean {
  return Date.now() - ts > VOICE_MAX_AGE_MS;
}

/** Erros transitórios da API Suno Voice — retry com backoff pode resolver. */
export function isTransientCloneError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Internal Error|Please try again later|not ready after \d+ attempts/i.test(msg);
}

/** Task de validação expirada/não encontrada — precisa de frase nova, não retry cego. */
export function isExpiredPhraseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Verification phrase expired|not found|request a new phrase/i.test(msg);
}

const CLONE_RETRY_DELAY_MS = 5000;

async function delay(ms: number): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

async function resolveVoiceSampleUrl(_supabase: NonNullable<ReturnType<typeof getAdminSupabase>>, urlOrPath: string): Promise<string> {
  if (urlOrPath.startsWith('http')) return urlOrPath;
  const signedUrl = await createSignedStorageUrl('voice-samples', urlOrPath, 604800);
  if (!signedUrl) throw new Error('Não foi possível gerar URL para a amostra de voz.');
  return signedUrl;
}

interface CloneAttemptResult {
  voiceId: string | null;
  taskId: string;
}

/**
 * Tenta criar a voz Suno a partir de um `validationTaskId`.
 * - Retry (1×) para erros transitórios (Internal Error, etc.).
 * - Erros de frase expirada/não encontrada são propagados para o caller decidir
 *   se regenera uma frase nova (não faz retry cego com a mesma task morta).
 */
async function createVoiceFromValidationTask(
  validationTaskId: string,
  publicVoiceUrl: string,
  requestId: string,
  maxAttempts = 2
): Promise<CloneAttemptResult> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const voiceResult = await createCustomVoice(
        validationTaskId,
        publicVoiceUrl,
        `SeuBeat_${requestId}`,
        'Custom voice from SeuBeat',
        '',
        'professional'
      );
      logInfo(`[Suno Voice] Voice creation task`, { taskId: voiceResult.taskId, requestId, attempt });

      const recordResult = await waitForVoiceId(voiceResult.taskId);
      logInfo(`[Suno Voice] Voice created successfully`, { voiceId: recordResult.voiceId, requestId, attempt });

      return { voiceId: recordResult.voiceId, taskId: voiceResult.taskId };
    } catch (err: unknown) {
      lastErr = err;
      if (isExpiredPhraseError(err)) {
        // Frase expirada — retry com a MESMA task nunca resolve; propaga para fallback.
        throw err;
      }
      if (attempt < maxAttempts && isTransientCloneError(err)) {
        logWarn(`[Suno Voice] Transient clone error, retrying`, { attempt, maxAttempts, error: err instanceof Error ? err.message : String(err), requestId });
        await delay(CLONE_RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'clone failed'));
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
      .select('language, elevenlabs_voice_id, created_at, voice_free_sample_url')
      .eq('id', requestId)
      .single();
    if (voiceReqError || !voiceRequestData) {
      throw new Error(`Failed to fetch song request: ${voiceReqError?.message}`);
    }

    logInfo(`[Suno Voice] Starting voice cloning`, { requestId });
    setProgress(requestId, { status: 'voice_processing', progress: 10, message: 'A iniciar clonagem de voz Suno Voice...' });

    const resolvedUrl = await resolveVoiceSampleUrl(supabase, voiceSampleUrl);

    const tempSamplePath = path.join(os.tmpdir(), `${requestId}_sample_raw`);
    await downloadFile(resolvedUrl, tempSamplePath);

    const tempWavPath = path.join(os.tmpdir(), `${requestId}_converted.wav`);
    await convertToWav(tempSamplePath, tempWavPath);
    try { fs.unlinkSync(tempSamplePath); } catch {}

    const publicFilename = `sunovoice/${requestId}_${Date.now()}.wav`;
    const publicVoiceUrl = await uploadFileToStorage('preview', publicFilename, tempWavPath, 'audio/wav');

    try { fs.unlinkSync(tempWavPath); } catch {}

    if (!publicVoiceUrl) {
      throw new Error('Failed to upload voice sample to public URL');
    }

    logInfo(`[Suno Voice] Voice sample uploaded`, { requestId, publicVoiceUrl });
    setProgress(requestId, { status: 'voice_processing', progress: 25, message: 'A preparar validação da voz...' });

    let validationTaskId: string | null = null;
    let storedVoiceValidationTaskId: string | null = null;
    try {
      const storedVoice = typeof voiceRequestData.elevenlabs_voice_id === 'string'
        ? JSON.parse(voiceRequestData.elevenlabs_voice_id)
        : null;
      if (storedVoice && typeof storedVoice.validation_task_id === 'string' && storedVoice.validation_task_id) {
        storedVoiceValidationTaskId = storedVoice.validation_task_id;
        validationTaskId = storedVoiceValidationTaskId;
      }
    } catch {}

    const langMap: Record<string, string> = {
      'inglês': 'en',
      'português': 'pt',
      'kikongo': 'kg',
      'lingala': 'ln',
      'kimbundu': 'pt',
      'umbundu': 'pt',
    };
    const voiceLang = langMap[voiceRequestData.language?.toLowerCase?.() || ''] || 'pt';

    if (validationTaskId) {
      logInfo(`[Suno Voice] Reutilizando frase de validação do wizard`, { taskId: validationTaskId, requestId });
      setProgress(requestId, { status: 'voice_processing', progress: 40, message: 'Frase de validação registada. A criar voz personalizada...' });
    } else {
      setProgress(requestId, { status: 'voice_processing', progress: 25, message: 'A gerar frase de validação...' });

      const validationResult = await generateValidationPhrase(publicVoiceUrl, 0, 30, voiceLang);
      logInfo(`[Suno Voice] Validation task created (fallback)`, { taskId: validationResult.taskId, requestId });

      setProgress(requestId, { status: 'voice_processing', progress: 40, message: 'A aguardar frase de validação...' });

      const phraseResult = await waitForValidationPhrase(validationResult.taskId);
      logInfo(`[Suno Voice] Validation phrase received (fallback)`, { requestId });
      validationTaskId = validationResult.taskId;
    }

    setProgress(requestId, { status: 'voice_processing', progress: 55, message: 'A criar voz personalizada...' });

    let cloneResult: CloneAttemptResult;
    const usedWizardTask = !!storedVoiceValidationTaskId;
    try {
      cloneResult = await createVoiceFromValidationTask(validationTaskId, publicVoiceUrl, requestId);
    } catch (cloneErr: unknown) {
      if (usedWizardTask && isExpiredPhraseError(cloneErr)) {
        // Task do wizard expirou — regenera frase nova a partir da gravação e tenta de novo.
        logWarn(`[Suno Voice] Wizard validation task expired, regenerating fresh phrase`, { error: cloneErr instanceof Error ? cloneErr.message : String(cloneErr), requestId });
        setProgress(requestId, { status: 'voice_processing', progress: 30, message: 'Frase expirada. A gerar nova frase de validação...' });

        const freshValidation = await generateValidationPhrase(publicVoiceUrl, 0, 30, voiceLang);
        await waitForValidationPhrase(freshValidation.taskId);
        validationTaskId = freshValidation.taskId;

        setProgress(requestId, { status: 'voice_processing', progress: 55, message: 'Nova frase pronta. A criar voz personalizada...' });
        cloneResult = await createVoiceFromValidationTask(validationTaskId, publicVoiceUrl, requestId);
      } else {
        throw cloneErr;
      }
    }

    setProgress(requestId, { status: 'voice_processing', progress: 70, message: 'A verificar disponibilidade da voz...' });

    const checkResult = await checkVoiceAvailability(cloneResult.taskId);
    if (!checkResult.isAvailable) {
      logWarn(`[Suno Voice] Voice not yet available, continuing`, { voiceId: cloneResult.voiceId, requestId });
    }

    const voiceMeta: SavedVoiceMeta = { id: cloneResult.voiceId || 'unknown', taskId: cloneResult.taskId, ts: Date.now() };
    const { error: voiceUpdateErr } = await supabase
      .from('song_requests')
      .update({ elevenlabs_voice_id: JSON.stringify(voiceMeta) })
      .eq('id', requestId);
    if (voiceUpdateErr) logWarn('[Suno Voice] Failed to save voice metadata', { error: voiceUpdateErr, requestId });

    setProgress(requestId, { status: 'music_processing', progress: 80, message: 'Voz clonada com sucesso! A gerar música...' });

    return cloneResult.voiceId;
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
    // P2: notificar admin — a falha de clonagem era silenciosa (11/12 Premium falhavam sem alerta).
    const failMsg = err instanceof Error ? err.message : String(err ?? 'unknown');
    sendAdminNotification(
      'Clonagem de voz Premium falhou',
      `Request: ${requestId}\nErro: ${failMsg}\nA música será gerada sem voz personalizada.`
    ).catch(() => {});
    return null;
  }
}
