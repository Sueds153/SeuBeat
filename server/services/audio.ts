import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import fs from 'fs';

if (ffmpegInstaller) {
  ffmpeg.setFfmpegPath(ffmpegInstaller);
}

const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS || 120000);

// Utilitário para baixar arquivo
export async function downloadFile(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Falha ao descarregar arquivo: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    await fs.promises.writeFile(destPath, Buffer.from(arrayBuffer));
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


