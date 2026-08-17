import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { captureUtm, getStoredUtm } from '../lib/utm';

// jsdom (vitest) não expõe localStorage/sessionStorage por omissão —
// criamos um stub em memória para o teste da atribuição UTM.
function createStorage(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store = new Map();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as Storage;
}

let localStorageStub: Storage;
let sessionStorageStub: Storage;

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  });
}

describe('utm.ts — atribuição de campanha (localStorage)', () => {
  beforeEach(() => {
    localStorageStub = createStorage();
    sessionStorageStub = createStorage();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageStub,
      configurable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageStub,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageStub,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageStub,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captureUtm grava os UTM da URL em localStorage (o que o Wizard lê)', () => {
    setSearch('?utm_source=facebook&utm_campaign=valentine&utm_medium=cpc');

    captureUtm();

    const stored = getStoredUtm();
    expect(stored.utm_source).toBe('facebook');
    expect(stored.utm_campaign).toBe('valentine');
    expect(stored.utm_medium).toBe('cpc');
    // Os UTM ficam em localStorage, não apenas em sessionStorage
    const raw = window.localStorage.getItem('seubeat_utm_params');
    expect(raw).toBeTruthy();
  });

  it('getStoredUtm devolve {} sem UTM armazenado', () => {
    expect(getStoredUtm()).toEqual({});
  });

  it('getStoredUtm ignora valores inválidos', () => {
    window.localStorage.setItem('seubeat_utm_params', 'not-json');
    expect(getStoredUtm()).toEqual({});
  });

  it('captureUtm limpa atribuição antiga quando expira (30 dias)', () => {
    setSearch('');
    // Atribuição antiga de há 31 dias
    window.localStorage.setItem('seubeat_utm_params', JSON.stringify({ utm_source: 'antigo' }));
    window.localStorage.setItem('seubeat_utm_landed_at', String(Date.now() - 31 * 24 * 60 * 60 * 1000));

    captureUtm();

    expect(getStoredUtm()).toEqual({});
  });
});
