import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import ffprobeInstaller from 'ffprobe-static';
import fs from 'fs';
import { execFileSync, spawn } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

let FFMPEG_AVAILABLE = true;
let FFPROBE_AVAILABLE = true;
let FFPROBE_PATH: string | null = null;

if (ffmpegInstaller) {
  try {
    ffmpeg.setFfmpegPath(ffmpegInstaller);
    execFileSync(ffmpegInstaller, ['-version'], { stdio: 'pipe', timeout: 10000 });
    console.log('✅ FFmpeg disponível e funcional');
  } catch (err: unknown) {
    console.warn(`⚠️ FFmpeg não disponível, processamento de áudio indisponível: ${err instanceof Error ? err.message : String(err)}`);
    FFMPEG_AVAILABLE = false;
  }
} else {
  console.warn('⚠️ ffmpeg-static não instalado, processamento de áudio indisponível');
  FFMPEG_AVAILABLE = false;
}

// Verificar ffprobe disponibilidade (via ffprobe-static)
if (ffprobeInstaller?.path) {
  try {
    execFileSync(ffprobeInstaller.path, ['-version'], { stdio: 'pipe', timeout: 5000 });
    FFPROBE_PATH = ffprobeInstaller.path;
    console.log('✅ FFprobe disponível e funcional');
  } catch {
    console.warn('⚠️ FFprobe não disponível, duração de áudio será detectada via stderr do ffmpeg');
    FFPROBE_AVAILABLE = false;
  }
} else {
  console.warn('⚠️ ffprobe-static não instalado, duração de áudio será detectada via stderr do ffmpeg');
  FFPROBE_AVAILABLE = false;
}

const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS || 300000);

// Obter duração do áudio em segundos usando apenas o stderr do FFmpeg (não depende de ffprobe)
export function getAudioDurationFfmpeg(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    if (!FFMPEG_AVAILABLE || !ffmpegInstaller) {
      resolve(0);
      return;
    }

    const ffmpegProc = spawn(ffmpegInstaller, ['-i', inputPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    ffmpegProc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    ffmpegProc.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        resolve(hours * 3600 + minutes * 60 + seconds);
      } else {
        resolve(0);
      }
    });

    ffmpegProc.on('error', () => resolve(0));

    // Timeout de segurança
    setTimeout(() => {
      try { ffmpegProc.kill(); } catch {}
      resolve(0);
    }, 15000);
  });
}

// Obter duração do áudio em segundos (ffprobe se disponível, senão FFmpeg)
export async function getAudioDuration(inputPath: string): Promise<number> {
  if (!FFPROBE_AVAILABLE || !FFPROBE_PATH) {
    return getAudioDurationFfmpeg(inputPath);
  }

  return new Promise((resolve) => {
    const ffprobe = spawn(FFPROBE_PATH, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    
    ffprobe.on('close', (code: number) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        resolve(0);
      }
    });
    
    ffprobe.on('error', () => resolve(0));
    
    // Timeout de segurança
    setTimeout(() => {
      ffprobe.kill();
      resolve(0);
    }, 10000);
  });
}

// Utilitário para aplicar apenas fade-in (para áudios curtos)
function applyFadeInOnly(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_AVAILABLE) {
      reject(new Error('FFmpeg indisponível para aplicar fade-in.'));
      return;
    }

    ffmpeg(inputPath)
      .audioFilters('afade=t=in:ss=0:d=3')
      .output(outputPath)
      .on('end', () => {
        console.log('✅ Fade-in aplicado (áudio curto - só fade-in)');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Erro no FFmpeg ao aplicar fade-in:', err);
        reject(err);
      })
      .run();
  });
}

// Utilitário para baixar arquivo
export async function downloadFile(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SeuBeat/1.0 (+https://seubeat.onrender.com)',
        'Accept': 'audio/*, */*',
      }
    });
    if (!res.ok) throw new Error(`Falha ao descarregar arquivo: ${res.statusText}`);
    if (!res.body) throw new Error('Resposta de download sem corpo.');
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(destPath));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Download timeout after ${DOWNLOAD_TIMEOUT_MS}ms: ${url}`);
    }
    throw err instanceof Error ? err : new Error(`Download failed: ${String(err)} — ${url}`);
  } finally {
    clearTimeout(timeout);
  }
}

// Aplica fade-in (3s) e fade-out (4s) no áudio completo
export async function applyFades(inputPath: string, outputPath: string): Promise<void> {
  if (!FFMPEG_AVAILABLE) {
    throw new Error('FFmpeg indisponível para aplicar fades.');
  }

  // Obter duração do áudio para calcular timestamp positivo do fade-out
  const duration = await getAudioDuration(inputPath);
  
  // Se áudio muito curto (< 8s), aplicar só fade-in
  if (duration > 0 && duration < 8) {
    return applyFadeInOnly(inputPath, outputPath);
  }

  // Se duração desconhecida, aplicar apenas fade-in (evita silenciar músicas longas)
  if (duration <= 0) {
    return applyFadeInOnly(inputPath, outputPath);
  }

  // Calcular timestamp positivo para fade-out (4s antes do fim)
  const fadeOutStart = Math.max(0, duration - 4);
  const fadeOutFilter = `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=4`;

  const filter = `afade=t=in:ss=0:d=3,${fadeOutFilter}`;

  return new Promise((resolve, reject) => {
    const FADE_TIMEOUT_MS = 120_000; // 2 minutes max for fade processing
    let settled = false;
    const cmd = ffmpeg(inputPath)
      .audioFilters(filter)
      .output(outputPath)
      .on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(fadeTimer);
        console.log(`✅ Fades aplicados com sucesso! (duração: ${duration.toFixed(1)}s, fade-out em ${fadeOutStart.toFixed(1)}s)`);
        resolve();
      })
      .on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(fadeTimer);
        console.error('❌ Erro no FFmpeg ao aplicar fades:', err);
        reject(err);
      });
    cmd.run();

    const fadeTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { (cmd as any).kill('SIGKILL'); } catch {}
      reject(new Error(`applyFades timeout after ${FADE_TIMEOUT_MS}ms on ${inputPath}`));
    }, FADE_TIMEOUT_MS);
  });
}

export function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_AVAILABLE) {
      reject(new Error('FFmpeg indisponível para converter áudio.'));
      return;
    }

    ffmpeg(inputPath)
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(44100)
      .output(outputPath)
      .on('end', () => {
        console.log('✅ Áudio convertido para WAV com sucesso!');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Erro no FFmpeg ao converter para WAV:', err);
        reject(err);
      })
      .run();
  });
}
