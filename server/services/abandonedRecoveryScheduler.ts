import { getAdminSupabase } from './supabase';
import { sendAbandonedFirstReminder, sendAbandonedSecondReminder } from './email';
import { logInfo, logError, logWarn } from '../utils/logger';

const INTERVAL_MS = 10 * 60 * 1000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function processAbandonedRecovery(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) {
    logWarn('[AbandonedRecovery] Admin Supabase client indisponivel');
    return;
  }

  const now = new Date().toISOString();

  const { data: abandoned, error } = await supabase
    .from('song_requests')
    .select('id, email, recipient_name, created_at, abandoned_30min_sent_at, abandoned_24h_sent_at')
    .in('status', ['lyrics_ready', 'payment_submitted', 'lyrics_generating'])
    .is('deleted_at', null)
    .not('email', 'is', null);

  if (error) {
    logError('[AbandonedRecovery] Erro ao consultar pedidos abandonados', error);
    return;
  }

  if (!abandoned || abandoned.length === 0) return;

  const nowDate = new Date();

  for (const req of abandoned) {
    const createdAt = new Date(req.created_at);
    const diffMs = nowDate.getTime() - createdAt.getTime();

    try {
      if (diffMs >= 24 * 60 * 60 * 1000 && !req.abandoned_24h_sent_at) {
        await sendAbandonedSecondReminder(req.email, req.recipient_name || '');
        await supabase.from('song_requests').update({ abandoned_24h_sent_at: now }).eq('id', req.id);
        logInfo('[AbandonedRecovery] Segundo lembrete enviado', { requestId: req.id, email: req.email });
      } else if (diffMs >= 30 * 60 * 1000 && !req.abandoned_30min_sent_at) {
        await sendAbandonedFirstReminder(req.email, req.recipient_name || '');
        await supabase.from('song_requests').update({ abandoned_30min_sent_at: now }).eq('id', req.id);
        logInfo('[AbandonedRecovery] Primeiro lembrete enviado', { requestId: req.id, email: req.email });
      }
    } catch (err) {
      logError('[AbandonedRecovery] Falha ao processar pedido', err, { requestId: req.id, email: req.email });
    }
  }
}

export function startAbandonedRecoveryScheduler(): void {
  if (intervalHandle) return;
  logInfo('[AbandonedRecovery] Iniciado (intervalo: 10min)');
  processAbandonedRecovery();
  intervalHandle = setInterval(processAbandonedRecovery, INTERVAL_MS);
  intervalHandle.unref();
}
