import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateLyrics: vi.fn(),
  runBackgroundSunoWorkflow: vi.fn(),
  client: null as unknown,
}));

vi.mock('../services/supabase', () => ({ getAdminSupabase: () => mocks.client }));
vi.mock('../services/ai', () => ({ generateLyrics: mocks.generateLyrics }));
vi.mock('../workflow', () => ({ runBackgroundSunoWorkflow: mocks.runBackgroundSunoWorkflow }));

import { processComAmorJob, type ComAmorJobRow } from '../services/comamor/jobs';

const job: ComAmorJobRow = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  order_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  campaign_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  generation_attempt: 1,
  idempotency_key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:1',
  payload_hash: 'hash',
  occasion: 'Aniversário',
  music_style: 'Semba',
  request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  status: 'queued',
  content_mode: 'instruction',
  error_code: null,
  created_at: '2026-11-16T00:00:00.000Z',
  updated_at: '2026-11-16T00:00:00.000Z',
};

describe('ComAmor generation failure handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let currentJobStatus = 'queued';
    const requestData = {
      heart_message: 'Uma ideia sobre celebrar uma nova etapa da vida.',
      special_traits: 'Uma ideia sobre celebrar uma nova etapa da vida.',
      occasion: 'Aniversário', music_style: 'Semba',
    };

    const from = (table: string) => {
      let operation = 'select';
      let payload: Record<string, unknown> = {};
      let canClaim = false;
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.update = (value: Record<string, unknown>) => {
        operation = 'update'; payload = value;
        if (table === 'comamor_jobs' && value.status === 'generating') {
          canClaim = currentJobStatus === 'queued';
          if (canClaim) currentJobStatus = 'generating';
        } else if (table === 'comamor_jobs' && typeof value.status === 'string') currentJobStatus = value.status;
        return builder;
      };
      builder.insert = () => { operation = 'insert'; return builder; };
      builder.upsert = () => { operation = 'upsert'; return builder; };
      builder.eq = () => builder;
      builder.single = async () => {
        if (table === 'song_requests' && operation === 'select') return { data: requestData, error: null };
        if (table === 'comamor_jobs' && operation === 'update') return { data: { ...job, status: currentJobStatus, error_code: payload.error_code || null }, error: null };
        return { data: null, error: null };
      };
      builder.maybeSingle = async () => {
        if (table === 'comamor_jobs' && operation === 'update' && payload.status === 'generating') {
          if (!canClaim) return { data: null, error: null };
          return { data: { ...job, status: 'generating' }, error: null };
        }
        return { data: null, error: null };
      };
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject);
      return builder;
    };
    mocks.client = { from };
    mocks.generateLyrics.mockRejectedValue(new Error('provider key and stack must stay private'));
  });

  it('marks the job failed without exposing provider errors or retrying on the same claim', async () => {
    await processComAmorJob(job);
    await processComAmorJob(job);

    expect(mocks.generateLyrics).toHaveBeenCalledTimes(1);
    expect(mocks.runBackgroundSunoWorkflow).not.toHaveBeenCalled();
    expect(mocks.client).toBeTruthy();
  });
});
