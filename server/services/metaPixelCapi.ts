import crypto from 'node:crypto';
import { getEnv } from '../config/env';
import { logError, logInfo, logWarn } from '../utils/logger';

const PIXEL_ID = getEnv('META_PIXEL_ID', '');
const ACCESS_TOKEN = getEnv('META_ACCESS_TOKEN', '');
const IS_ENABLED = Boolean(PIXEL_ID && ACCESS_TOKEN);
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function hashPhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '').trim();
  return crypto.createHash('sha256').update(cleaned).digest('hex');
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
  email: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentType?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  zip?: string;
  dob?: string;
  ln?: string;
  ct?: string;
  st?: string;
}) {
  const { eventName, eventId, email, phone, value, currency, contentName, contentType, eventSourceUrl, clientIp, clientUserAgent, externalId, zip, dob, ln, ct, st } = params;

  const userData: Record<string, any> = {
    em: [hashEmail(email)],
  };
  if (phone) userData.ph = [hashPhone(phone)];
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (externalId) userData.external_id = hashEmail(externalId);
  if (zip) userData.zp = [hashGeneric(zip)];
  if (dob) userData.db = [hashGeneric(dob)];
  if (ln) userData.ln = [hashGeneric(ln)];
  if (ct) userData.ct = [hashGeneric(ct)];
  if (st) userData.st = [hashGeneric(st)];

  const customData: Record<string, any> = {};
  if (value !== undefined) customData.value = value;
  if (currency) customData.currency = currency;
  if (contentName) customData.content_name = contentName;
  if (contentType) customData.content_type = contentType;

  return {
    data: [
      {
        event_name: eventName,
        event_time: unixNow(),
        event_id: eventId,
        user_data: userData,
        ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
        action_source: 'website',
        event_source_url: eventSourceUrl || getEnv('APP_URL', 'https://seubeat.ao'),
      },
    ],
    access_token: ACCESS_TOKEN,
  };
}

async function attemptSend(payload: ReturnType<typeof buildPayload>, attempt: number): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      if (attempt < MAX_RETRIES && res.status >= 500) {
        logWarn(`[MetaCAPI] Tentativa ${attempt}/${MAX_RETRIES} falhou (HTTP ${res.status}), reenviando...`, { response: body });
        return false;
      }
      logError('[MetaCAPI] Erro ao enviar evento', new Error(`HTTP ${res.status}`), { response: body, attempt, eventName: payload.data[0].event_name });
      return res.status >= 500 ? false : true;
    }

    const json = await res.json();
    logInfo('[MetaCAPI] Evento enviado com sucesso', { eventName: payload.data[0].event_name, eventId: payload.data[0].event_id, eventsReceived: json.events_received });
    return true;
  } catch (err: any) {
    if (attempt < MAX_RETRIES) {
      logWarn(`[MetaCAPI] Tentativa ${attempt}/${MAX_RETRIES} falhou (rede), reenviando...`, { error: err.message });
      return false;
    }
    logError('[MetaCAPI] Erro de rede ao enviar evento após todas as tentativas', err);
    return false;
  }
}

async function sendEvent(params: {
  eventName: string;
  eventId: string;
  email: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentType?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  zip?: string;
  dob?: string;
  ln?: string;
  ct?: string;
  st?: string;
}): Promise<boolean> {
  if (!IS_ENABLED) return false;

  const payload = buildPayload(params);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ok = await attemptSend(payload, attempt);
    if (ok) return true;
    if (attempt < MAX_RETRIES) {
      await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  return false;
}

export async function sendPurchaseEvent(params: {
  eventId: string;
  email: string;
  phone?: string;
  value: number;
  currency?: string;
  contentName?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  ln?: string;
}): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'Purchase', contentType: 'product' });
}

export async function sendSubmitApplicationEvent(params: {
  eventId: string;
  email: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string;
  ln?: string;
}): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'SubmitApplication', contentType: 'product' });
}

export async function sendLeadEvent(params: {
  eventId: string;
  email: string;
  phone?: string;
  contentName?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  ln?: string;
}): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'Lead', contentType: 'product' });
}

export async function sendCompleteRegistrationEvent(params: {
  eventId: string;
  email: string;
  phone?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
}): Promise<boolean> {
  return sendEvent({ ...params, eventName: 'CompleteRegistration', contentType: 'product' });
}
