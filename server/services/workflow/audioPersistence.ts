import path from 'path';
import fs from 'fs';
import os from 'os';
import { uploadFileToStorage } from '../storage';
import { downloadFile, applyFades, getAudioDuration } from '../audio';
import { getAudioFileInfo } from '../../utils/helpers';
import { logInfo, logWarn } from '../../utils/logger';
import { withTimeout } from './progress';

// Duração mínima (em segundos) para aceitar uma música como válida.
export const MIN_SONG_DURATION_SEC = 30;

// Timeout para upload de áudio ao storage (R2/Supabase)
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Full persist timeout: download + fade + upload
export const PERSIST_AUDIO_TIMEOUT_MS = 5 * 60_000;
// Lightweight persist timeout: only download + upload (no ffmpeg processing)
export const PERSIST_LIGHT_TIMEOUT_MS = 3 * 60_000;

export async function persistGeneratedSunoAudio(
  songId: string,
  taskId: string,
  audioUrl: string,
  opts?: { skipProcessing?: boolean; hintDuration?: number | null }
) {
  const fileInfo = getAudioFileInfo(audioUrl);
  const tempSunoPath = path.join(os.tmpdir(), `${songId}_suno.${fileInfo.ext}`);
  const tempFadedPath = path.join(os.tmpdir(), `${songId}_faded.${fileInfo.ext}`);
  const tempPreviewPath = path.join(os.tmpdir(), `${songId}_preview.mp3`);

  const mem = () => { const m = process.memoryUsage(); return { rss: `${(m.rss / 1048576).toFixed(0)}MB`, heap: `${(m.heapUsed / 1048576).toFixed(0)}MB` }; };

  try {
    logInfo('[Workflow] persistGeneratedSunoAudio start', { songId, taskId, skipProcessing: !!opts?.skipProcessing, mem: mem() });
    await downloadFile(audioUrl, tempSunoPath);
    logInfo('[Workflow] Download complete', { songId, mem: mem() });

    if (opts?.skipProcessing) {
      const uploadSizeMB = (fs.statSync(tempSunoPath).size / (1024 * 1024)).toFixed(1);
      const originalFilename = `songs/${songId}_original.${fileInfo.ext}`;
      logInfo('[Workflow] Lightweight persist: uploading raw audio', { songId, taskId, sizeMB: uploadSizeMB, mem: mem() });
      const fullAudioUrl = await withTimeout(
        uploadFileToStorage('full-audio', originalFilename, tempSunoPath, fileInfo.mimeType),
        UPLOAD_TIMEOUT_MS,
        `uploadFileToStorage(full-audio/${originalFilename})`
      );
      logInfo('[Workflow] Lightweight persist: upload done', { songId, taskId, url: fullAudioUrl, mem: mem() });

      const durationInt = opts.hintDuration != null ? Math.round(opts.hintDuration) : null;
      return { taskId, fullAudioUrl, publicPreviewUrl: null as string | null, duration: durationInt };
    }

    const durationSec = await getAudioDuration(tempSunoPath);
    logInfo('[Workflow] Audio duration check', { songId, taskId, durationSec, mem: mem() });
    if (durationSec > 0 && durationSec < MIN_SONG_DURATION_SEC) {
      throw new Error(
        `Áudio gerado demasiado curto (${durationSec.toFixed(1)}s < ${MIN_SONG_DURATION_SEC}s). O Suno devolveu apenas um clip parcial.`
      );
    }
    const durationInt = durationSec > 0 ? Math.round(durationSec) : null;

    try {
      await applyFades(tempSunoPath, tempFadedPath);
      logInfo('[Workflow] Fades complete, cleaning up original', { songId, mem: mem() });
      try { fs.unlinkSync(tempSunoPath); } catch {}
    } catch (fadeErr) {
      logWarn('[Workflow] Fades falharam, a usar áudio original', fadeErr instanceof Error ? fadeErr : undefined);
      fs.copyFileSync(tempSunoPath, tempFadedPath);
    }

    const fadedFileExists = fs.existsSync(tempFadedPath) && fs.statSync(tempFadedPath).size > 0;
    const uploadSource = fadedFileExists ? tempFadedPath : tempSunoPath;
    const uploadSizeMB = (fs.statSync(uploadSource).size / (1024 * 1024)).toFixed(1);

    const originalFilename = `songs/${songId}_original.${fileInfo.ext}`;
    logInfo('[Workflow] Uploading full audio to storage', { songId, taskId, sizeMB: uploadSizeMB, provider: process.env.STORAGE_PROVIDER || 'r2', mem: mem() });
    const fullAudioUrl = await withTimeout(
      uploadFileToStorage('full-audio', originalFilename, uploadSource, fileInfo.mimeType),
      UPLOAD_TIMEOUT_MS,
      `uploadFileToStorage(full-audio/${originalFilename})`
    );
    logInfo('[Workflow] Full audio uploaded successfully', { songId, taskId, url: fullAudioUrl, mem: mem() });

    if (uploadSource === tempFadedPath) {
      try { fs.unlinkSync(tempFadedPath); } catch {}
    }

    return { taskId, fullAudioUrl, publicPreviewUrl: null as string | null, duration: durationInt };
  } finally {
    try { fs.unlinkSync(tempSunoPath); } catch {}
    try { fs.unlinkSync(tempFadedPath); } catch {}
    try { fs.unlinkSync(tempPreviewPath); } catch {}
  }
}
