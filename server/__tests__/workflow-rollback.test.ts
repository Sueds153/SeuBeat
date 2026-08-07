import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminSupabase: vi.fn(),
  uploadToSupabase: vi.fn(),
  sendPersonalizedEmail: vi.fn(),
  sendConfirmationEmail: vi.fn(),
  sendAdminNotification: vi.fn(),
  sendWorkflowFailedEmail: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  getAdminSupabase: () => mocks.getAdminSupabase(),
  uploadToSupabase: (...args: unknown[]) => mocks.uploadToSupabase(...args),
}));

vi.mock('../services/audio', () => ({
  downloadFile: vi.fn(),
  createPreviewAudio: vi.fn(),
  applyFades: vi.fn(),
  convertToWav: vi.fn(),
  getAudioDuration: vi.fn(),
}));

vi.mock('../services/suno', () => ({
  querySunoTask: vi.fn(),
  generateFullSong: vi.fn(),
}));

vi.mock('../services/suno-voice', () => ({
  generateValidationPhrase: vi.fn(),
  waitForValidationPhrase: vi.fn(),
  createCustomVoice: vi.fn(),
  waitForVoiceId: vi.fn(),
  checkVoiceAvailability: vi.fn(),
}));

vi.mock('../services/email', () => ({
  sendPersonalizedEmail: (...args: unknown[]) => mocks.sendPersonalizedEmail(...args),
  sendConfirmationEmail: (...args: unknown[]) => mocks.sendConfirmationEmail(...args),
  sendAdminNotification: (...args: unknown[]) => mocks.sendAdminNotification(...args),
  sendWorkflowFailedEmail: (...args: unknown[]) => mocks.sendWorkflowFailedEmail(...args),
}));

vi.mock('../utils/helpers', () => ({
  getAudioFileInfo: vi.fn(),
  getAppUrl: () => 'https://app.test',
}));

vi.mock('../utils/logger', () => ({
  logInfo: (...args: unknown[]) => mocks.logInfo(...args),
  logWarn: (...args: unknown[]) => mocks.logWarn(...args),
  logError: (...args: unknown[]) => mocks.logError(...args),
}));

import { rollbackSunoWorkflow } from '../services/workflow';

type QueryResult = { data?: unknown; error?: unknown };
type QueryCtx = {
  from: string;
  cols: unknown;
  eqs: [string, unknown][];
  update: Record<string, unknown> | null;
  single: boolean;
  maybeSingle: boolean;
};

