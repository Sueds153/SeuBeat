import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ComAmorAuthorization {
  orderId: string;
  campaignId: string;
  occasion: string;
  generationAttempt: number;
  idempotencyKey: string;
}

export class ComAmorIntegrationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ComAmorIntegrationError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_AUTH_RESPONSE_BYTES = 16 * 1024;

async function readJsonResponse(response: Response): Promise<unknown> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_AUTH_RESPONSE_BYTES) throw new Error('response_too_large');
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('invalid_content_type');
  if (!response.body) throw new Error('empty_response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_AUTH_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('response_too_large');
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8');
  return JSON.parse(raw);
}

function config() {
  const enabled = process.env.COMAMOR_INTEGRATION_ENABLED === 'true';
  const baseUrl = process.env.COMAMOR_API_BASE_URL || '';
  const token = process.env.COMAMOR_INTEGRATION_TOKEN || '';
  const webhookSecret = process.env.SEUBEAT_WEBHOOK_SECRET || '';
  const allowedAudioHosts = (process.env.COMAMOR_AUDIO_ALLOWED_HOSTS || '')
    .split(',').map(host => host.trim().toLowerCase()).filter(Boolean);

  if (!enabled) throw new ComAmorIntegrationError('Integração indisponível.', 503, 'integration_disabled');
  if (!baseUrl || !token || !webhookSecret || allowedAudioHosts.length === 0) {
    throw new ComAmorIntegrationError('Integração ainda não configurada.', 503, 'integration_not_configured');
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ComAmorIntegrationError('Integração ainda não configurada.', 503, 'integration_not_configured');
  }
  const allowLocalHttp = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !allowLocalHttp) || parsed.username || parsed.password
    || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new ComAmorIntegrationError('Integração ainda não configurada.', 503, 'integration_not_configured');
  }
  return { enabled, baseUrl: parsed.toString().replace(/\/$/, ''), token, webhookSecret, allowedAudioHosts };
}

export function isComAmorIntegrationEnabled(): boolean {
  return process.env.COMAMOR_INTEGRATION_ENABLED === 'true';
}

export async function authorizeComAmorOrder(orderId: string): Promise<ComAmorAuthorization> {
  if (!UUID_RE.test(orderId)) throw new ComAmorIntegrationError('Referência inválida.', 400, 'invalid_order');
  const settings = config();

  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}/api/seubeat-authorize`, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${settings.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    throw new ComAmorIntegrationError('Não foi possível verificar a autorização. Tenta novamente.', 503, 'authorization_unavailable');
  }

  if (response.status === 401) throw new ComAmorIntegrationError('A integração precisa de ser verificada.', 503, 'authorization_unavailable');
  if (response.status === 403) throw new ComAmorIntegrationError('Este pedido ainda não está autorizado.', 403, 'not_authorized');
  if (!response.ok) throw new ComAmorIntegrationError('Não foi possível verificar a autorização. Tenta novamente.', 503, 'authorization_unavailable');

  let body: unknown;
  try {
    body = await readJsonResponse(response);
  } catch {
    throw new ComAmorIntegrationError('Resposta de autorização inválida.', 503, 'invalid_authorization');
  }
  const envelope = body as { ok?: unknown; authorization?: Record<string, unknown> };
  const auth = envelope?.authorization;
  if (envelope?.ok !== true || !auth || auth.status !== 'authorized'
    || auth.order_id !== orderId || auth.product !== 'personalized_song'
    || typeof auth.campaign_id !== 'string' || !UUID_RE.test(auth.campaign_id)
    || !Number.isSafeInteger(auth.generation_attempt) || Number(auth.generation_attempt) < 1
    || auth.idempotency_key !== `${orderId}:${String(auth.generation_attempt)}`
    || typeof auth.occasion !== 'string' || auth.occasion.trim().length < 1 || auth.occasion.length > 100) {
    throw new ComAmorIntegrationError('Resposta de autorização inválida.', 503, 'invalid_authorization');
  }

  return {
    orderId,
    campaignId: auth.campaign_id,
    occasion: auth.occasion.trim(),
    generationAttempt: Number(auth.generation_attempt),
    idempotencyKey: String(auth.idempotency_key),
  };
}

export function signCallback(timestamp: string, rawBody: string, secret = config().webhookSecret): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}

export function verifyCallbackSignature(
  timestamp: string,
  rawBody: string,
  signature: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300
): boolean {
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(nowSeconds - seconds) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function assertAllowedComAmorAudioUrl(value: string): string {
  const settings = config();
  let audioUrl: URL;
  try { audioUrl = new URL(value); } catch {
    throw new ComAmorIntegrationError('URL de áudio inválido.', 503, 'invalid_audio_url');
  }
  if (audioUrl.protocol !== 'https:' || audioUrl.username || audioUrl.password || audioUrl.port
    || audioUrl.search || audioUrl.hash
    || !settings.allowedAudioHosts.includes(audioUrl.hostname.toLowerCase())) {
    throw new ComAmorIntegrationError('Host de áudio fora da lista permitida.', 503, 'audio_host_not_allowed');
  }
  return audioUrl.toString();
}

export async function sendComAmorCallback(rawBody: string): Promise<void> {
  const settings = config();
  const payload = JSON.parse(rawBody) as { status?: string; audioUrl?: string };
  if (payload.status === 'completed') assertAllowedComAmorAudioUrl(String(payload.audioUrl || ''));

  const timestamp = String(Math.floor(Date.now() / 1000));
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}/api/seubeat-result`, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'x-seubeat-timestamp': timestamp,
        'x-seubeat-signature': signCallback(timestamp, rawBody, settings.webhookSecret),
      },
      body: rawBody,
    });
  } catch {
    throw new ComAmorIntegrationError('Callback temporariamente indisponível.', 503, 'callback_unavailable');
  }
  if (!response.ok) throw new ComAmorIntegrationError('Callback temporariamente indisponível.', 503, 'callback_unavailable');
}
