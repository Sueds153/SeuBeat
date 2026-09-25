import { getAdminSupabase } from './supabase';
import { sendAbandonedFirstReminder, sendAbandonedSecondReminder, sendAbandonedThirdReminder, sendAbandonedFourthReminder, sendAbandonedFifthReminder } from './email';
import { sendAbandonedWhatsApp } from './whatsapp';
import { enabledWhatsAppBuckets, templateForBucket } from './whatsappTemplates';
import { bucketForElapsed } from './abandonedMessages';
import { logInfo, logError, logWarn } from '../utils/logger';
import { getAppUrl } from '../utils/helpers';

const INTERVAL_MS = 10 * 60 * 1000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

const WHATSAPP_FLAG_BY_BUCKET: Record<string, string> = {
  '30min': 'whatsapp_30min_sent_at',
  '24h': 'whatsapp_24h_sent_at',
  '48h': 'whatsapp_48h_sent_at',
  '72h': 'whatsapp_72h_sent_at',
};

export async function processAbandonedRecovery(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) {
    logWarn('[AbandonedRecovery] Admin Supabase client indisponivel');
    return;
  }

  const { data: abandoned, error } = await supabase
    .from('song_requests')
    .select('id, email, recipient_name, phone, created_at, abandoned_30min_sent_at, abandoned_24h_sent_at, abandoned_48h_sent_at, abandoned_72h_sent_at, abandoned_7d_sent_at, whatsapp_30min_sent_at, whatsapp_24h_sent_at, whatsapp_48h_sent_at, whatsapp_72h_sent_at, user_id, users(phone), songs(title, lyrics_snippet)')
    .in('status', ['lyrics_ready', 'lyrics_generating'])
    .is('deleted_at', null)
    .not('email', 'is', null);

  if (error) {
    logError('[AbandonedRecovery] Erro ao consultar pedidos abandonados', error);
    return;
  }

  if (!abandoned || abandoned.length === 0) {
    logInfo('[AbandonedRecovery] Nenhum pedido abandonado elegivel encontrado');
    return;
  }

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const tickStats = { emailSent: 0, whatsappSent: 0, whatsappFailed: 0, whatsappSkipped: 0 };

  // Flags de email são colunas timestamptz — gravar Date.now() (número) faz o
  // PostgREST rejeitar o update em silêncio e o dedupe morre (reenvio a cada tick).
  const db = supabase;
  async function markEmailFlag(flag: 'abandoned_7d_sent_at' | 'abandoned_72h_sent_at' | 'abandoned_48h_sent_at' | 'abandoned_24h_sent_at' | 'abandoned_30min_sent_at', requestId: string): Promise<void> {
    try {
      const { error: flagError } = await db.from('song_requests').update({ [flag]: nowIso }).eq('id', requestId);
      if (flagError) {
        logError(`[AbandonedRecovery] Falha ao marcar flag ${flag}`, flagError, { requestId });
      }
    } catch (err) {
      logError(`[AbandonedRecovery] Falha ao marcar flag ${flag}`, err instanceof Error ? err : new Error(String(err)), { requestId });
    }
  }

  function songTeaser(req: { songs?: unknown }): { songTitle: string; lyricsSnippet: string } {
    const songs = Array.isArray(req.songs) ? req.songs : req.songs ? [req.songs] : [];
    const song = (songs[0] ?? {}) as { title?: string | null; lyrics_snippet?: string | null };
    return {
      songTitle: song?.title || '',
      lyricsSnippet: song?.lyrics_snippet || '',
    };
  }

  for (const req of abandoned) {
    const createdAt = new Date(req.created_at);
    const diffMs = nowDate.getTime() - createdAt.getTime();

    try {
      // Determina o bucket baseado no tempo decorrido
      const bucket = bucketForElapsed(diffMs);
      const { songTitle, lyricsSnippet } = songTeaser(req);

      // Envia email para todos os buckets (comportamento existente)
      // O lembrete de 7 dias vem primeiro — os leads >72h que nunca receberam
      // o 4º lembrete (ou já o receberam há dias) são reativados agora.
      if (diffMs >= 7 * 24 * 60 * 60 * 1000 && !req.abandoned_7d_sent_at) {
        await sendAbandonedFifthReminder(req.email, req.recipient_name || '', req.id, songTitle, lyricsSnippet);
        await markEmailFlag('abandoned_7d_sent_at', req.id);
        logInfo('[AbandonedRecovery] Quinto lembrete enviado (7 dias) por email', { requestId: req.id, email: req.email });
        tickStats.emailSent++;
      } else if (diffMs >= 72 * 60 * 60 * 1000 && !req.abandoned_72h_sent_at) {
        await sendAbandonedFourthReminder(req.email, req.recipient_name || '', req.id, songTitle, lyricsSnippet);
        await markEmailFlag('abandoned_72h_sent_at', req.id);
        logInfo('[AbandonedRecovery] Quarto lembrete enviado (72h) por email', { requestId: req.id, email: req.email });
        tickStats.emailSent++;
      } else if (diffMs >= 48 * 60 * 60 * 1000 && !req.abandoned_48h_sent_at) {
        await sendAbandonedThirdReminder(req.email, req.recipient_name || '', req.id, songTitle, lyricsSnippet);
        await markEmailFlag('abandoned_48h_sent_at', req.id);
        logInfo('[AbandonedRecovery] Terceiro lembrete enviado (48h) por email', { requestId: req.id, email: req.email });
        tickStats.emailSent++;
      } else if (diffMs >= 24 * 60 * 60 * 1000 && !req.abandoned_24h_sent_at) {
        await sendAbandonedSecondReminder(req.email, req.recipient_name || '', req.id, songTitle, lyricsSnippet);
        await markEmailFlag('abandoned_24h_sent_at', req.id);
        logInfo('[AbandonedRecovery] Segundo lembrete enviado (24h) por email', { requestId: req.id, email: req.email });
        tickStats.emailSent++;
      } else if (diffMs >= 30 * 60 * 1000 && !req.abandoned_30min_sent_at) {
        await sendAbandonedFirstReminder(req.email, req.recipient_name || '', req.id, songTitle, lyricsSnippet);
        await markEmailFlag('abandoned_30min_sent_at', req.id);
        logInfo('[AbandonedRecovery] Primeiro lembrete enviado (30min) por email', { requestId: req.id, email: req.email });
        tickStats.emailSent++;
      }

      // --- WhatsApp para clientes não pagantes nos buckets habilitados ---
      const whatsappBuckets = enabledWhatsAppBuckets();
      const whatsappFlagKey = WHATSAPP_FLAG_BY_BUCKET[bucket as string];
      if (bucket && whatsappBuckets.includes(bucket as any) && diffMs >= 30 * 60 * 1000 && whatsappFlagKey && !req[whatsappFlagKey as keyof typeof req]) {
        const templateDef = templateForBucket(bucket!);
        if (templateDef?.name) {
          // Verifica se o cliente ainda não pagou (consulta payments table)
          const hasPayment = await checkPaymentStatus(req.id);
          if (!hasPayment) {
            const appUrl = getAppUrl();
            const resumeUrl = `${appUrl}/wizard?resume=${req.id}&step=payment`;
            const phone = req.phone || req.users?.[0]?.phone || '';
            const result = await sendAbandonedWhatsApp({
              requestId: req.id,
              phone,
              bucket: bucket as string,
              templateName: templateDef.name,
              params: [req.recipient_name || '', resumeUrl],
            });
            if (result === 'sent') {
              logInfo('[AbandonedRecovery] WhatsApp enviado (bucket: {bucket}) para cliente não pagante', { requestId: req.id, email: req.email, bucket, phone });
              tickStats.whatsappSent++;
            } else {
              logWarn('[AbandonedRecovery] WhatsApp não enviado (result: {result})', { requestId: req.id, email: req.email, bucket, result });
              if (result === 'skipped' || result === 'window-closed' || result === 'cap-reached' || result === 'unconfigured') {
                tickStats.whatsappSkipped++;
              } else {
                tickStats.whatsappFailed++;
              }
            }
          }
        }
      }
    } catch (err) {
      logError('[AbandonedRecovery] Falha ao processar pedido', err, { requestId: req.id, email: req.email });
    }
  }

  logInfo('[AbandonedRecovery] Tick concluido', {
    candidates: abandoned.length,
    emailSent: tickStats.emailSent,
    whatsappSent: tickStats.whatsappSent,
    whatsappFailed: tickStats.whatsappFailed,
    whatsappSkipped: tickStats.whatsappSkipped,
  });
}

export async function checkPaymentStatus(requestId: string): Promise<boolean> {
  const supabase = getAdminSupabase();
  if (!supabase) return false;
  try {
    const { data } = await supabase
      .from('payments')
      .select('status')
      .eq('request_id', requestId)
      .maybeSingle();
    // Sem registo de pagamento = ainda não pagou → devolve false
    if (!data) return false;
    const paidStatuses = ['approved', 'delivered'];
    return paidStatuses.includes(data.status);
  } catch (err) {
    logError('[AbandonedRecovery] Erro ao consultar pagamento', err, { requestId });
    return false;
  }
}

export function startAbandonedRecoveryScheduler(): void {
  if (intervalHandle) return;
  logInfo('[AbandonedRecovery] Iniciado (intervalo: 10min)');
  processAbandonedRecovery();
  intervalHandle = setInterval(processAbandonedRecovery, INTERVAL_MS);
  intervalHandle.unref();
}