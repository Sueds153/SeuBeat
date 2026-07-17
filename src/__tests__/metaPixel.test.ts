import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete (window as any).fbq;
  delete (window as any)._fbq;
});

describe('parsePrice', () => {
  it('converts "7.900 Kz" to 7900', async () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '1');
    const { parsePrice } = await import('../lib/metaPixel');
    expect(parsePrice('7.900 Kz')).toBe(7900);
  });

  it('converts "9.900 Kz" to 9900', async () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '1');
    const { parsePrice } = await import('../lib/metaPixel');
    expect(parsePrice('9.900 Kz')).toBe(9900);
  });

  it('converts "14.900 Kz" to 14900', async () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '1');
    const { parsePrice } = await import('../lib/metaPixel');
    expect(parsePrice('14.900 Kz')).toBe(14900);
  });
});

describe('metaPixel with VITE_META_PIXEL_ID set', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_META_PIXEL_ID', '1928777041139855');
  });

  it('initMetaPixel sets up fbq and fires PageView', async () => {
    const { initMetaPixel } = await import('../lib/metaPixel');
    initMetaPixel();

    expect(window.fbq).toBeDefined();
    expect(typeof window.fbq).toBe('function');
    expect(window._fbq).toBeDefined();
    expect((window.fbq as any).version).toBe('2.0');
    expect(Array.isArray((window.fbq as any).queue)).toBe(true);
  });

  it('initMetaPixel only runs once', async () => {
    const { initMetaPixel } = await import('../lib/metaPixel');
    initMetaPixel();
    const fbqRef = window.fbq;
    initMetaPixel();
    expect(window.fbq).toBe(fbqRef);
  });

  it('fbPageView queues a PageView event', async () => {
    const { initMetaPixel, fbPageView } = await import('../lib/metaPixel');
    initMetaPixel();
    fbPageView();
    expect((window.fbq as any).queue.length).toBeGreaterThanOrEqual(2);
  });

  it('fbInitiateCheckout queues InitiateCheckout with value and eventID', async () => {
    const { initMetaPixel, fbInitiateCheckout } = await import('../lib/metaPixel');
    initMetaPixel();
    fbInitiateCheckout('standard', 7900, 'AOA', 'evt-123');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('InitiateCheckout');
    expect(lastCall[2].value).toBe(7900);
    expect(lastCall[2].event_source_url).toBe(window.location.href);
    expect(lastCall[3]).toEqual({ eventID: 'evt-123' });
  });

  it('fbAddPaymentInfo queues AddPaymentInfo with plan and eventID', async () => {
    const { initMetaPixel, fbAddPaymentInfo } = await import('../lib/metaPixel');
    initMetaPixel();
    fbAddPaymentInfo('premium', 14900, 'AOA', 'evt-456');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('AddPaymentInfo');
    expect(lastCall[2].content_name).toBe('premium');
    expect(lastCall[2].event_source_url).toBe(window.location.href);
    expect(lastCall[3]).toEqual({ eventID: 'evt-456' });
  });

  it('fbLead queues Lead event with eventID', async () => {
    const { initMetaPixel, fbLead } = await import('../lib/metaPixel');
    initMetaPixel();
    fbLead('lyrics_generated', 'evt-789');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('Lead');
    expect(lastCall[2].content_name).toBe('lyrics_generated');
    expect(lastCall[2].event_source_url).toBe(window.location.href);
    expect(lastCall[3]).toEqual({ eventID: 'evt-789' });
  });

  it('fbPurchase queues Purchase with value, currency, and eventID', async () => {
    const { initMetaPixel, fbPurchase } = await import('../lib/metaPixel');
    initMetaPixel();
    fbPurchase('express', 9900, 'AOA', 'purchase-evt-001');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('Purchase');
    expect(lastCall[2].value).toBe(9900);
    expect(lastCall[2].currency).toBe('AOA');
    expect(lastCall[2].event_source_url).toBe(window.location.href);
    expect(lastCall[3]).toEqual({ eventID: 'purchase-evt-001' });
  });

  it('fbPurchase passes undefined eventID when omitted', async () => {
    const { initMetaPixel, fbPurchase } = await import('../lib/metaPixel');
    initMetaPixel();
    fbPurchase('express', 9900);
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[3]).toEqual({ eventID: undefined });
  });

  it('fbSubmitApplication queues SubmitApplication with value and eventID', async () => {
    const { initMetaPixel, fbSubmitApplication } = await import('../lib/metaPixel');
    initMetaPixel();
    fbSubmitApplication('standard', 7900, 'AOA', 'sub-evt-001');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('SubmitApplication');
    expect(lastCall[2].content_name).toBe('standard');
    expect(lastCall[2].value).toBe(7900);
    expect(lastCall[2].currency).toBe('AOA');
    expect(lastCall[2].content_type).toBe('product');
    expect(lastCall[2].event_source_url).toBe(window.location.href);
    expect(lastCall[3]).toEqual({ eventID: 'sub-evt-001' });
  });

  it('fbSubmitApplication passes undefined eventID when omitted', async () => {
    const { initMetaPixel, fbSubmitApplication } = await import('../lib/metaPixel');
    initMetaPixel();
    fbSubmitApplication('premium', 14900);
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('SubmitApplication');
    expect(lastCall[3]).toEqual({ eventID: undefined });
  });

  it('fbSetUserData sets email via fbq set', async () => {
    const { initMetaPixel, fbSetUserData } = await import('../lib/metaPixel');
    initMetaPixel();
    fbSetUserData('teste@exemplo.com');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[0]).toBe('set');
    expect(lastCall[1]).toBe('userData');
    expect(lastCall[2].em).toBe('teste@exemplo.com');
  });

  it('fbSetUserData sets email and phone', async () => {
    const { initMetaPixel, fbSetUserData } = await import('../lib/metaPixel');
    initMetaPixel();
    fbSetUserData('teste@exemplo.com', '+244 922 000 000');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[0]).toBe('set');
    expect(lastCall[1]).toBe('userData');
    expect(lastCall[2].em).toBe('teste@exemplo.com');
    expect(lastCall[2].ph).toBe('+244 922 000 000');
  });

  it('fbSetUserData does nothing when both email and phone empty', async () => {
    const { initMetaPixel, fbSetUserData } = await import('../lib/metaPixel');
    initMetaPixel();
    const queueLen = (window.fbq as any).queue.length;
    fbSetUserData('');
    expect((window.fbq as any).queue.length).toBe(queueLen);
  });
});

describe('metaPixel without VITE_META_PIXEL_ID', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_META_PIXEL_ID', '');
  });

  it('initMetaPixel does nothing when env var is empty', async () => {
    const { initMetaPixel } = await import('../lib/metaPixel');
    initMetaPixel();
    expect(window.fbq).toBeUndefined();
  });

  it('event functions are no-ops when pixel is not configured', async () => {
    const { fbPageView, fbLead, fbPurchase, fbSubmitApplication, fbSetUserData } = await import('../lib/metaPixel');
    expect(() => {
      fbPageView();
      fbLead('test');
      fbPurchase('standard', 7900);
      fbSubmitApplication('standard', 7900);
      fbSetUserData('teste@exemplo.com');
    }).not.toThrow();
  });
});
