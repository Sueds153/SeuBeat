import { getAdminSupabase } from './supabase';
import { sendAbandonedFirstReminder, sendAbandonedSecondReminder, sendAbandonedThirdReminder, sendAbandonedFourthReminder, sendAbandonedFifthReminder, sendRejectedReminderEmail } from './email';
import { sendAbandonedWhatsApp } from './whatsapp';
import { enabledWhatsAppBuckets, templateForBucket } from './whatsappTemplates';
import { bucketForElapsed } from './abandonedMessages';
import { logInfo, logError, logWarn } from '../utils/logger';
import { getAppUrl } from '../utils/helpers';

const INTERVAL_MS = 10 * 60 * 1000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Lembrete de rejeição: 24h depois de o comprovativo ser rejeitado. */
const REJECTED_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;

// Guarda anti-spam em memória: se a migration rejected_reminder_sent_at ainda
// não foi aplicada (coluna ausente → update falha), não reenvia a cada tick.
// Com a coluna aplicada o dedupe é persistente; este guarda cobre o intervalo.
const rejectedRemindedInMemory = new Set<string>();

/** Testes: limpa o guarda em memória entre casos. */
export function resetRejectedReminderGuard(): void {
  rejectedRemindedInMemory.clear();
}

type AdminClient = NonNullable<ReturnType<typeof getAdminSupabase>>;

/**
 * Pedido rejeitado (payment_rejected): envia UM lembrete 24h depois da
 * rejeição com CTA para reenviar o comprovativo. Fora da cadeia de abandono —
 * o cliente já escolheu plano e pagou, a mensagem correta não é "escolhe o plano".
 */
async function processRejectedReminder(
  req: {
    id: string;
    email: string;
    recipient_name?: string | null;
    updated_at?: string | null;
    created_at: string;
    rejected_reminder_sent_at?: string | null;
  },
  nowDate: Date,
  nowIso: string,
  tickStats: { rejectedReminders: number },
  db: AdminClient
): Promise<void> {
  if (req.rejected_reminder_sent_at || rejectedRemindedInMemory.has(req.id)) return;

  const updatedAt = new Date(req.updated_at || req.created_at).getTime();
  if (Number.isNaN(updatedAt) || nowDate.getTime() - updatedAt < REJECTED_REMINDER_DELAY_MS) return;

  // Motivo da rejeição (best-effort) — payments.notes da rejeição mais recente
  let notes: string | undefined;
  try {
    const { data: pay } = await db
      .from('payments')
      .select('notes')
      .eq('request_id', req.id)
      .eq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    notes = (pay as { notes?: string | null } | null)?.notes || undefined;
  } catch {
    // motivo é opcional — o lembrete segue sem ele
  }

  await sendRejectedReminderEmail(req.email, req.recipient_name || '', req.id, notes);
  rejectedRemindedInMemory.add(req.id);
  tickStats.rejectedReminders++;
  logInfo('[AbandonedRecovery] Lembrete de rejeicao enviado (24h)', { requestId: req.id, email: req.email, hasNotes: !!notes });

  try {
    const { error: flagError } = await db
      .from('song_requests')
      .update({ rejected_reminder_sent_at: nowIso })
      .eq('id', req.id);
    if (flagError) {
      logWarn('[AbandonedRecovery] Lembrete enviado mas flag rejected_reminder_sent_at nao gravada (migration aplicada?)', {
        requestId: req.id,
        code: flagError.code,
      });
    }
  } catch (err) {
    logWarn('[AbandonedRecovery] Falha ao gravar flag rejected_reminder_sent_at', { requestId: req.id, err: String(err) });
  }
}

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
    // '*' em vez de lista explícita: inclui updated_at + a coluna nova
    // rejected_reminder_sent_at sem partir o SELECT se a migration ainda
    // não foi aplicada (coluna inexistente rebentaria a query inteira).
    .select('*, users(phone), songs(title, lyrics_snippet)')
    .in('status', ['lyrics_ready', 'lyrics_generating', 'payment_rejected'])
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
  const tickStats = { emailSent: 0, whatsappSent: 0, whatsappFailed: 0, whatsappSkipped: 0, rejectedReminders: 0 };

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
      // ── Pedido rejeitado: lembrete único 24h depois (não entra na cadeia) ──
      if (req.status === 'payment_rejected') {
        await processRejectedReminder(req, nowDate, nowIso, tickStats, db);
        continue;
      }

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
    rejectedReminders: tickStats.rejectedReminders,
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