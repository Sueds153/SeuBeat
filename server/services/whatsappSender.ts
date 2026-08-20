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
  const sentToday = await getDailySentCount();
  const verification = await getPhoneNumberVerificationStatus().catch((): PhoneNumberVerification => ({ status: null }));
  return {
    configured: isConfigured(),
    phone: WHATSAPP_PHONE,
    phoneNumberId: isConfigured() ? PHONE_NUMBER_ID : null,
    dailyCap: DAILY_CAP,
    sentToday,
    startHour: START_HOUR,
    endHour: END_HOUR,
    templates: listTemplates(),
    enabledBuckets: enabledWhatsAppBuckets(),
    codeVerificationStatus: verification.status,
    verifiedName: verification.verifiedName || null,
    qualityRating: verification.qualityRating || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificação do número (Meta) — SEM `code_verification_status: VERIFIED` a
// Cloud API bloqueia envios para clientes reais (#100 Invalid parameter).
// ─────────────────────────────────────────────────────────────────────────────

const VERIFICATION_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedVerificationStatus: string | null = null;
let cachedVerificationAt = 0;

export function setCachedVerificationStatus(status: string | null): void {
  cachedVerificationStatus = status;
  cachedVerificationAt = status ? Date.now() : 0;
}

export function getCachedVerificationStatus(): string | null {
  if (!cachedVerificationStatus) return null;
  if (Date.now() - cachedVerificationAt > VERIFICATION_CACHE_TTL_MS) return null;
  return cachedVerificationStatus;
}

const UNVERIFIED_STATUSES = new Set(['NOT_VERIFIED', 'EXPIRED', 'INACTIVE', 'UNVERIFIED']);

/** true quando o estado do número indica que a Meta bloqueia o envio a clientes. */
export function isVerificationBlocked(status: string | null | undefined): boolean {
  return !!status && UNVERIFIED_STATUSES.has(String(status).toUpperCase());
}

export interface PhoneNumberVerification {
  status: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  qualityRating?: string | null;
  error?: string;
}

/** Lê `code_verification_status` do número junto da Meta e atualiza a cache. */
export async function getPhoneNumberVerificationStatus(): Promise<PhoneNumberVerification> {
  if (!isConfigured()) return { status: null };
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}?fields=code_verification_status,display_phone_number,verified_name,quality_rating`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapWhatsAppApiError(res.status, data);
      return { status: null, error: mapped.message };
    }
    const status: string | null =
      typeof data?.code_verification_status === 'string' ? data.code_verification_status : null;
    setCachedVerificationStatus(status);
    return {
      status,
      displayPhoneNumber: typeof data?.display_phone_number === 'string' ? data.display_phone_number : null,
      verifiedName: typeof data?.verified_name === 'string' ? data.verified_name : null,
      qualityRating: typeof data?.quality_rating === 'string' ? data.quality_rating : null,
    };
  } catch (err) {
    logWarn('[WhatsApp] Falha ao ler estado de verificação do número', { phoneNumberId: PHONE_NUMBER_ID });
    return { status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Pede o código de verificação (SMS ou chamada) para o dono do número. */
export async function requestVerificationCode(
  method: 'SMS' | 'VOICE' = 'SMS',
  language = 'en_US'
): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: false, error: 'WhatsApp API não configurada.' };
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/request_code?code_method=${method}&language=${encodeURIComponent(language)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${API_TOKEN}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapWhatsAppApiError(res.status, data);
      return { ok: false, error: mapped.message };
    }
    logInfo('[WhatsApp] Código de verificação pedido', { method, phoneNumberId: PHONE_NUMBER_ID });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Confirma o código de verificação recebido pelo dono do número. */
export async function submitVerificationCode(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: false, error: 'WhatsApp API não configurada.' };
  const clean = String(code || '').trim();
  if (!/^\d{4,8}$/.test(clean)) {
    return { ok: false, error: 'Código de verificação inválido (deve ser numérico).' };
  }
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/verify_code`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: clean }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapWhatsAppApiError(res.status, data);
      return { ok: false, error: mapped.message };
    }
    // Limpa a cache para forçar nova leitura do estado (espera-se VERIFIED).
    setCachedVerificationStatus(null);
    logInfo('[WhatsApp] Código de verificação submetido com sucesso');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** true quando é seguro tentar enviar (número verificado OU não configurado/estado desconhecido). */
export async function isWhatsAppVerificationOk(): Promise<boolean> {
  if (!isConfigured()) return true;
  const cached = getCachedVerificationStatus();
  if (cached) return !isVerificationBlocked(cached);
  const info = await getPhoneNumberVerificationStatus();
  if (info.status) return !isVerificationBlocked(info.status);
  return true;
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

const WHATSAPP_FLAG_BY_BUCKET: Record<string, string> = {
  '30min': 'whatsapp_30min_sent_at',
  '24h': 'whatsapp_24h_sent_at',
  '48h': 'whatsapp_48h_sent_at',
  '72h': 'whatsapp_72h_sent_at',
};

/** Marca a flag WhatsApp do bucket (dedupe do scheduler) após envio com sucesso. */
async function markBucketSent(requestId: string, bucket: string | undefined) {
  const flag = WHATSAPP_FLAG_BY_BUCKET[bucket as string];
  if (!flag) return;
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('song_requests')
      .update({ [flag]: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    logError('[WhatsApp] Erro ao marcar flag de envio', err instanceof Error ? err : new Error(String(err)));
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

export type AbandonedSendResult =
  | 'sent'
  | 'skipped'
  | 'failed'
  | 'window-closed'
  | 'cap-reached'
  | 'unconfigured';

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
