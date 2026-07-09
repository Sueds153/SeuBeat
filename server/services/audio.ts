import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import fs from 'fs';
import { execSync } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

let FFMPEG_AVAILABLE = true;

if (ffmpegInstaller) {
  try {
    ffmpeg.setFfmpegPath(ffmpegInstaller);
    execSync(`"${ffmpegInstaller}" -version`, { stdio: 'pipe', timeout: 5000 });
    console.log('✅ FFmpeg disponível e funcional');
  } catch {
    console.warn('⚠️ FFmpeg não disponível, preview usará áudio completo como fallback');
    FFMPEG_AVAILABLE = false;
  }
} else {
  console.warn('⚠️ ffmpeg-static não instalado, preview usará áudio completo como fallback');
  FFMPEG_AVAILABLE = false;
}

export { FFMPEG_AVAILABLE };

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
    ffmpeg(inputPath)
      .setStartTime(0)
      .setDuration(30)
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

