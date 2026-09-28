import crypto from 'node:crypto';
import { getEnv } from '../config/env';
import { logError, logInfo, logWarn } from '../utils/logger';

const PIXEL_ID = getEnv('META_PIXEL_ID', '');
const ACCESS_TOKEN = getEnv('META_ACCESS_TOKEN', '');
const IS_ENABLED = Boolean(PIXEL_ID && ACCESS_TOKEN);
// v25.0 (Graph corrente desde 18/Fev/2026); v21.0 expira 21/Jan/2027 → fallback silencioso
const API_VERSION = 'v25.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 5000;
// Fallback só é usado quando não há referer — tem de ser um domínio real (seubeat.ao não existe em DNS)
const FALLBACK_EVENT_URL = 'https://seubeat.onrender.com';

// Deterministic eventId generator (must match client's generateEventId exactly)
export function generateServerEventId(requestId: string, eventName: string): string {
  let hash = 0;
  const str = `${eventName}:${requestId}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function hashPhone(phone: string): string {
  // Spec Meta (Customer Information Parameters): normalizar para só dígitos com
  // country code, sem símbolos — "+244 922 000 000" → "244922000000".
  // O '+' mantido no hash anterior nunca casava com o hash da Meta.
  const digits = phone.replace(/\D/g, '');
  const normalized = /^\d{9}$/.test(digits) ? `244${digits}` : digits;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function hashGeneric(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPayload(params: {
  eventName: string;
  eventId: string;
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentType?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  orderId?: string;
  zip?: string;
  dob?: string;
  fn?: string;
  ln?: string;
  gen?: string;
  country?: string;
  ct?: string;
  st?: string;
}) {
  const { eventName, eventId, email, phone, value, currency, contentName, contentType, eventSourceUrl, clientIp, clientUserAgent, externalId, fbp, fbc, orderId, zip, dob, fn, ln, gen, country, ct, st } = params;

  const userData: Record<string, unknown> = {};
  if (email) userData.em = [hashEmail(email)];
  if (phone) userData.ph = [hashPhone(phone)];
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (externalId) userData.external_id = hashEmail(externalId);
  // fbp/fbc chegam do browser e NÃO são hasheados (formato Meta: "fb.1.<id>")
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (zip) userData.zp = [hashGeneric(zip)];
  if (dob) userData.db = [hashGeneric(dob)];
  if (fn) userData.fn = [hashGeneric(fn)];
  if (ln) userData.ln = [hashGeneric(ln)];
  if (gen) userData.gen = [hashGeneric(gen)];
  if (country) userData.country = [hashGeneric(country)];
  if (ct) userData.ct = [hashGeneric(ct)];
  if (st) userData.st = [hashGeneric(st)];

  const customData: Record<string, unknown> = {};
  if (value !== undefined) customData.value = value;
  if (currency) customData.currency = currency;
  if (contentName) customData.content_name = contentName;
  if (contentType) customData.content_type = contentType;
  if (orderId) customData.order_id = orderId;

  return {
    data: [
      {
        event_name: eventName,
        event_time: unixNow(),
        event_id: eventId,
        user_data: userData,
        ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
        action_source: 'website',
        event_source_url: eventSourceUrl || getEnv('APP_URL', FALLBACK_EVENT_URL),
      },
    ],
    access_token: ACCESS_TOKEN,
  };
}

// 'success' = aceite pela Meta · 'retry' = falha transitória (5xx/timeout) · 'fail' = falha terminal (4xx/sem config)
type SendOutcome = 'success' | 'retry' | 'fail';

async function attemptSend(payload: ReturnType<typeof buildPayload>, attempt: number): Promise<SendOutcome> {
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          logWarn(`[MetaCAPI] Tentativa ${attempt}/${MAX_RETRIES} falhou (HTTP ${res.status}), reenviando...`, { response: body });
          return 'retry';
        }
        logError('[MetaCAPI] Erro ao enviar evento (5xx após retries)', new Error(`HTTP ${res.status}`), { response: body, attempt, eventName: payload.data[0].event_name });
        return 'fail';
      }
      // 4xx: erro de pedido/configuração — reenviar não resolve e NÃO pode contar como sucesso
      logError('[MetaCAPI] Erro ao enviar evento (HTTP 4xx)', new Error(`HTTP ${res.status}`), { response: body, attempt, eventName: payload.data[0].event_name, eventId: payload.data[0].event_id });
      return 'fail';
    }

    const json = await res.json();
    logInfo('[MetaCAPI] Evento enviado com sucesso', { eventName: payload.data[0].event_name, eventId: payload.data[0].event_id, eventsReceived: json.events_received });
    return 'success';
  } catch (err: unknown) {
    if (attempt < MAX_RETRIES) {
      logWarn(`[MetaCAPI] Tentativa ${attempt}/${MAX_RETRIES} falhou (rede/timeout), reenviando...`, { error: err instanceof Error ? err.message : String(err) });
      return 'retry';
    }
    logError('[MetaCAPI] Erro de rede ao enviar evento após todas as tentativas', err instanceof Error ? err : new Error(String(err)));
    return 'fail';
  }
}

async function sendEvent(params: {
  eventName: string;
  eventId: string;
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentType?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  orderId?: string;
  zip?: string;
  dob?: string;
  fn?: string;
  ln?: string;
  gen?: string;
  country?: string;
  ct?: string;
  st?: string;
}): Promise<boolean> {
  if (!IS_ENABLED) {
    logWarn('[MetaCAPI] CAPI desativado — META_PIXEL_ID ou META_ACCESS_TOKEN em falta', { eventName: params.eventName, eventId: params.eventId });
    return false;
  }

  const payload = buildPayload(params);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const outcome = await attemptSend(payload, attempt);
    if (outcome === 'success') return true;
    if (outcome === 'fail') return false;
    if (attempt < MAX_RETRIES) {
      await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  return false;
}

interface PaymentEventParams {
  eventId: string;
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  orderId?: string;
  ln?: string;
}

export async function sendInitiateCheckoutEvent(params: PaymentEventParams): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'InitiateCheckout', contentType: 'product' });
}

export async function sendAddPaymentInfoEvent(params: PaymentEventParams): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'AddPaymentInfo', contentType: 'product' });
}

export async function sendPurchaseEvent(params: PaymentEventParams & { value: number }): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'Purchase', contentType: 'product' });
}

export async function sendSubmitApplicationEvent(params: PaymentEventParams): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'SubmitApplication', contentType: 'product' });
}

// Evento negativo: dispara quando um pagamento é rejeitado (manual ou auto) para o Meta aprender
// o que NÃO é uma venda bem-sucedida (antes só havia Purchase, nunca o sinal inverso).
export async function sendRefundEvent(params: PaymentEventParams): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'Refund', contentType: 'product' });
}

export async function sendLeadEvent(params: {
  eventId: string;
  email?: string;
  phone?: string;
  contentName?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  ln?: string;
}): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'Lead', contentType: 'product' });
}

export async function sendCompleteRegistrationEvent(params: {
  eventId: string;
  email?: string;
  phone?: string;
  fn?: string;
  ln?: string;
  gen?: string;
  country?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
}): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'CompleteRegistration', contentType: 'product' });
}
