import { normalizePhoneToE164 } from '../abandonedMessages';
import { templateForBucket } from '../whatsappTemplates';
import { isConfigured, START_HOUR, END_HOUR, DAILY_CAP, MIN_SEND_DELAY_MS, MAX_SEND_DELAY_MS } from './config';
import { insertSendLog, markContacted, markBucketSent, getDailySentCount } from './sendLog';
import { sendTemplate } from './templateSender';
import type { BulkClient } from './bulkCampaign';

export type AbandonedSendResult =
  | 'sent'
  | 'skipped'
  | 'failed'
  | 'window-closed'
  | 'cap-reached'
  | 'unconfigured';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay() {
  return MIN_SEND_DELAY_MS + Math.floor(Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS + 1));
}

/**
 * Envia um template de abandono para um cliente com todas as proteções da
 * campanha (normalização E.164, janela horária, cap diário, delay anti-spam,
 * insertSendLog e markContacted). Usado pelo abandonedRecoveryScheduler para
 * garantir o mesmo comportamento do runSendBulk sem duplicar lógica.
 */
export async function sendAbandonedWhatsApp(client: BulkClient): Promise<AbandonedSendResult> {
  if (!isConfigured()) {
    return 'unconfigured';
  }

  const hour = new Date().getHours();
  if (hour < START_HOUR || hour >= END_HOUR) {
    return 'window-closed';
  }

  const sentToday = await getDailySentCount();
  const budget = Math.max(0, DAILY_CAP - sentToday);
  if (budget <= 0) {
    return 'cap-reached';
  }

  const phone = normalizePhoneToE164(client.phone || '');
  if (!phone) {
    await insertSendLog({ requestId: client.requestId, phone: client.phone || '', status: 'skipped', error: 'sem telefone' });
    return 'skipped';
  }

  const def = templateForBucket(client.bucket);
  const templateName = client.templateName || def?.name || '';
  if (!templateName) {
    await insertSendLog({ requestId: client.requestId, phone, status: 'failed', error: 'Sem template definido para este bucket.' });
    return 'failed';
  }

  await sleep(randomDelay());
  const params = client.params && client.params.length ? client.params : client.message ? [client.message] : [];
  const result = await sendTemplate(phone, templateName, params);

  if (result.ok) {
    await markContacted(client.requestId);
    await markBucketSent(client.requestId, client.bucket);
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: 'sent',
      messageId: result.messageId || undefined,
      templateName,
    });
    return 'sent';
  }

  if (result.code === 131030) {
    await insertSendLog({ requestId: client.requestId, phone, status: 'skipped', error: result.error });
    return 'skipped';
  }

  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', error: result.error });
  return 'failed';
}
