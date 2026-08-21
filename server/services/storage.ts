import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import { uploadToSupabase } from './supabase';
import { logInfo, logError } from '../utils/logger';

let s3ClientInstance: S3Client | null = null;

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Envia ficheiro para o Cloudflare R2 (se configurado) com fallback automático e transparente para o Supabase Storage.
 */
export async function uploadFileToStorage(
  bucket: string,
  filename: string,
  filePathOrBuffer: string | Buffer,
  mimeType: string
): Promise<string> {
  const provider = (process.env.STORAGE_PROVIDER || 'r2').toLowerCase();
  const r2Client = getR2Client();
  const r2Bucket = process.env.R2_BUCKET_NAME;
  const r2PublicDomain = process.env.R2_PUBLIC_DOMAIN;

  if (provider === 'r2' && r2Client && r2Bucket && r2PublicDomain) {
    try {
      const fileBuffer = typeof filePathOrBuffer === 'string'
        ? await fs.promises.readFile(filePathOrBuffer)
        : filePathOrBuffer;

      const objectKey = `${bucket}/${filename}`;

      await r2Client.send(new PutObjectCommand({
        Bucket: r2Bucket,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: mimeType,
      }));

      const baseUrl = r2PublicDomain.endsWith('/') ? r2PublicDomain.slice(0, -1) : r2PublicDomain;
      const publicUrl = `${baseUrl}/${objectKey}`;

      logInfo('[Storage] Ficheiro enviado com sucesso para Cloudflare R2', { bucket, filename, url: publicUrl });
      return publicUrl;
    } catch (err) {
      logError('[Storage] Falha ao enviar para Cloudflare R2, a recorrer ao Supabase Storage', err, { bucket, filename });
    }
  }

  if (typeof filePathOrBuffer === 'string') {
    return await uploadToSupabase(bucket, filename, filePathOrBuffer, mimeType);
  } else {
    const tempPath = `./tmp_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await fs.promises.writeFile(tempPath, filePathOrBuffer);
    try {
      return await uploadToSupabase(bucket, filename, tempPath, mimeType);
    } finally {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
  }
}
