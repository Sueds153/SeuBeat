import { getAdminSupabase } from './supabase';
import { sendPersonalizedEmail } from './email';
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
  if (!supabase) {
    logWarn('[DeliveryScheduler] Admin Supabase client indisponivel');
    return;
  }

  const now = new Date().toISOString();

  const { data: pending, error } = await supabase
    .from('song_requests')
    .select('id, recipient_name, status, deliver_at, email, final_mixed_audio_url, songs(id, title, letter_text)')
    .eq('status', 'approved')
    .lte('deliver_at', now)
    .not('deliver_at', 'is', null);

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

      if (!songId) {
        logWarn('[DeliveryScheduler] songId em falta', { requestId: req.id });
        continue;
      }

      const personalizedUrl = `${getAppUrl()}/song/${slug}?id=${songId}`;

      const { error: updateError } = await supabase
        .from('song_requests')
        .update({
          status: 'delivered',
          deliver_at: null,
          delivered_at: now,
        })
        .eq('id', req.id)
        .eq('status', 'approved');

      if (updateError) {
        logError('[DeliveryScheduler] Erro ao atualizar status para delivered', updateError, { requestId: req.id });
      } else {
        logInfo('[DeliveryScheduler] Musica entregue com sucesso', {
          requestId: req.id,
          email: req.email,
          songId,
        });
        if (req.email) {
          await sendPersonalizedEmail(
            req.email,
            req.recipient_name || 'Destinatario',
            personalizedUrl,
            letterText
          );
        }
      }
    } catch (err) {
      logError('[DeliveryScheduler] Erro ao entregar musica', { requestId: req.id, error: err instanceof Error ? err.message : String(err) });
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


