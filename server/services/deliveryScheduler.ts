import { getAdminSupabase } from './supabase';
import { sendPersonalizedEmail } from './email';
import { getAppUrl } from '../utils/helpers';
import { logInfo, logError, logWarn } from '../utils/logger';

const INTERVAL_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [60_000, 300_000, 900_000];
let intervalHandle: ReturnType<typeof setInterval> | null = null;

interface PendingRequest {
  id: string;
  email?: string | null;
  phone?: string | null;
  recipient_name?: string | null;
  songs?: Array<{ id?: string | null; letter_text?: string | null; title?: string | null }> | null;
}

import { sendDeliveryWhatsApp } from './whatsappSender';


function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function deliverWithRetry(req: PendingRequest, now: string, attempt = 0): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;

  const songData = req.songs ? (Array.isArray(req.songs) ? req.songs[0] : req.songs) : null;
  const letterText = songData?.letter_text || 'Preparámos uma dedicatória especial para si.';
  const slug = makeSlug(req.recipient_name || 'especial');
  const songId = songData?.id;

  logInfo('[DeliveryScheduler] DEBUG songData', { requestId: req.id, songData });
  logInfo('[DeliveryScheduler] DEBUG songId', { requestId: req.id, songId });

  if (!songId) {
    logWarn('[DeliveryScheduler] songId em falta', { requestId: req.id });
    return;
  }

  const personalizedUrl = `${getAppUrl()}/song/${slug}?id=${songId}`;

  if (personalizedUrl.includes('localhost')) {
    logWarn('[DeliveryScheduler] APP_URL nao configurada — URLs nas emails contera localhost', {
      requestId: req.id,
      personalizedUrl
    });
  }

  try {
    const { error: updateError, data: updateData } = await supabase
      .from('song_requests')
      .update({
        status: 'delivered',
        deliver_at: null,
        delivered_at: now,
      })
      .eq('id', req.id)
      .eq('status', 'approved');

    if (updateError) throw updateError;

    if (!updateData) {
      logInfo('[DeliveryScheduler] Música já entregue ou processada anteriormente', {
        requestId: req.id,
        songId,
      });
      return;
    }

    logInfo('[DeliveryScheduler] Musica entregue com sucesso', {
      requestId: req.id,
      email: req.email,
      songId,
    });

    logInfo('[DeliveryScheduler] DEBUG about to send email', { requestId: req.id, hasEmail: !!req.email });

    if (req.email) {
      await sendPersonalizedEmail(
        req.email,
        req.recipient_name || 'Destinatario',
        personalizedUrl,
        letterText
      );
      logInfo('[DeliveryScheduler] Email enviado com sucesso', { requestId: req.id });
    }

    if (req.phone) {
      await sendDeliveryWhatsApp({
        requestId: req.id,
        phone: req.phone,
        recipientName: req.recipient_name,
        songUrl: personalizedUrl,
      }).catch(err => logWarn('[DeliveryScheduler] Falha ao enviar WhatsApp de entrega', { requestId: req.id, error: String(err) }));
    }
  } catch (err) {
    logError('[DeliveryScheduler] Catch error', { requestId: req.id, error: err instanceof Error ? err.message : String(err) });
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      logWarn(`[DeliveryScheduler] Tentativa ${attempt + 1}/${MAX_RETRIES + 1} falhou, retentativa em ${delay}ms`, {
        requestId: req.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await new Promise(r => setTimeout(r, delay));
      return deliverWithRetry(req, now, attempt + 1);
    }
    logError('[DeliveryScheduler] Todas as tentativas esgotadas', {
      requestId: req.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
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
    .select('id, recipient_name, status, deliver_at, email, phone, final_mixed_audio_url, songs(id, title, letter_text)')
    .eq('status', 'approved')
    .lte('deliver_at', now)
    .not('deliver_at', 'is', null);

  logInfo('[DeliveryScheduler] DEBUG pending raw', { 
    requestCount: pending?.length, 
    firstReqId: pending?.[0]?.id, 
    firstReqSongs: pending?.[0]?.songs 
  });

  if (error) {
    logError('[DeliveryScheduler] Erro ao consultar pedidos pendentes', error);
    return;
  }

  if (!pending || pending.length === 0) return;

  logInfo(`[DeliveryScheduler] ${pending.length} musica(s) pronta(s) para entrega`);

  await Promise.all(pending.map(req => deliverWithRetry(req, now, 0)));
}

export function startDeliveryScheduler(): void {
  if (intervalHandle) return;
  logInfo('[DeliveryScheduler] Iniciado (intervalo: 10min)');
  deliverPendingSongs();
  intervalHandle = setInterval(deliverPendingSongs, INTERVAL_MS);
  intervalHandle.unref();
}


