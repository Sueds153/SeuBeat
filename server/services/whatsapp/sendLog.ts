import { getAdminSupabase } from '../supabase';
import { logError } from '../../utils/logger';

export const WHATSAPP_FLAG_BY_BUCKET: Record<string, string> = {
  '30min': 'whatsapp_30min_sent_at',
  '24h': 'whatsapp_24h_sent_at',
  '48h': 'whatsapp_48h_sent_at',
  '72h': 'whatsapp_72h_sent_at',
};

export async function insertSendLog(row: {
  requestId: string;
  phone: string;
  status: string;
  error?: string;
  messageId?: string;
  templateName?: string;
}) {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase.from('whatsapp_send_log').insert({
      request_id: row.requestId,
      phone: row.phone,
      status: row.status,
      error: row.error || null,
      message_id: row.messageId || null,
      template_name: row.templateName || null,
    });
  } catch (err) {
    logError('[WhatsApp] Erro ao registar log', err instanceof Error ? err : new Error(String(err)));
  }
}

export async function markContacted(requestId: string) {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('song_requests')
      .update({ manual_contacted_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    logError('[WhatsApp] Erro ao marcar contacto', err instanceof Error ? err : new Error(String(err)));
  }
}

/** Marca a flag WhatsApp do bucket (dedupe do scheduler) após envio com sucesso. */
export async function markBucketSent(requestId: string, bucket: string | undefined) {
  const flag = WHATSAPP_FLAG_BY_BUCKET[bucket as string];
  if (!flag) return;
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('song_requests')
      .update({ [flag]: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    logError('[WhatsApp] Erro ao marcar flag de envio', err instanceof Error ? err : new Error(String(err)));
  }
}

export async function getDailySentCount(): Promise<number> {
  const supabase = getAdminSupabase();
  if (!supabase) return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('whatsapp_send_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', startOfDay.toISOString());
  if (error) return 0;
  return count || 0;
}
