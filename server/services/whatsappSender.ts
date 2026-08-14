import { getAdminSupabase } from './supabase';
import { logInfo, logWarn, logError } from '../utils/logger';
import { normalizePhoneToE164 } from './abandonedMessages';
import { TEMPLATE_LANGUAGE, templateForBucket, listTemplates, enabledWhatsAppBuckets } from './whatsappTemplates';

// ─────────────────────────────────────────────────────────────
// Envio de WhatsApp via WhatsApp Business Cloud API (Meta).
// Sem sessões Baileys nem QR — basta WHATSAPP_API_TOKEN (System
// User) + WHATSAPP_PHONE_NUMBER_ID. As mensagens são sempre
// TEMPLATES aprovados (obrigatório na Cloud API para não-sessão).
// ─────────────────────────────────────────────────────────────

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';
const API_TOKEN = process.env.WHATSAPP_API_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE || '244922058136';

// Constraints da campanha (configuráveis por env)
const DAILY_CAP = Number(process.env.WHATSAPP_DAILY_CAP || 30);
const START_HOUR = Number(process.env.WHATSAPP_START_HOUR || 9);
const END_HOUR = Number(process.env.WHATSAPP_END_HOUR || 20);
// Atraso anti-spam entre mensagens
const MIN_SEND_DELAY_MS = Number(process.env.WHATSAPP_MIN_SEND_DELAY_MS || 3000);
const MAX_SEND_DELAY_MS = Number(process.env.WHATSAPP_MAX_SEND_DELAY_MS || 8000);

export interface BulkClient {
  requestId: string;
  phone: string; // pode vir cru (244..., +244..., 9...); normalizado no envio
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

export function isConfigured(): boolean {
  return Boolean(API_TOKEN && PHONE_NUMBER_ID);
}

export async function getWhatsAppAppUrl(phone: string, text = '') {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function getLinkStatus() {
  return { linked: isConfigured(), phone: isConfigured() ? WHATSAPP_PHONE : null };
}

export async function getConfigStatus() {
  return {
    configured: isConfigured(),
    phone: WHATSAPP_PHONE,
    phoneNumberId: isConfigured() ? PHONE_NUMBER_ID : null,
    dailyCap: DAILY_CAP,
    startHour: START_HOUR,
    endHour: END_HOUR,
    templates: listTemplates(),
    enabledBuckets: enabledWhatsAppBuckets(),
  };
}

// Síncrono de propósito: a rota /abandoned/send-bulk lê `getSendProgress().running`
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

// ─── Tradução de erros da Cloud API para mensagens amigáveis ───

export function mapWhatsAppApiError(status: number, body: unknown): { code?: number; message: string } {
  const obj = (body && typeof body === 'object' ? body : null) as Record<string, any> | null;
  const error = obj?.error || null;
  const code: number | undefined = typeof error?.code === 'number' ? error.code : undefined;
  const apiMessage: string = typeof error?.message === 'string' ? error.message : '';
  const details: string =
    error?.error_data && typeof error.error_data?.details === 'string' ? error.error_data.details : '';

  if (status === 401 || status === 403) {
    return { code, message: 'Token da WhatsApp API inválido ou sem permissão. Verifica WHATSAPP_API_TOKEN.' };
  }
  switch (code) {
    case 131030:
      return { code, message: 'Número sem WhatsApp ativo.' };
    case 132000:
    case 132001:
    case 132012:
      return { code, message: `Template ainda não aprovado ou em revisão (${apiMessage}). Aprova-o na Meta Business.` };
    case 131047:
    case 131026:
      return { code, message: 'Parâmetros do template inválidos (nome/link).' };
    case 131042:
      return { code, message: 'Formato do número inválido.' };
    case 130429:
      return { code, message: 'Limite de pedidos da WhatsApp API excedido (rate limit).' };
    default:
      return { code, message: details || apiMessage || `Erro WhatsApp API (${status}).` };
  }
}

// ─── Envio de um template ───

export async function sendTemplate(
  phone: string,
  templateName: string,
  params: string[]
): Promise<{ ok: true; messageId: string | null } | { ok: false; error: string; code?: number }> {
  if (!isConfigured()) {
    return { ok: false, error: 'WhatsApp API não configurada (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID).' };
  }
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: TEMPLATE_LANGUAGE },
      components: params.length
        ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) }]
        : undefined,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logWarn('[WhatsApp] Falha de rede ao enviar template', { phone, templateName });
    return { ok: false, error: 'Falha de rede ao contactar a WhatsApp API.' };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const mapped = mapWhatsAppApiError(res.status, data);
    logWarn('[WhatsApp] Template rejeitado pela API', { phone, templateName, code: mapped.code, message: mapped.message });
    return { ok: false, error: mapped.message, code: mapped.code };
  }
  const messageId: string | null = data?.messages?.[0]?.id || null;
  logInfo('[WhatsApp] Template enviado', { phone, templateName, messageId });
  return { ok: true, messageId };
}

