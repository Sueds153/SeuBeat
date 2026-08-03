const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export type UtmParams = Record<string, string>;

const STORAGE_KEY = 'seubeat_utm_params';
const AT_KEY = 'seubeat_utm_landed_at';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function readUtmFromUrl(search: string = window.location.search): UtmParams {
  const params = new URLSearchParams(search || '');
  const utm: UtmParams = {};
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return utm;
}

/**
 * Guarda os parâmetros UTM em localStorage (30 dias), capturados no início do funil.
 * Só sobrescreve quando a URL traz UTM — não apaga atribuição anterior noutros casos.
 * Sem UTM e sem valor válido armazenado → limpa (evita arrastar atribuição antiga).
 */
export function captureUtm(): void {
  if (!isBrowser()) return;
  try {
    const fromUrl = readUtmFromUrl();
    if (Object.keys(fromUrl).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
      localStorage.setItem(AT_KEY, String(Date.now()));
      return;
    }
    const landedAt = Number(localStorage.getItem(AT_KEY) || 0);
    const hasStored = Boolean(localStorage.getItem(STORAGE_KEY));
    if (!hasStored || !landedAt || Date.now() - landedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(AT_KEY);
    }
  } catch {
    // armazenamento indisponível → ignora
  }
}

export function getStoredUtm(): UtmParams {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === 'object' && obj !== null ? (obj as UtmParams) : {};
  } catch {
    return {};
  }
}