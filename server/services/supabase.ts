import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import { uploadFileToStorage } from './storage';

let adminClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || '';
}

export function getAdminSupabase(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada. O admin client não pode ser inicializado.');
  }
  adminClient = createClient(url, key);
  return adminClient;
}

export function getPublicSupabase(): SupabaseClient | null {
  if (publicClient) return publicClient;
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_ANON_KEY não configurada. O public client não pode ser inicializado.');
  }
  publicClient = createClient(url, key);
  return publicClient;
}

/**
 * Envia ficheiro para o storage (R2 se configurado, senão Supabase).
 * Mantém compatibilidade com a API existente.
 */
export async function uploadToSupabase(bucket: string, filename: string, filePath: string, mimeType: string): Promise<string> {
  const fileBuffer = await fs.promises.readFile(filePath);
  return uploadFileToStorage(bucket, filename, fileBuffer, mimeType);
}