function createSupabaseMock(handler: (ctx: QueryCtx) => QueryResult | Promise<QueryResult> | undefined) {
  const queries: QueryCtx[] = [];
  const buckets: Record<string, { list: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }> = {};

  const getBucket = (bucket: string) => {
    buckets[bucket] ??= {
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    return buckets[bucket];
  };

  const makeChain = (from: string) => {
    const ctx: QueryCtx = { from, cols: null, eqs: [], update: null, single: false, maybeSingle: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select(cols: unknown) { ctx.cols = cols; return chain; },
      eq(key: string, value: unknown) { ctx.eqs.push([key, value]); return chain; },
      update(payload: Record<string, unknown>) { ctx.update = payload; return chain; },
      single() { ctx.single = true; return chain; },
      maybeSingle() { ctx.maybeSingle = true; return chain; },
      then(onFulfilled?: (value: QueryResult) => QueryResult | Promise<QueryResult> | unknown) {
        const result = handler(ctx) ?? { data: null, error: null };
        queries.push(ctx);
        return Promise.resolve(result).then(onFulfilled);
      },
    };
    return chain;
  };

  const client = {
    storage: {
      from: (bucket: string) => {
        const b = getBucket(bucket);
        return {
          list: (path: string) => b.list(path),
          remove: (paths: string[]) => b.remove(paths),
          createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      },
    },
    from: (table: string) => makeChain(table),
  };

  return { client, getBucket, queries };
}

type SupabaseMock = ReturnType<typeof createSupabaseMock>;

const REQ_ID = 'req-123';
const SONG_ID = 'song-1';

function defaultHandler(ctx: QueryCtx): QueryResult | undefined {
  if (ctx.from === 'song_requests' && ctx.single) {
    return { data: { email: 'cliente@test.com', recipient_name: 'Ana', users: [] }, error: null };
  }
  if (ctx.from === 'song_requests' && ctx.maybeSingle) {
    return { data: { voice_sample_url: null }, error: null };
  }
  if (ctx.from === 'payments' && ctx.update === null) {
    return { data: [{ id: 'pay1' }, { id: 'pay2' }], error: null };
  }
  if (ctx.from === 'payments') {
    return { data: null, error: null };
  }
  return undefined;
}

describe('rollbackSunoWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminSupabase.mockReturnValue(null);
  });

  it('reverte pagamentos aprovados para failed com approved_at nulo e notas', async () => {
    const { client, queries } = createSupabaseMock(defaultHandler);

    await rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'));

    const updateCall = queries.find((q) => q.from === 'payments' && q.update !== null);
    expect(updateCall).toBeDefined();
    expect(updateCall!.update).toEqual({
      status: 'failed',
      approved_at: null,
      notes: 'Revertido automaticamente — falha na geração Suno',
    });
    expect(updateCall!.eqs).toEqual([['request_id', REQ_ID], ['status', 'approved']]);
  });

  it('notifica o admin com cliente, nº de pagamentos revertidos e link para /admin', async () => {
    const { client } = createSupabaseMock(defaultHandler);

    await rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'));

    expect(mocks.sendAdminNotification).toHaveBeenCalledTimes(1);
    const [subject, body] = mocks.sendAdminNotification.mock.calls[0] as unknown as [string, string];
    expect(subject).toContain('Falha na geração Suno');
    expect(subject).toContain(REQ_ID.slice(0, 8));
    expect(body).toContain(REQ_ID);
    expect(body).toContain(SONG_ID);
    expect(body).toContain('cliente@test.com');
    expect(body).toContain('Ana');
    expect(body).toContain('Pagamentos revertidos: 2');
    expect(body).toContain('/admin');
  });

  it('não altera payments quando não há pagamentos aprovados', async () => {
    const { client, queries } = createSupabaseMock((ctx) => {
      if (ctx.from === 'payments' && ctx.update === null) return { data: [], error: null };
      return defaultHandler(ctx);
    });

    await rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'));

    const updateCall = queries.find((q) => q.from === 'payments' && q.update !== null);
    expect(updateCall).toBeUndefined();
    const [subject, body] = mocks.sendAdminNotification.mock.calls[0] as unknown as [string, string];
    expect(body).toContain('Pagamentos revertidos: 0');
  });

  it('envia email de falha ao cliente (com fallback users.email)', async () => {
    const { client } = createSupabaseMock((ctx) => {
      if (ctx.from === 'song_requests' && ctx.single) {
        return { data: { email: null, recipient_name: 'Ana', users: [{ email: 'fallback@test.com' }] }, error: null };
      }
      return defaultHandler(ctx);
    });

    await rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'));

    expect(mocks.sendWorkflowFailedEmail).toHaveBeenCalledWith('fallback@test.com', 'Ana');
  });

  it('não envia email ao cliente quando não existe email', async () => {
    const { client } = createSupabaseMock((ctx) => {
      if (ctx.from === 'song_requests' && ctx.single) {
        return { data: { email: null, recipient_name: 'Ana', users: [] }, error: null };
      }
      return defaultHandler(ctx);
    });

    await rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'));

    expect(mocks.sendWorkflowFailedEmail).not.toHaveBeenCalled();
    expect(mocks.sendAdminNotification).toHaveBeenCalledTimes(1);
  });

  it('limpa ficheiros órfãos do storage', async () => {
    const { client, getBucket } = createSupabaseMock((ctx) => {
      if (ctx.from === 'song_requests' && ctx.maybeSingle) {
        return { data: { voice_sample_url: 'voice-samples/abc.wav' }, error: null };
      }
      return defaultHandler(ctx);
    });
    getBucket('full-audio').list.mockResolvedValue({ data: [{ name: `${SONG_ID}_original.mp3` }, { name: 'other.mp3' }], error: null });
    getBucket('preview').list.mockResolvedValue({ data: [{ name: `${REQ_ID}_1.wav` }], error: null });

    await rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'));

    const fullAudio = getBucket('full-audio');
    expect(fullAudio.list).toHaveBeenCalledWith('songs');
    expect(fullAudio.remove).toHaveBeenCalledWith([`songs/${SONG_ID}_original.mp3`]);

    const preview = getBucket('preview');
    expect(preview.list).toHaveBeenCalledWith('sunovoice');
    expect(preview.remove).toHaveBeenCalledWith([`previews/${SONG_ID}_preview.mp3`]);
    expect(preview.remove).toHaveBeenCalledWith([`sunovoice/${REQ_ID}_1.wav`]);

    const voiceSamples = getBucket('voice-samples');
    expect(voiceSamples.remove).toHaveBeenCalledWith(['voice-samples/abc.wav']);
  });

  it('não rebenta quando a consulta de cliente falha e continua o rollback', async () => {
    const { client, queries } = createSupabaseMock((ctx) => {
      if (ctx.from === 'song_requests' && ctx.single) throw new Error('connection refused');
      return defaultHandler(ctx);
    });

    await expect(rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'))).resolves.toBeUndefined();

    const updateCall = queries.find((q) => q.from === 'payments' && q.update !== null);
    expect(updateCall).toBeDefined();
    expect(mocks.sendWorkflowFailedEmail).not.toHaveBeenCalled();
    expect(mocks.sendAdminNotification).toHaveBeenCalledTimes(1);
    expect(mocks.logWarn).toHaveBeenCalled();
  });

  it('não rebenta quando os emails falham', async () => {
    const { client } = createSupabaseMock(defaultHandler);
    mocks.sendAdminNotification.mockRejectedValue(new Error('smtp down'));
    mocks.sendWorkflowFailedEmail.mockRejectedValue(new Error('smtp down'));

    await expect(rollbackSunoWorkflow(client as never, REQ_ID, SONG_ID, new Error('boom'))).resolves.toBeUndefined();
  });
});
