import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeUUID } from '../lib/uuid';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeUUID', () => {
  it('devuelve un UUID con formato RFC-4122 (8-4-4-4-12)', () => {
    expect(safeUUID()).toMatch(UUID_REGEX);
  });

  it('usa crypto.randomUUID cuando está disponible', () => {
    const cryptoStub = vi.fn().mockReturnValue('crypto-uuid-123');
    vi.stubGlobal('crypto', { randomUUID: cryptoStub });
    expect(safeUUID()).toBe('crypto-uuid-123');
    expect(cryptoStub).toHaveBeenCalled();
  });

  it('usa fallback getRandomValues cuando randomUUID no existe', () => {
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => Array.from({ length: arr.length }, (_, i) => i + 1).forEach((v, i) => { arr[i] = v; }) });
    expect(safeUUID()).toMatch(UUID_REGEX);
  });

  it('usa fallback Math.random cuando no hay Web Crypto', () => {
    vi.stubGlobal('crypto', undefined);
    expect(safeUUID()).toMatch(UUID_REGEX);
  });

  it('genera valores únicos en llamadas consecutivas', () => {
    const set = new Set(Array.from({ length: 100 }, () => safeUUID()));
    expect(set.size).toBe(100);
  });
});