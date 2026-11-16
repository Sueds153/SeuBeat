import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), client: null as unknown }));
vi.mock('../services/supabase', () => ({ getAdminSupabase: () => mocks.client || ({ rpc: mocks.rpc }) }));
vi.mock('../services/ai', () => ({ generateLyrics: vi.fn() }));
vi.mock('../workflow', () => ({ runBackgroundSunoWorkflow: vi.fn() }));

import { ComAmorIntegrationError } from '../services/comamor/client';
import { buildComAmorCallbackBody, createOrGetComAmorJob, processQueuedComAmorJobs, publicJobStatus, type ComAmorJobRow } from '../services/comamor/jobs';

const authorization = {
  orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  campaignId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  occasion: 'Aniversário',
  generationAttempt: 1,
  idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:1',
};
const row = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  order_id: authorization.orderId,
  campaign_id: authorization.campaignId,
  generation_attempt: 1,
  idempotency_key: authorization.idempotencyKey,
  payload_hash: 'stable-hash', occasion: authorization.occasion,
  music_style: 'Semba', request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  content_mode: 'instruction',
  status: 'generating', error_code: null,
};

describe('ComAmor job reservation', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.client = null; });

  it('uses the server-verified idempotency key and returns the existing job on retry', async () => {
    mocks.rpc.mockResolvedValue({ data: [row], error: null });
    const input = { instruction: 'Uma canção sobre uma nova etapa feliz.', musicStyle: 'Semba' };
    const first = await createOrGetComAmorJob(authorization, input);
    const retry = await createOrGetComAmorJob(authorization, input);

    expect(first.id).toBe(row.id);
    expect(retry.id).toBe(first.id);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenLastCalledWith('create_comamor_job', expect.objectContaining({
      p_order_id: authorization.orderId,
      p_campaign_id: authorization.campaignId,
      p_generation_attempt: 1,
      p_idempotency_key: authorization.idempotencyKey,
      p_content_mode: 'instruction',
      p_payload_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it('maps a changed payload on the same idempotency key to 409', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'idempotency_conflict' } });
    await expect(createOrGetComAmorJob(authorization, {
      instruction: 'Texto diferente para esta tentativa.', musicStyle: 'Semba',
    })).rejects.toMatchObject({ statusCode: 409, code: 'idempotency_conflict' });
  });

  it('maps a stale authorization attempt to 409 without creating another job', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'stale_attempt' } });
    await expect(createOrGetComAmorJob(authorization, {
      instruction: 'Uma canção sobre uma nova etapa feliz.', musicStyle: 'Semba',
    })).rejects.toBeInstanceOf(ComAmorIntegrationError);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('normalizes internal statuses without returning storage or provider errors', () => {
    expect(publicJobStatus('queued')).toBe('generating');
    expect(publicJobStatus('generating')).toBe('generating');
    expect(publicJobStatus('completed')).toBe('completed');
    expect(publicJobStatus('failed')).toBe('failed');
    expect(publicJobStatus('expired')).toBe('failed');
  });

  it('keeps callback bodies free of organizer text and generated personal titles', () => {
    const body = buildComAmorCallbackBody(row as ComAmorJobRow, 'completed', {
      title: 'Canção para Maria Silva', audioUrl: 'https://audio.seubeat.example/song.mp3',
    });
    expect(body).toContain('"title":"Canção personalizada"');
    expect(body).not.toContain('Maria Silva');
    expect(body).not.toContain('Uma ideia');
  });

  it('re-drives durable queued reservations after a server restart', async () => {
    const calls: string[] = [];
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.update = () => builder;
    builder.eq = () => builder;
    builder.order = () => builder;
    builder.limit = async () => ({ data: [row], error: null });
    builder.maybeSingle = async () => ({ data: null, error: null });
    mocks.rpc.mockReset();
    mocks.client = {
      from: (table: string) => { calls.push(table); return builder; },
    };

    await processQueuedComAmorJobs();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toEqual(['comamor_jobs', 'comamor_jobs']);
  });
});
