import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

let FFMPEG_AVAILABLE = true;

if (ffmpegInstaller) {
  try {
    ffmpeg.setFfmpegPath(ffmpegInstaller);
    execFileSync(ffmpegInstaller, ['-version'], { stdio: 'pipe', timeout: 10000 });
    console.log('✅ FFmpeg disponível e funcional');
  } catch (err: any) {
    console.warn(`⚠️ FFmpeg não disponível, preview de 30s ficará indisponível: ${err?.message || err}`);
    FFMPEG_AVAILABLE = false;
  }
} else {
  console.warn('⚠️ ffmpeg-static não instalado, preview de 30s ficará indisponível');
  FFMPEG_AVAILABLE = false;
}

const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS || 300000);

// Utilitário para baixar arquivo
export async function downloadFile(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Falha ao descarregar arquivo: ${res.statusText}`);
    if (!res.body) throw new Error('Resposta de download sem corpo.');
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(destPath));
  } catch (err: any) {
    if (err?.name === 'AbortError') {
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
export function applyFades(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_AVAILABLE) {
      reject(new Error('FFmpeg indisponível para aplicar fades.'));
      return;
    }

    ffmpeg(inputPath)
      .audioFilters('afade=t=in:ss=0:d=3,afade=t=out:st=-4:d=4')
      .output(outputPath)
      .on('end', () => {
        console.log('✅ Fades aplicados com sucesso!');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Erro no FFmpeg ao aplicar fades:', err);
        reject(err);
      })
      .run();
  });
}
