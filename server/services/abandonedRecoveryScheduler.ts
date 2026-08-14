import { getAdminSupabase } from './supabase';
import { sendAbandonedFirstReminder, sendAbandonedSecondReminder, sendAbandonedThirdReminder, sendAbandonedFourthReminder } from './email';
import { sendAbandonedWhatsApp } from '../services/whatsappSender';
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
    .select('id, email, recipient_name, phone, created_at, abandoned_30min_sent_at, abandoned_24h_sent_at, abandoned_48h_sent_at, abandoned_72h_sent_at, whatsapp_30min_sent_at, whatsapp_24h_sent_at, whatsapp_48h_sent_at, whatsapp_72h_sent_at, user_id, users(phone)')
    .in('status', ['lyrics_ready', 'lyrics_generating'])
    .is('deleted_at', null)
    .not('email', 'is', null);

  if (error) {
    logError('[AbandonedRecovery] Erro ao consultar pedidos abandonados', error);
    return;
  }

  if (!abandoned || abandoned.length === 0) return;

  const nowDate = new Date();
  const now = Date.now();

  for (const req of abandoned) {
    const createdAt = new Date(req.created_at);
    const diffMs = nowDate.getTime() - createdAt.getTime();

    try {
      // Determina o bucket baseado no tempo decorrido
      const bucket = bucketForElapsed(diffMs);

      // Envia email para todos os buckets (comportamento existente)
      if (diffMs >= 72 * 60 * 60 * 1000 && !req.abandoned_72h_sent_at) {
        await sendAbandonedFourthReminder(req.email, req.recipient_name || '', req.id);
        await supabase.from('song_requests').update({ abandoned_72h_sent_at: now }).eq('id', req.id);
        logInfo('[AbandonedRecovery] Quarto lembrete enviado (72h) por email', { requestId: req.id, email: req.email });
      } else if (diffMs >= 48 * 60 * 60 * 1000 && !req.abandoned_48h_sent_at) {
        await sendAbandonedThirdReminder(req.email, req.recipient_name || '', req.id);
        await supabase.from('song_requests').update({ abandoned_48h_sent_at: now }).eq('id', req.id);
        logInfo('[AbandonedRecovery] Terceiro lembrete enviado (48h) por email', { requestId: req.id, email: req.email });
      } else if (diffMs >= 24 * 60 * 60 * 1000 && !req.abandoned_24h_sent_at) {
        await sendAbandonedSecondReminder(req.email, req.recipient_name || '', req.id);
        await supabase.from('song_requests').update({ abandoned_24h_sent_at: now }).eq('id', req.id);
        logInfo('[AbandonedRecovery] Segundo lembrete enviado (24h) por email', { requestId: req.id, email: req.email });
      } else if (diffMs >= 30 * 60 * 1000 && !req.abandoned_30min_sent_at) {
        await sendAbandonedFirstReminder(req.email, req.recipient_name || '', req.id);
        await supabase.from('song_requests').update({ abandoned_30min_sent_at: now }).eq('id', req.id);
        logInfo('[AbandonedRecovery] Primeiro lembrete enviado (30min) por email', { requestId: req.id, email: req.email });
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
              // Atualiza a flag WhatsApp do bucket correspondente (só em sucesso)
              await supabase.from('song_requests').update({ [whatsappFlagKey]: now }).eq('id', req.id);
              logInfo('[AbandonedRecovery] WhatsApp enviado (bucket: {bucket}) para cliente não pagante', { requestId: req.id, email: req.email, bucket, phone });
            } else {
              logWarn('[AbandonedRecovery] WhatsApp não enviado (result: {result})', { requestId: req.id, email: req.email, bucket, result });
            }
          }
        }
      }
    } catch (err) {
      logError('[AbandonedRecovery] Falha ao processar pedido', err, { requestId: req.id, email: req.email });
    }
  }
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