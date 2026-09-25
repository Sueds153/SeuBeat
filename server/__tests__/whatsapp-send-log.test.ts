import { describe, it, expect, beforeEach, vi } from 'vitest';

type State = {
  insertPayload: Record<string, unknown> | null;
  insertError: { message: string; code?: string } | null;
  gteCalls: Array<[string, string]>;
  updatePayloads: Array<Record<string, unknown>>;
  count: number;
  selectError: { message: string } | null;
};

const state: State = {
  insertPayload: null,
  insertError: null,
  gteCalls: [],
  updatePayloads: [],
  count: 0,
  selectError: null,
};

const query: any = {
  insert: (row: Record<string, unknown>) => {
    state.insertPayload = row;
    return query;
  },
  update: (row: Record<string, unknown>) => {
    state.updatePayloads.push(row);
    return query;
  },
  select: () => query,
  eq: () => query,
  gte: (col: string, val: string) => {
    state.gteCalls.push([col, val]);
    return query;
  },
  then: (resolve: (v: unknown) => unknown) =>
    resolve({ data: null, error: state.insertError ?? state.selectError, count: state.count }),
};

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(() => ({ from: () => query })),
  getPublicSupabase: () => null,
}));

vi.mock('../utils/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

import { logError } from '../utils/logger';
import { insertSendLog, getDailySentCount, markBucketSent, markContacted } from '../services/whatsapp/sendLog';

const mockedLogError = logError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  state.insertPayload = null;
  state.insertError = null;
  state.gteCalls = [];
  state.updatePayloads = [];
  state.count = 0;
  state.selectError = null;
});

describe('insertSendLog', () => {
  it('grava bucket "manual" por omissão (coluna NOT NULL sem default)', async () => {
    await insertSendLog({ requestId: 'req-1', phone: '244900000001', status: 'sent' });
    expect(state.insertPayload).not.toBeNull();
    expect(state.insertPayload!.bucket).toBe('manual');
    expect(state.insertPayload!.request_id).toBe('req-1');
    expect(state.insertPayload!.status).toBe('sent');
  });

  it('usa o bucket explícito quando fornecido', async () => {
    await insertSendLog({ requestId: 'req-1', phone: '244900000001', status: 'failed', bucket: '30min', error: 'boom' });
    expect(state.insertPayload!.bucket).toBe('30min');
    expect(state.insertPayload!.error).toBe('boom');
  });

  it('faz logError (sem lançar) quando o insert devolve error', async () => {
    state.insertError = { message: 'null value in column bucket', code: '23502' };
    await expect(
      insertSendLog({ requestId: 'req-1', phone: '244900000001', status: 'sent' })
    ).resolves.toBeUndefined();
    expect(mockedLogError).toHaveBeenCalledTimes(1);
    expect(mockedLogError.mock.calls[0][0]).toContain('Falha ao registar log');
    expect((mockedLogError.mock.calls[0][2] as { code?: string }).code).toBe('23502');
  });

  it('não lança quando o supabase lança exceção', async () => {
    const throwQuery = {
      ...query,
      insert: () => {
        throw new Error('network down');
      },
    };
    const { getAdminSupabase } = await import('../services/supabase');
    vi.mocked(getAdminSupabase).mockReturnValueOnce({ from: () => throwQuery } as never);
    await expect(
      insertSendLog({ requestId: 'req-1', phone: '244900000001', status: 'sent' })
    ).resolves.toBeUndefined();
    expect(mockedLogError).toHaveBeenCalled();
  });
});

describe('getDailySentCount', () => {
  it('filtra por sent_at (a coluna real — created_at não existe)', async () => {
    state.count = 7;
    const count = await getDailySentCount();
    expect(count).toBe(7);
    expect(state.gteCalls.length).toBeGreaterThan(0);
    expect(state.gteCalls[0][0]).toBe('sent_at');
    expect(new Date(state.gteCalls[0][1]).toString()).not.toBe('Invalid Date');
  });

  it('devolve 0 quando há error', async () => {
    state.selectError = { message: 'column sent_at does not exist' };
    expect(await getDailySentCount()).toBe(0);
  });
});

describe('markBucketSent', () => {
  it('grava a flag do bucket com timestamp ISO', async () => {
    await markBucketSent('req-1', '30min');
    expect(state.updatePayloads).toHaveLength(1);
    const flag = state.updatePayloads[0].whatsapp_30min_sent_at;
    expect(typeof flag).toBe('string');
    expect(new Date(flag as string).toISOString()).toBe(flag);
  });

  it('não faz update para bucket desconhecido', async () => {
    await markBucketSent('req-1', 'desconhecido');
    expect(state.updatePayloads).toHaveLength(0);
  });

  it('não faz update para bucket undefined', async () => {
    await markBucketSent('req-1', undefined);
    expect(state.updatePayloads).toHaveLength(0);
  });
});

describe('markContacted', () => {
  it('grava manual_contacted_at com timestamp ISO', async () => {
    await markContacted('req-1');
    expect(state.updatePayloads).toHaveLength(1);
    const v = state.updatePayloads[0].manual_contacted_at;
    expect(typeof v).toBe('string');
    expect(new Date(v as string).toISOString()).toBe(v);
  });
});
