import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fs from 'fs';

const streamPipeline = promisify(pipeline);

if (ffmpegInstaller) {
  ffmpeg.setFfmpegPath(ffmpegInstaller);
}

// Utilitário para baixar arquivo
export async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao descarregar arquivo: ${res.statusText}`);
  const fileStream = fs.createWriteStream(destPath);
  await streamPipeline(res.body as any, fileStream);
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

// Utilitário para mixar áudio da Mureka + Narração ElevenLabs
export function mixAudio(murekaPath: string, voicePath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(murekaPath)
      .input(voicePath)
      .complexFilter([
        '[0:a]volume=0.25[bg]',
        '[1:a]volume=1.1[fg]',
        '[bg][fg]amix=inputs=2:duration=longest[out]'
      ])
      .map('[out]')
      .output(outputPath)
      .on('end', () => {
        console.log('✅ Mixagem Premium concluída com sucesso!');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Erro no FFmpeg ao mixar áudios:', err);
        reject(err);
      })
      .run();
  });
}
