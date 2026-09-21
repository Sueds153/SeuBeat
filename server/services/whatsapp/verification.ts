import { logInfo, logWarn } from '../../utils/logger';
import { GRAPH_API_VERSION, API_TOKEN, PHONE_NUMBER_ID, isConfigured } from './config';
import { mapWhatsAppApiError } from './errors';

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
): Promise<{ ok: boolean; error?: string; metaCode?: number; metaRaw?: unknown }> {
  if (!isConfigured()) return { ok: false, error: 'WhatsApp API não configurada.' };
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/request_code?code_method=${method}&language=${encodeURIComponent(language)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${API_TOKEN}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapWhatsAppApiError(res.status, data);
      logWarn('[WhatsApp] request_code falhou', {
        status: res.status,
        metaCode: mapped.code,
        metaMessage: mapped.message,
        metaRaw: data,
      });
      return { ok: false, error: mapped.message, metaCode: mapped.code, metaRaw: data };
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
