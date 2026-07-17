import { describe, it, expect } from 'vitest';

describe('sendSubmitApplicationEvent', () => {
  it('is a function', async () => {
    const { sendSubmitApplicationEvent } = await import('../services/metaPixelCapi');
    expect(typeof sendSubmitApplicationEvent).toBe('function');
  });
});

describe('sendPurchaseEvent', () => {
  it('is a function', async () => {
    const { sendPurchaseEvent } = await import('../services/metaPixelCapi');
    expect(typeof sendPurchaseEvent).toBe('function');
  });
});
