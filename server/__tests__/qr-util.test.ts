import { describe, it, expect } from 'vitest';
import { qrToDataUrl } from '../utils/qr';

describe('qrToDataUrl', () => {
  it('converts a raw QR string to a PNG data URL', async () => {
    const url = await qrToDataUrl('2@raw-qr-payload');
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('produces distinct output for distinct payloads', async () => {
    const a = await qrToDataUrl('payload-a');
    const b = await qrToDataUrl('payload-b');
    expect(a).not.toBe(b);
  });
});
