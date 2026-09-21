import { getAdminSupabase } from '../supabase';
import { logInfo, logError } from '../../utils/logger';

export async function handleDeliveryWebhook(payload: unknown): Promise<void> {
  const obj = (payload && typeof payload === 'object' ? payload : null) as Record<string, any> | null;
  const entries = obj?.entry;
  if (!Array.isArray(entries)) return;

  const supabase = getAdminSupabase();
  if (!supabase) return;

  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change?.value || {};
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const st of statuses) {
        const status = st?.status;
        const waId = st?.recipient_id;
        if (!status || !waId) continue;
        const dbStatus = status === 'failed' ? 'failed' : status === 'delivered' || status === 'read' ? 'delivered' : null;
        if (!dbStatus) continue;

        const err = st?.errors?.[0];
        const update: Record<string, unknown> = {
          status: dbStatus,
          error: err?.message ? err.message : null,
        };
        if (typeof st?.id === 'string') update.message_id = st.id;

        try {
          const { data: rows } = await supabase
            .from('whatsapp_send_log')
            .select('id')
            .eq('phone', waId)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })
            .limit(1);
          if (rows?.[0]?.id) {
            await supabase.from('whatsapp_send_log').update(update).eq('id', rows[0].id);
            logInfo('[WhatsApp] Estado de entrega atualizado', { waId, status: dbStatus });
          }
        } catch (err) {
          logError('[WhatsApp] Erro ao processar webhook', err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
  }
}
