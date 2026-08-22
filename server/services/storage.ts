import fs from 'fs';
import { Readable } from 'stream';
import { uploadToSupabase } from './supabase';
import { logInfo, logError, logWarn } from '../utils/logger';

function getEnv(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

interface AwsSdkModules {
  S3Client: typeof import('@aws-sdk/client-s3').S3Client;
  PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand;
  DeleteObjectCommand: typeof import('@aws-sdk/client-s3').DeleteObjectCommand;
  DeleteObjectsCommand: typeof import('@aws-sdk/client-s3').DeleteObjectsCommand;
  GetObjectCommand: typeof import('@aws-sdk/client-s3').GetObjectCommand;
  ListObjectsV2Command: typeof import('@aws-sdk/client-s3').ListObjectsV2Command;
  getSignedUrl: typeof import('@aws-sdk/s3-request-presigner').getSignedUrl;
}

let awsSdkModule: AwsSdkModules | null = null;
let awsSdkLoadAttempted = false;

async function loadAwsSdk(): Promise<AwsSdkModules | null> {
  if (awsSdkModule) return awsSdkModule;
  if (awsSdkLoadAttempted) return null;
  awsSdkLoadAttempted = true;

  try {
    const s3 = await import('@aws-sdk/client-s3');
    const presigner = await import('@aws-sdk/s3-request-presigner');
    awsSdkModule = {
      S3Client: s3.S3Client,
      PutObjectCommand: s3.PutObjectCommand,
      DeleteObjectCommand: s3.DeleteObjectCommand,
      DeleteObjectsCommand: s3.DeleteObjectsCommand,
      GetObjectCommand: s3.GetObjectCommand,
      ListObjectsV2Command: s3.ListObjectsV2Command,
      getSignedUrl: presigner.getSignedUrl,
    };
    return awsSdkModule;
  } catch (err) {
    logWarn('[Storage] Módulos AWS S3 SDK não disponíveis no ambiente, a usar Supabase Storage como fallback:', err);
    return null;
  }
}

let s3ClientInstance: unknown = null;

async function getR2Client(): Promise<{ client: unknown; sdk: AwsSdkModules } | null> {
  const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
  if (isTestEnv) return null;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const sdk = await loadAwsSdk();
  if (!sdk) return null;

  if (!s3ClientInstance) {
    s3ClientInstance = new sdk.S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return { client: s3ClientInstance, sdk };
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
  const provider = (process.env.STORAGE_PROVIDER || 'r2').toLowerCase();
  const r2 = await getR2Client();
  const { bucketName, publicDomain } = getR2Config();

  logInfo('[Storage] uploadFileToStorage chamado', {
    bucket, filename, mimeType,
    provider,
    r2ClientAvailable: !!r2,
    bucketName: bucketName || '(vazio)',
    publicDomain: publicDomain ? '(definido)' : '(vazio)',
    conditionMet: !!(provider === 'r2' && r2 && bucketName && publicDomain),
  });

  if (provider === 'r2' && r2 && bucketName && publicDomain) {
    try {
      const objectKey = `${bucket}/${filename}`;
      const client = r2.client as import('@aws-sdk/client-s3').S3Client;
      const { Upload } = await import('@aws-sdk/lib-storage');

      const body = typeof filePathOrBuffer === 'string'
        ? fs.createReadStream(filePathOrBuffer)
        : Buffer.isBuffer(filePathOrBuffer)
          ? Readable.from(filePathOrBuffer)
          : filePathOrBuffer;

      const upload = new Upload({
        client,
        params: {
          Bucket: bucketName,
          Key: objectKey,
          Body: body,
          ContentType: mimeType,
        },
        queueSize: 1,
        partSize: 10 * 1024 * 1024,
      });

      await upload.done();

      const baseUrl = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
      const publicUrl = `${baseUrl}/${objectKey}`;

      logInfo('[Storage] Ficheiro enviado com sucesso para Cloudflare R2', { bucket, filename, url: publicUrl });
      return publicUrl;
    } catch (err) {
      logError('[Storage] Falha ao enviar para Cloudflare R2, a recorrer ao Supabase Storage', err, {
        bucket, filename,
        r2Account: getEnv('R2_ACCOUNT_ID') ? `${getEnv('R2_ACCOUNT_ID')!.slice(0,6)}...` : '(missing)',
        bucketName,
      });
    }
  } else {
    logWarn('[Storage] R2 NÃO utilizado — fallback para Supabase', {
      provider,
      r2Client: !!r2,
      bucketName: !!bucketName,
      publicDomain: !!publicDomain,
      reason: provider !== 'r2'
        ? `provider='${provider}'`
        : !r2
        ? 'r2Client=null (missing env vars or sdk load failed)'
        : !bucketName
        ? 'R2_BUCKET_NAME missing'
        : 'R2_PUBLIC_DOMAIN missing',
    });
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
  const r2 = await getR2Client();
  const { bucketName } = getR2Config();

  if (provider === 'r2' && r2 && bucketName) {
    try {
      const objectKey = `${bucket}/${filename}`;
      const command = new r2.sdk.GetObjectCommand({ Bucket: bucketName, Key: objectKey });
      const client = r2.client as import('@aws-sdk/client-s3').S3Client;
      const signedUrl = await r2.sdk.getSignedUrl(client, command, { expiresIn: expiresInSeconds });
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
  const r2 = await getR2Client();
  const { bucketName } = getR2Config();

  if (provider === 'r2' && r2 && bucketName && filenames.length > 0) {
    try {
      const objects = filenames.map(f => ({ Key: `${bucket}/${f}` }));
      const client = r2.client as import('@aws-sdk/client-s3').S3Client;
      await client.send(new r2.sdk.DeleteObjectsCommand({
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
  const r2 = await getR2Client();
  const { bucketName } = getR2Config();

  if (provider === 'r2' && r2 && bucketName) {
    try {
      const command = new r2.sdk.ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `${bucket}/${prefix}`,
      });
      const client = r2.client as import('@aws-sdk/client-s3').S3Client;
      const response = await client.send(command);
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