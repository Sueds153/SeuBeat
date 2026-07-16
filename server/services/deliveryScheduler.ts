import { getAdminSupabase } from './supabase';
import { sendPersonalizedEmail, sendConfirmationEmail } from './email';
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

async function deliverPendingSongs(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;

  const now = new Date().toISOString();

  const { data: pending, error } = await supabase
    .from('song_requests')
    .select('id, recipient_name, status, deliver_at, email, final_mixed_audio_url, songs(id, title, letter_text)')
    .eq('status', 'approved')
    .lte('deliver_at', now)
    .is('deleted_at', null);

  if (error) {
    logError('[DeliveryScheduler] Erro ao consultar pedidos pendentes', error);
    return;
  }

  if (!pending || pending.length === 0) return;

  logInfo(`[DeliveryScheduler] ${pending.length} musica(s) pronta(s) para entrega`);

  for (const req of pending) {
    try {
      const songData = Array.isArray(req.songs) ? req.songs[0] : null;
      const letterText = songData?.letter_text || 'Preparámos uma dedicatória especial para si.';
      const slug = makeSlug(req.recipient_name || 'especial');
      const songId = songData?.id;

      if (!req.email || !songId) {
        logWarn('[DeliveryScheduler] Pedido sem email ou songId', { requestId: req.id });
        continue;
      }

      const personalizedUrl = `${getAppUrl()}/song/${slug}?id=${songId}`;

      await supabase
        .from('song_requests')
        .update({
          status: 'delivered',
          delivered_at: now,
        })
        .eq('id', req.id);

      await sendPersonalizedEmail(
        req.email,
        req.recipient_name || 'Destinatario',
        personalizedUrl,
        letterText
      );

      logInfo('[DeliveryScheduler] Musica entregue com sucesso', {
        requestId: req.id,
        email: req.email,
        songId,
      });
    } catch (err) {
      logError('[DeliveryScheduler] Erro ao entregar musica', err, { requestId: req.id });
    }
  }
}

export function startDeliveryScheduler(): void {
  if (intervalHandle) return;
  logInfo('[DeliveryScheduler] Iniciado (intervalo: 10min)');
  deliverPendingSongs();
  intervalHandle = setInterval(deliverPendingSongs, INTERVAL_MS);
  intervalHandle.unref();
}

export function stopDeliveryScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logInfo('[DeliveryScheduler] Parado');
  }
}
