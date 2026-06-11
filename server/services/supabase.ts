import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase client helper
export function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Utilitário para fazer upload para o Supabase Storage
export async function uploadToSupabase(bucket: string, filename: string, filePath: string, mimeType: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase client não inicializado.");
  
  const fileBuffer = fs.readFileSync(filePath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });
    
  if (error) {
    throw new Error(`Erro ao enviar ficheiro para o storage (${bucket}/${filename}): ${error.message}`);
  }
  
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
  if (!urlData || !urlData.publicUrl) {
    throw new Error(`Não foi possível obter a URL pública para o ficheiro ${filename}`);
  }
  
  return urlData.publicUrl;
}
