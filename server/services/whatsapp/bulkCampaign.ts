import { logError } from '../../utils/logger';
import { normalizePhoneToE164 } from '../abandonedMessages';
import { templateForBucket } from '../whatsappTemplates';
import { isConfigured, START_HOUR, END_HOUR, DAILY_CAP, MIN_SEND_DELAY_MS, MAX_SEND_DELAY_MS } from './config';
import { insertSendLog, markContacted, getDailySentCount } from './sendLog';
import { sendTemplate } from './templateSender';

export interface BulkClient {
  requestId: string;
  phone: string;
  bucket?: string;
  templateName?: string;
  params?: string[];
  message?: string;
}

export interface BulkOptions {
  // reservado para opções futuras
}

export interface SendProgressData {
  running: boolean;
  total: number;
  processed: number;
  sent: number;
  skippedNoWhatsApp: number;
  failed: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

const progress: SendProgressData = {
  running: false,
  total: 0,
  processed: 0,
  sent: 0,
  skippedNoWhatsApp: 0,
  failed: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
};

let sendInFlight = false;

export function getSendProgress() {
  return { ...progress };
}

export function resetProgress() {
  progress.running = false;
  progress.total = 0;
  progress.processed = 0;
  progress.sent = 0;
  progress.skippedNoWhatsApp = 0;
  progress.failed = 0;
  progress.error = null;
  progress.startedAt = null;
  progress.finishedAt = null;
}

function randomDelay() {
  return MIN_SEND_DELAY_MS + Math.floor(Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS + 1));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runSendBulk(clients: BulkClient[], _options?: BulkOptions) {
  if (!isConfigured()) {
    throw new Error('WhatsApp API não configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID.');
  }
  if (!clients || clients.length === 0) return { scheduled: false };
  if (sendInFlight) return { scheduled: false };

  sendInFlight = true;
  progress.running = true;
  progress.total = clients.length;
  progress.processed = 0;
  progress.sent = 0;
  progress.skippedNoWhatsApp = 0;
  progress.failed = 0;
  progress.error = null;
  progress.startedAt = new Date().toISOString();
  progress.finishedAt = null;

  void (async () => {
    try {
      await sendBulk(clients);
    } catch (err) {
      progress.error = err instanceof Error ? err.message : String(err);
      logError('[WhatsApp] Falha na campanha', err instanceof Error ? err : new Error(String(err)));
    } finally {
      progress.running = false;
      progress.finishedAt = new Date().toISOString();
      sendInFlight = false;
    }
  })();

  return { scheduled: true };
}

async function sendBulk(clients: BulkClient[]) {
  const hour = new Date().getHours();
  if (hour < START_HOUR || hour >= END_HOUR) {
    progress.error = `Janela de envio WhatsApp fechada (${START_HOUR}h–${END_HOUR}h).`;
    progress.processed = progress.total;
    return;
  }

  const sentToday = await getDailySentCount();
  const budget = Math.max(0, DAILY_CAP - sentToday);
  if (budget <= 0) {
    progress.error = 'Cap diário de mensagens WhatsApp atingido.';
    progress.processed = progress.total;
    return;
  }

  let used = 0;
  for (const client of clients) {
    if (used >= budget) {
      progress.error = 'Cap diário de mensagens WhatsApp atingido.';
      break;
    }

    const phone = normalizePhoneToE164(client.phone || '');
    if (!phone) {
      progress.skippedNoWhatsApp++;
      progress.processed++;
      await insertSendLog({ requestId: client.requestId, phone: client.phone || '', status: 'skipped', bucket: client.bucket, error: 'sem telefone' });
      continue;
    }

    if (used > 0) await sleep(randomDelay());
    used++;
    await sendOne(client, phone);
  }
}

async function sendOne(client: BulkClient, phone: string): Promise<'sent' | 'skipped' | 'failed'> {
  const def = templateForBucket(client.bucket);
  const templateName = client.templateName || def?.name || '';
  if (!templateName) {
    progress.failed++;
    progress.processed++;
    await insertSendLog({ requestId: client.requestId, phone, status: 'failed', bucket: client.bucket, error: 'Sem template definido para este bucket.' });
    return 'failed';
  }

  const params = client.params && client.params.length ? client.params : client.message ? [client.message] : [];
  const result = await sendTemplate(phone, templateName, params);
  progress.processed++;

  if (result.ok) {
    await markContacted(client.requestId);
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: 'sent',
      bucket: client.bucket,
      messageId: result.messageId || undefined,
      templateName,
    });
    progress.sent++;
    return 'sent';
  }

  if (result.code === 131030) {
    progress.skippedNoWhatsApp++;
    await insertSendLog({ requestId: client.requestId, phone, status: 'skipped', bucket: client.bucket, error: result.error });
    return 'skipped';
  }

  progress.failed++;
  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', bucket: client.bucket, error: result.error });
  return 'failed';
}
