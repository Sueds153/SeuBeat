import { getDeepSeekApiKey } from './deepseekConfig';

interface CachedResult {
  at: number;
  data: unknown;
}

const cache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data as T;
  }
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

function fmtError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function checkDeepSeekCredits(now: Date = new Date()): Promise<Record<string, unknown>> {
  return cached('deepseek-credits', async () => {
    const apiKey = getDeepSeekApiKey();
    if (!apiKey) {
      return { ok: false, error: 'chave em falta', lastCheck: now.toISOString() };
    }
    try {
      const res = await fetch('https://api.deepseek.com/user/balance', {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}`, lastCheck: now.toISOString() };
      }
      const data: unknown = await res.json();
      const balanceInfos = Array.isArray((data as { balance_infos?: unknown })?.balance_infos)
        ? (data as { balance_infos: Array<{ currency?: string; total_balance?: number; granted_balance?: number }> }).balance_infos
        : [];
      const usd = balanceInfos.find(b => String(b.currency || '').toUpperCase() === 'USD') || balanceInfos[0];
      const totalBalance = Number(usd?.total_balance ?? usd?.granted_balance ?? 0);
      return {
        ok: true,
        currency: usd?.currency || 'USD',
        total_balance: totalBalance,
        low: totalBalance < 1,
        lastCheck: now.toISOString(),
      };
    } catch (err: unknown) {
      return { ok: false, error: fmtError(err), lastCheck: now.toISOString() };
    }
  });
}

export async function checkGeminiCredits(now: Date = new Date()): Promise<Record<string, unknown>> {
  return cached('gemini-credits', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: 'chave em falta', lastCheck: now.toISOString() };
    }
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 429 || res.status === 403) {
        return { ok: true, quota_exceeded: true, error: `HTTP ${res.status}`, lastCheck: now.toISOString() };
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}`, lastCheck: now.toISOString() };
      }
      const data: unknown = await res.json();
      const models = Array.isArray((data as { models?: unknown })?.models) ? (data as { models: unknown[] }).models : [];
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const found = models.some(m => String((m as { name?: string })?.name || '').includes(model.split('-')[0]));
      return {
        ok: true,
        model,
        available: found,
        lastCheck: now.toISOString(),
      };
    } catch (err: unknown) {
      return { ok: false, error: fmtError(err), lastCheck: now.toISOString() };
    }
  });
}