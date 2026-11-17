import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authorizeComAmorOrder,
  ComAmorIntegrationError,
  sendComAmorCallback,
  signCallback,
  verifyCallbackSignature,
} from '../services/comamor/client';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAMPAIGN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TOKEN = 'test-server-token-never-real';
const SECRET = 'test-webhook-secret-never-real';

function configure() {
  vi.stubEnv('COMAMOR_INTEGRATION_ENABLED', 'true');
  vi.stubEnv('COMAMOR_API_BASE_URL', 'https://comamor.example');
  vi.stubEnv('COMAMOR_INTEGRATION_TOKEN', TOKEN);
  vi.stubEnv('COMAMOR_VERCEL_PROTECTION_BYPASS', 'preview-bypass-test-only');
  vi.stubEnv('SEUBEAT_WEBHOOK_SECRET', SECRET);
  vi.stubEnv('COMAMOR_AUDIO_ALLOWED_HOSTS', 'audio.seubeat.example');
  vi.stubEnv('NODE_ENV', 'test');
}

function validAuthorization(orderId = ORDER_ID) {
  return {
    ok: true,
    authorization: {
      order_id: orderId,
      campaign_id: CAMPAIGN_ID,
      product: 'personalized_song',
      occasion: 'Aniversário',
      generation_attempt: 1,
      idempotency_key: `${orderId}:1`,
      status: 'authorized',
    },
  };
}

describe('ComAmor server client', () => {
  beforeEach(() => configure());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('authorizes only a matching paid order and keeps the token server-side', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validAuthorization()), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authorizeComAmorOrder(ORDER_ID)).resolves.toMatchObject({
      orderId: ORDER_ID, campaignId: CAMPAIGN_ID, generationAttempt: 1, idempotencyKey: `${ORDER_ID}:1`,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://comamor.example/api/seubeat-authorize', expect.objectContaining({
      method: 'POST', redirect: 'manual',
      headers: expect.objectContaining({ authorization: `Bearer ${TOKEN}` }),
      body: JSON.stringify({ orderId: ORDER_ID }),
    }));
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('x-vercel-protection-bypass')).toBe('preview-bypass-test-only');
  });

  it('omits the Vercel bypass header when no preview bypass is configured', async () => {
    vi.stubEnv('COMAMOR_VERCEL_PROTECTION_BYPASS', '');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validAuthorization()), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await authorizeComAmorOrder(ORDER_ID);
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.has('x-vercel-protection-bypass')).toBe(false);
  });

  it('rejects a ComAmor response for a different order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validAuthorization(CAMPAIGN_ID)), { status: 200 })));
    await expect(authorizeComAmorOrder(ORDER_ID)).rejects.toMatchObject({ code: 'invalid_authorization', statusCode: 503 });
  });

  it('maps a ComAmor 403 to a not-authorized response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    await expect(authorizeComAmorOrder(ORDER_ID)).rejects.toMatchObject({ code: 'not_authorized', statusCode: 403 });
  });

  it('does not expose upstream credential rejection details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(authorizeComAmorOrder(ORDER_ID)).rejects.toMatchObject({
      code: 'authorization_unavailable', statusCode: 503,
      message: 'A integração precisa de ser verificada.',
    });
  });

  it('returns 503 without contacting ComAmor when the feature is off or secrets are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('COMAMOR_INTEGRATION_ENABLED', 'false');
    await expect(authorizeComAmorOrder(ORDER_ID)).rejects.toMatchObject({ code: 'integration_disabled', statusCode: 503 });
    vi.stubEnv('COMAMOR_INTEGRATION_ENABLED', 'true');
    vi.stubEnv('COMAMOR_INTEGRATION_TOKEN', '');
    await expect(authorizeComAmorOrder(ORDER_ID)).rejects.toMatchObject({ code: 'integration_not_configured', statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs the exact timestamp and raw JSON and verifies in constant-time-safe format', () => {
    const rawBody = '{"orderId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","status":"generating"}';
    const timestamp = '1794835825';
    const signature = signCallback(timestamp, rawBody, SECRET);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyCallbackSignature(timestamp, rawBody, signature, SECRET, Number(timestamp))).toBe(true);
    expect(verifyCallbackSignature(timestamp, `${rawBody} `, signature, SECRET, Number(timestamp))).toBe(false);
    expect(verifyCallbackSignature(timestamp, rawBody, '0'.repeat(64), SECRET, Number(timestamp))).toBe(false);
    expect(verifyCallbackSignature(timestamp, rawBody, signature, SECRET, Number(timestamp) + 301)).toBe(false);
  });

  it('refuses an audio URL whose host is not allowlisted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const body = JSON.stringify({ status: 'completed', audioUrl: 'https://evil.example/song.mp3' });
    await expect(sendComAmorCallback(body)).rejects.toBeInstanceOf(ComAmorIntegrationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects expiring or tokenized audio URLs even on an allowed host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const body = JSON.stringify({ status: 'completed', audioUrl: 'https://audio.seubeat.example/song.mp3?token=secret' });
    await expect(sendComAmorCallback(body)).rejects.toMatchObject({ code: 'audio_host_not_allowed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a callback with a valid HMAC and no redirect following', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = JSON.stringify({
      orderId: ORDER_ID, jobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      generationAttempt: 1, status: 'completed', title: 'Canção',
      genre: 'Semba', audioUrl: 'https://audio.seubeat.example/files/song.mp3',
    });

    await sendComAmorCallback(body);
    const call = fetchMock.mock.calls[0];
    const options = call[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get('x-vercel-protection-bypass')).toBe('preview-bypass-test-only');
    expect(call[0]).toBe('https://comamor.example/api/seubeat-result');
    expect(options.redirect).toBe('manual');
    expect(options.body).toBe(body);
    expect(verifyCallbackSignature(
      headers.get('x-seubeat-timestamp')!, body,
      headers.get('x-seubeat-signature')!, SECRET,
    )).toBe(true);
  });
});
