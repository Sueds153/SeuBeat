import { getAdminSupabase } from './supabase';
import { sendFollowUp7d, sendFollowUp30d } from './email';
import { getAppUrl } from '../utils/helpers';
import { logInfo, logError, logWarn } from '../utils/logger';

const INTERVAL_MS = 10 * 60 * 1000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function processFollowUp(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) {
    logWarn('[FollowUp] Admin Supabase client indisponivel');
    return;
  }

  const now = new Date().toISOString();

  const { data: delivered, error } = await supabase
    .from('song_requests')
    .select('id, email, recipient_name, delivered_at, follow_up_7d_sent_at, follow_up_30d_sent_at, songs(id)')
    .eq('status', 'delivered')
    .is('deleted_at', null)
    .not('email', 'is', null)
    .not('delivered_at', 'is', null);

  if (error) {
    logError('[FollowUp] Erro ao consultar pedidos entregues', error);
    return;
  }

  if (!delivered || delivered.length === 0) return;

  const nowDate = new Date();

  for (const req of delivered) {
    const deliveredAt = new Date(req.delivered_at!);
    const diffMs = nowDate.getTime() - deliveredAt.getTime();
    const songData = Array.isArray(req.songs) ? req.songs[0] : null;
    const songId = songData?.id;
    const slug = makeSlug(req.recipient_name || 'especial');
    const songUrl = songId ? `${getAppUrl()}/song/${slug}?id=${songId}` : getAppUrl();

    try {
      if (diffMs >= 30 * 24 * 60 * 60 * 1000 && !req.follow_up_30d_sent_at && req.follow_up_7d_sent_at) {
        await sendFollowUp30d(req.email, songUrl);
        await supabase.from('song_requests').update({ follow_up_30d_sent_at: now }).eq('id', req.id);
        logInfo('[FollowUp] Follow-up 30 dias enviado', { requestId: req.id, email: req.email });
      } else if (diffMs >= 7 * 24 * 60 * 60 * 1000 && !req.follow_up_7d_sent_at) {
        await sendFollowUp7d(req.email, songUrl);
        await supabase.from('song_requests').update({ follow_up_7d_sent_at: now }).eq('id', req.id);
        logInfo('[FollowUp] Follow-up 7 dias enviado', { requestId: req.id, email: req.email });
      }
    } catch (err) {
      logError('[FollowUp] Falha ao processar follow-up', err, { requestId: req.id, email: req.email });
    }
  }
}

export function startFollowUpScheduler(): void {
  if (intervalHandle) return;
  logInfo('[FollowUp] Iniciado (intervalo: 10min)');
  processFollowUp();
  intervalHandle = setInterval(processFollowUp, INTERVAL_MS);
  intervalHandle.unref();
}
