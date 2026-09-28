import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type CapiModule = typeof import('../services/metaPixelCapi');

let mod: CapiModule;
const fetchMock = vi.fn();

function okResponse(eventsReceived = 1) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ events_received: eventsReceived }),
    text: async () => '',
  };
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => `{"error":{"message":"HTTP ${status}"}}`,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('META_PIXEL_ID', '1928777041139855');
  vi.stubEnv('META_ACCESS_TOKEN', 'test-token');
  vi.stubEnv('APP_URL', '');
  fetchMock.mockReset().mockResolvedValue(okResponse());
  vi.stubGlobal('fetch', fetchMock);
  mod = await import('../services/metaPixelCapi');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('generateServerEventId', () => {
  it('é determinístico e tem 16 chars hex (tem de bater com o generateEventId do browser)', () => {
    const a = mod.generateServerEventId('req-1', 'Purchase');
    const b = mod.generateServerEventId('req-1', 'Purchase');
    const other = mod.generateServerEventId('req-2', 'Purchase');
    expect(a).toBe(b);
    expect(a).not.toBe(other);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('sendPurchaseEvent', () => {
  it('devolve true em HTTP 200', async () => {
    const ok = await mod.sendPurchaseEvent({
      eventId: 'evt-1',
      email: 'a@b.pt',
      value: 7900,
      currency: 'AOA',
      contentName: 'standard',
    });
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('4xx NÃO conta como sucesso (bug: era retornado true e gravava a flag)', async () => {
    fetchMock.mockResolvedValue(errorResponse(400));
    const ok = await mod.sendPurchaseEvent({ eventId: 'evt-400', value: 7900, currency: 'AOA' });
    expect(ok).toBe(false);
    // 4xx é erro de pedido/configuração — reenviar não resolve, por isso só 1 tentativa
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401 (token inválido) também devolve false', async () => {
    fetchMock.mockResolvedValue(errorResponse(401));
    expect(await mod.sendPurchaseEvent({ eventId: 'evt-401', value: 1, currency: 'AOA' })).toBe(false);
  });

  it('5xx tenta 3 vezes e devolve false', async () => {
    fetchMock.mockResolvedValue(errorResponse(500));
    const ok = await mod.sendPurchaseEvent({ eventId: 'evt-500', value: 1, currency: 'AOA' });
    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 15000);

  it('envia fbp/fbc em user_data SEM hash e order_id em custom_data', async () => {
    await mod.sendPurchaseEvent({
      eventId: 'evt-2',
      email: 'a@b.pt',
      value: 7900,
      currency: 'AOA',
      contentName: 'standard',
      orderId: 'pay-123',
      fbp: 'fb.1.1234567890',
      fbc: 'fb.1.abc123',
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const event = payload.data[0];
    expect(event.user_data.fbp).toBe('fb.1.1234567890');
    expect(event.user_data.fbc).toBe('fb.1.abc123');
    expect(event.custom_data.order_id).toBe('pay-123');
    expect(event.custom_data.value).toBe(7900);
    expect(event.custom_data.currency).toBe('AOA');
    expect(event.action_source).toBe('website');
    expect(payload.access_token).toBe('test-token');
  });

  it('usa o domínio real quando não há referer (não seubeat.ao, que não existe em DNS)', async () => {
    await mod.sendPurchaseEvent({ eventId: 'evt-3', value: 1, currency: 'AOA' });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.data[0].event_source_url).toBe('https://seubeat.onrender.com');
  });
});

describe('sendRefundEvent', () => {
  it('envia o evento Refund com o valor em AOA', async () => {
    const ok = await mod.sendRefundEvent({
      eventId: 'evt-refund',
      email: 'a@b.pt',
      value: 9900,
      currency: 'AOA',
      contentName: 'express',
      orderId: 'pay-9',
    });
    expect(ok).toBe(true);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.data[0].event_name).toBe('Refund');
    expect(payload.data[0].event_id).toBe('evt-refund');
    expect(payload.data[0].custom_data).toMatchObject({ value: 9900, currency: 'AOA', order_id: 'pay-9' });
  });
});

describe('eventos de checkout', () => {
  it('InitiateCheckout / AddPaymentInfo / SubmitApplication usam o event_id fornecido', async () => {
    await mod.sendInitiateCheckoutEvent({ eventId: 'ic-1', value: 7900, currency: 'AOA' });
    await mod.sendAddPaymentInfoEvent({ eventId: 'api-1', value: 7900, currency: 'AOA' });
    await mod.sendSubmitApplicationEvent({ eventId: 'sa-1', value: 7900, currency: 'AOA' });

    const names = fetchMock.mock.calls.map(call => JSON.parse(call[1].body as string).data[0]);
    expect(names.map(e => e.event_name)).toEqual(['InitiateCheckout', 'AddPaymentInfo', 'SubmitApplication']);
    expect(names.map(e => e.event_id)).toEqual(['ic-1', 'api-1', 'sa-1']);
  });
});
