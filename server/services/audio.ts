import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

let FFMPEG_AVAILABLE = true;
let FFPROBE_AVAILABLE = true;

if (ffmpegInstaller) {
  try {
    ffmpeg.setFfmpegPath(ffmpegInstaller);
    execFileSync(ffmpegInstaller, ['-version'], { stdio: 'pipe', timeout: 10000 });
    console.log('✅ FFmpeg disponível e funcional');
  } catch (err: unknown) {
    console.warn(`⚠️ FFmpeg não disponível, preview de 30s ficará indisponível: ${err instanceof Error ? err.message : String(err)}`);
    FFMPEG_AVAILABLE = false;
  }
} else {
  console.warn('⚠️ ffmpeg-static não instalado, preview de 30s ficará indisponível');
  FFMPEG_AVAILABLE = false;
}

// Verificar ffprobe disponibilidade
if (ffmpegInstaller) {
  const ffprobePath = ffmpegInstaller.replace('ffmpeg', 'ffprobe');
  try {
    execFileSync(ffprobePath, ['-version'], { stdio: 'pipe', timeout: 5000 });
    console.log('✅ FFprobe disponível e funcional');
  } catch {
    console.warn('⚠️ FFprobe não disponível, duração de áudio não será detectada');
    FFPROBE_AVAILABLE = false;
  }
} else {
  FFPROBE_AVAILABLE = false;
}

const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS || 300000);

// Obter duração do áudio em segundos usando ffprobe
export async function getAudioDuration(inputPath: string): Promise<number> {
  if (!FFPROBE_AVAILABLE) {
    return 0;
  }

  const ffprobePath = (ffmpegInstaller || '').replace('ffmpeg', 'ffprobe');
  
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const ffprobe = spawn(ffprobePath, [
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
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Falha ao descarregar arquivo: ${res.statusText}`);
    if (!res.body) throw new Error('Resposta de download sem corpo.');
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(destPath));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Download timeout after ${DOWNLOAD_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Utilitário para cortar os primeiros 30s de preview
export function createPreviewAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_AVAILABLE) {
      reject(new Error('FFmpeg indisponível para gerar preview de 30s.'));
      return;
    }

    ffmpeg(inputPath)
      .setStartTime(0)
      .setDuration(30)
      .audioFilters('afade=t=in:ss=0:d=3,afade=t=out:st=27:d=3')
      .output(outputPath)
      .on('end', () => {
        console.log('✅ Preview de 30s gerado com sucesso!');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Erro no FFmpeg ao criar preview:', err);
        reject(err);
      })
      .run();
  });
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

  // Calcular timestamp positivo para fade-out (4s antes do fim)
  const fadeOutStart = duration > 0 ? Math.max(0, duration - 4) : 0;
  
  // Se não conseguimos detectar duração, aplicar fade-in + fade-out fixo no final estimado
  // Usar filtro com timestamps positivos apenas
  const fadeOutFilter = duration > 0 && duration >= 8 
    ? `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=4`
    : 'afade=t=out:st=30:d=4'; // fallback para ~34s se duração desconhecida
  
  const filter = `afade=t=in:ss=0:d=3,${fadeOutFilter}`;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filter)
      .output(outputPath)
      .on('end', () => {
        console.log(`✅ Fades aplicados com sucesso! (duração: ${duration.toFixed(1)}s, fade-out em ${fadeOutStart.toFixed(1)}s)`);
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Erro no FFmpeg ao aplicar fades:', err);
        reject(err);
      })
      .run();
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
