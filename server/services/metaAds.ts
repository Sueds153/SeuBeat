import { getEnv } from '../config/env';

const GRAPH_API_VERSION = getEnv('META_GRAPH_API_VERSION', 'v21.0');
const ACCESS_TOKEN = getEnv('META_ACCESS_TOKEN', '');
const CONFIGURED_AD_ACCOUNT_ID = getEnv('META_AD_ACCOUNT_ID', '');
const USD_RATE = Number(getEnv('META_AD_SPEND_USD_RATE', '1')) || 1;

type MetaAdAccount = {
  id: string;
  name?: string;
  currency?: string;
};

type MetaAdsSpendResult = {
  ok: boolean;
  configured: boolean;
  spend: number;
  spendUSD: number;
  currency: string;
  accountId?: string;
  accountName?: string;
  since: string;
  until: string;
  lastCheck: string;
  error?: string;
};

function normalizeAdAccountId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function discoverAdAccount(): Promise<MetaAdAccount | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts`);
  url.searchParams.set('fields', 'id,name,currency');
  url.searchParams.set('limit', '1');

  const result = await fetchJson(url.toString());
  if (!result.ok) {
    throw new Error(result.data?.error?.message || `Meta adaccounts HTTP ${result.status}`);
  }
  return result.data?.data?.[0] || null;
}

async function fetchAdAccount(accountId: string): Promise<MetaAdAccount> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}`);
  url.searchParams.set('fields', 'id,name,currency');

  const result = await fetchJson(url.toString());
  if (!result.ok) {
    throw new Error(result.data?.error?.message || `Meta ad account HTTP ${result.status}`);
  }
  return {
    id: result.data?.id || accountId,
    name: result.data?.name,
    currency: result.data?.currency,
  };
}

export async function getMetaAdsSpend(params: { since: string; until: string }): Promise<MetaAdsSpendResult> {
  const lastCheck = new Date().toISOString();
  if (!ACCESS_TOKEN) {
    return {
      ok: false,
      configured: false,
      spend: 0,
      spendUSD: 0,
      currency: 'USD',
      since: params.since,
      until: params.until,
      lastCheck,
      error: 'META_ACCESS_TOKEN em falta',
    };
  }

  try {
    const configuredAccountId = normalizeAdAccountId(CONFIGURED_AD_ACCOUNT_ID);
    const account = configuredAccountId
      ? await fetchAdAccount(configuredAccountId)
      : await discoverAdAccount();

    if (!account?.id) {
      return {
        ok: false,
        configured: false,
        spend: 0,
        spendUSD: 0,
        currency: 'USD',
        since: params.since,
        until: params.until,
        lastCheck,
        error: 'Nenhuma conta de anúncios Meta encontrada para este token',
      };
    }

    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${account.id}/insights`);
    url.searchParams.set('fields', 'spend');
    url.searchParams.set('level', 'account');
    url.searchParams.set('time_range', JSON.stringify({ since: params.since, until: params.until }));

    const result = await fetchJson(url.toString());
    if (!result.ok) {
      throw new Error(result.data?.error?.message || `Meta insights HTTP ${result.status}`);
    }

    const spend = Number(result.data?.data?.[0]?.spend || 0);
    const currency = account.currency || getEnv('META_AD_SPEND_CURRENCY', 'USD') || 'USD';
    const rate = currency.toUpperCase() === 'USD' ? 1 : USD_RATE;

    return {
      ok: true,
      configured: true,
      spend,
      spendUSD: +(spend * rate).toFixed(2),
      currency,
      accountId: account.id,
      accountName: account.name,
      since: params.since,
      until: params.until,
      lastCheck,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      spend: 0,
      spendUSD: 0,
      currency: 'USD',
      since: params.since,
      until: params.until,
      lastCheck,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