// ─── Registos (log + contacto) ───

async function insertSendLog(row: {
  requestId: string;
  phone: string;
  status: string;
  error?: string;
  messageId?: string;
  templateName?: string;
}) {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase.from('whatsapp_send_log').insert({
      request_id: row.requestId,
      phone: row.phone,
      status: row.status,
      error: row.error || null,
      message_id: row.messageId || null,
      template_name: row.templateName || null,
    });
  } catch (err) {
    logError('[WhatsApp] Erro ao registar log', err instanceof Error ? err : new Error(String(err)));
  }
}

async function markContacted(requestId: string) {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('song_requests')
      .update({ manual_contacted_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    logError('[WhatsApp] Erro ao marcar contacto', err instanceof Error ? err : new Error(String(err)));
  }
}

async function getDailySentCount(): Promise<number> {
  const supabase = getAdminSupabase();
  if (!supabase) return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('whatsapp_send_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', startOfDay.toISOString());
  if (error) return 0;
  return count || 0;
}

// ─── Campanha (background) ───

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
      await insertSendLog({ requestId: client.requestId, phone: client.phone || '', status: 'skipped', error: 'sem telefone' });
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
    await insertSendLog({ requestId: client.requestId, phone, status: 'failed', error: 'Sem template definido para este bucket.' });
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
      messageId: result.messageId || undefined,
      templateName,
    });
    progress.sent++;
    return 'sent';
  }

  if (result.code === 131030) {
    progress.skippedNoWhatsApp++;
    await insertSendLog({ requestId: client.requestId, phone, status: 'skipped', error: result.error });
    return 'skipped';
  }

  progress.failed++;
  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', error: result.error });
  return 'failed';
}

// ─── Envio individual com todas as proteções (usado pelo scheduler) ───

export type AbandonedSendResult = 'sent' | 'skipped' | 'failed' | 'window-closed' | 'cap-reached' | 'unconfigured';

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

// ─── Webhook de delivery (Meta) ───

export async function handleDeliveryWebhook(payload: unknown): Promise<void> {
  const obj = (payload && typeof payload === 'object' ? payload : null) as Record<string, any> | null;
  const entries = obj?.entry;
  if (!Array.isArray(entries)) return;

  const supabase = getAdminSupabase();
  if (!supabase) return;

  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change?.value || {};
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const st of statuses) {
        const status = st?.status;
        const waId = st?.recipient_id;
        if (!status || !waId) continue;
        const dbStatus = status === 'failed' ? 'failed' : status === 'delivered' || status === 'read' ? 'delivered' : null;
        if (!dbStatus) continue;

        const err = st?.errors?.[0];
        const update: Record<string, unknown> = {
          status: dbStatus,
          error: err?.message ? err.message : null,
        };
        if (typeof st?.message?.id === 'string') update.message_id = st.message.id;

        try {
          const { data: rows } = await supabase
            .from('whatsapp_send_log')
            .select('id')
            .eq('phone', waId)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })
            .limit(1);
          if (rows?.[0]?.id) {
            await supabase.from('whatsapp_send_log').update(update).eq('id', rows[0].id);
            logInfo('[WhatsApp] Estado de entrega atualizado', { waId, status: dbStatus });
          }
        } catch (err) {
          logError('[WhatsApp] Erro ao processar webhook', err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
  }
}
