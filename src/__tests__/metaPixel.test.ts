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

  it('fbViewContent queues ViewContent with params', async () => {
    const { initMetaPixel, fbViewContent } = await import('../lib/metaPixel');
    initMetaPixel();
    fbViewContent('test-content', '123');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[0]).toBe('track');
    expect(lastCall[1]).toBe('ViewContent');
  });

  it('fbInitiateCheckout queues InitiateCheckout with value', async () => {
    const { initMetaPixel, fbInitiateCheckout } = await import('../lib/metaPixel');
    initMetaPixel();
    fbInitiateCheckout('standard', 7900);
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('InitiateCheckout');
    expect(lastCall[2].value).toBe(7900);
  });

  it('fbAddPaymentInfo queues AddPaymentInfo with plan', async () => {
    const { initMetaPixel, fbAddPaymentInfo } = await import('../lib/metaPixel');
    initMetaPixel();
    fbAddPaymentInfo('premium', 14900);
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('AddPaymentInfo');
    expect(lastCall[2].content_name).toBe('premium');
  });

  it('fbLead queues Lead event', async () => {
    const { initMetaPixel, fbLead } = await import('../lib/metaPixel');
    initMetaPixel();
    fbLead('lyrics_generated');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('Lead');
    expect(lastCall[2].content_name).toBe('lyrics_generated');
  });

  it('fbPurchase queues Purchase with value and currency', async () => {
    const { initMetaPixel, fbPurchase } = await import('../lib/metaPixel');
    initMetaPixel();
    fbPurchase('express', 9900, 'AOA');
    const lastCall = (window.fbq as any).queue[(window.fbq as any).queue.length - 1];
    expect(lastCall[1]).toBe('Purchase');
    expect(lastCall[2].value).toBe(9900);
    expect(lastCall[2].currency).toBe('AOA');
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
    const { fbPageView, fbLead, fbPurchase } = await import('../lib/metaPixel');
    expect(() => {
      fbPageView();
      fbLead('test');
      fbPurchase('standard', 7900);
    }).not.toThrow();
  });
});
