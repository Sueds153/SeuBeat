import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import { uploadToSupabase } from './supabase';
import { logInfo, logError, logWarn } from '../utils/logger';

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

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicDomain };
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
  const isTestEnvironment = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  if (!isTestEnvironment && provider === 'r2' && r2Client && bucketName && publicDomain) {
    try {
      const fileBuffer = typeof filePathOrBuffer === 'string'
        ? await fs.promises.readFile(filePathOrBuffer)
        : filePathOrBuffer;

      const objectKey = `${bucket}/${filename}`;

      await r2Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: mimeType,
      }));

      const baseUrl = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
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

/**
 * Gera URL assinada para download/acesso temporário (R2 ou Supabase fallback)
 */
export async function createSignedStorageUrl(
  bucket: string,
  filename: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  const provider = (process.env.STORAGE_PROVIDER || 'r2').toLowerCase();
  const r2Client = getR2Client();
  const { bucketName } = getR2Config();

  if (provider === 'r2' && r2Client && bucketName) {
    try {
      const objectKey = `${bucket}/${filename}`;
      const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
      logInfo('[Storage] URL assinada gerada para R2', { bucket, filename });
      return signedUrl;
    } catch (err) {
      logError('[Storage] Falha ao gerar URL assinada R2', err, { bucket, filename });
    }
  }

  // Fallback para Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filename, expiresInSeconds);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  } catch (err) {
    logError('[Storage] Fallback Supabase signed URL falhou', err, { bucket, filename });
  }

  return null;
}

/**
 * Remove ficheiro(s) do storage (R2 ou Supabase fallback)
 */
export async function deleteStorageFiles(bucket: string, filenames: string[]): Promise<void> {
  const provider = (process.env.STORAGE_PROVIDER || 'r2').toLowerCase();
  const r2Client = getR2Client();
  const { bucketName } = getR2Config();

  if (provider === 'r2' && r2Client && bucketName && filenames.length > 0) {
    try {
      const objects = filenames.map(f => ({ Key: `${bucket}/${f}` }));
      await r2Client.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objects },
      }));
      logInfo('[Storage] Ficheiros removidos do R2', { bucket, count: filenames.length });
      return;
    } catch (err) {
      logError('[Storage] Falha ao remover ficheiros do R2', err, { bucket, filenames });
    }
  }

  // Fallback para Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.storage.from(bucket).remove(filenames);
      if (error) throw error;
      logInfo('[Storage] Ficheiros removidos do Supabase (fallback)', { bucket, count: filenames.length });
    }
  } catch (err) {
    logError('[Storage] Fallback Supabase delete falhou', err, { bucket, filenames });
  }
}

/**
 * Remove um único ficheiro do storage (convenience wrapper)
 */
export async function deleteStorageFile(bucket: string, filename: string): Promise<void> {
  await deleteStorageFiles(bucket, [filename]);
}

/**
 * Lista ficheiros num bucket/prefixo (R2 ou Supabase fallback)
 */
export async function listStorageFiles(bucket: string, prefix: string = ''): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
  const provider = (process.env.STORAGE_PROVIDER || 'r2').toLowerCase();
  const r2Client = getR2Client();
  const { bucketName } = getR2Config();

  if (provider === 'r2' && r2Client && bucketName) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `${bucket}/${prefix}`,
      });
      const response = await r2Client.send(command);
      if (response.Contents) {
        return response.Contents.map(obj => ({
          name: obj.Key?.replace(`${bucket}/`, '') || '',
          size: obj.Size || 0,
          lastModified: obj.LastModified || new Date(),
        }));
      }
      return [];
    } catch (err) {
      logError('[Storage] Falha ao listar ficheiros R2', err, { bucket, prefix });
    }
  }

  // Fallback para Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.storage.from(bucket).list(prefix);
      if (error) throw error;
      return (data || []).map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        lastModified: f.updated_at ? new Date(f.updated_at) : new Date(),
      }));
    }
  } catch (err) {
    logError('[Storage] Fallback Supabase list falhou', err, { bucket, prefix });
  }

  return [];
}

/**
 * Obtém URL pública de um ficheiro (R2 ou Supabase fallback)
 */
export async function getPublicStorageUrl(bucket: string, filename: string): Promise<string | null> {
  const provider = (process.env.STORAGE_PROVIDER || 'r2').toLowerCase();
  const { bucketName, publicDomain } = getR2Config();

  if (provider === 'r2' && bucketName && publicDomain) {
    const objectKey = `${bucket}/${filename}`;
    const baseUrl = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
    return `${baseUrl}/${objectKey}`;
  }

  // Fallback para Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
      return data?.publicUrl || null;
    }
  } catch (err) {
    logError('[Storage] Fallback Supabase public URL falhou', err, { bucket, filename });
  }

  return null;
}