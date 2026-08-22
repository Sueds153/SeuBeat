import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';

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
 * Upload direto para o Supabase Storage — usado como fallback quando o R2 falha.
 * Usa o client Supabase em vez de chamar uploadFileToStorage (evita recursão circular).
 */
export async function uploadToSupabase(bucket: string, filename: string, filePath: string, mimeType: string): Promise<string> {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client não inicializado para upload de fallback.');

  const fileBuffer = await fs.promises.readFile(filePath);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, fileBuffer, { contentType: mimeType, upsert: true });

  if (error) {
    throw new Error(`Falha no upload para Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}
