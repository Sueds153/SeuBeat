import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getMetaAdsSpend', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns not configured when META_ACCESS_TOKEN is missing', async () => {
    vi.stubEnv('META_ACCESS_TOKEN', '');

    const { getMetaAdsSpend } = await import('../services/metaAds');
    const result = await getMetaAdsSpend({ since: '2026-08-01', until: '2026-08-15' });

    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.error).toMatch(/META_ACCESS_TOKEN/);
  });

  it('fetches spend from the configured ad account', async () => {
    vi.stubEnv('META_ACCESS_TOKEN', 'meta-token');
    vi.stubEnv('META_AD_ACCOUNT_ID', '123');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'act_123', name: 'SeuBeat Ads', currency: 'USD' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ data: [{ spend: '17.35' }] })),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { getMetaAdsSpend } = await import('../services/metaAds');
    const result = await getMetaAdsSpend({ since: '2026-08-01', until: '2026-08-15' });

    expect(result.ok).toBe(true);
    expect(result.accountId).toBe('act_123');
    expect(result.accountName).toBe('SeuBeat Ads');
    expect(result.spendUSD).toBe(17.35);
    expect(fetchMock.mock.calls[1][0]).toContain('/act_123/insights');
  });
});
