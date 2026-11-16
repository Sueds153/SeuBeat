import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  createJob: vi.fn(),
  getJob: vi.fn(),
  queueStatus: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('../services/comamor/client', () => ({
  authorizeComAmorOrder: mocks.authorize,
  isComAmorIntegrationEnabled: () => process.env.COMAMOR_INTEGRATION_ENABLED === 'true',
  ComAmorIntegrationError: class ComAmorIntegrationError extends Error {
    constructor(message: string, public statusCode: number, public code: string) { super(message); }
  },
}));

vi.mock('../services/comamor/jobs', () => ({
  createOrGetComAmorJob: mocks.createJob,
  getComAmorJob: mocks.getJob,
  queueJobStatusCallback: mocks.queueStatus,
  dispatchComAmorCallbacks: mocks.dispatch,
  publicJobStatus: (status: string) => status === 'completed' ? 'completed' : status === 'failed' || status === 'expired' ? 'failed' : 'generating',
}));

import comAmorRouter from '../routes/comamor';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAMPAIGN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const JOB_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let server: http.Server;
let baseUrl = '';

const auth = { orderId: ORDER_ID, campaignId: CAMPAIGN_ID, occasion: 'Aniversário', generationAttempt: 1, idempotencyKey: `${ORDER_ID}:1` };
const job = {
  id: JOB_ID, order_id: ORDER_ID, campaign_id: CAMPAIGN_ID, generation_attempt: 1,
  idempotency_key: `${ORDER_ID}:1`, payload_hash: 'hash', occasion: 'Aniversário',
  music_style: 'Semba', request_id: JOB_ID, status: 'generating', error_code: null,
  content_mode: 'instruction',
  created_at: '2026-11-16T00:00:00.000Z', updated_at: '2026-11-16T00:00:00.000Z',
};

async function startServer(): Promise<string> {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/v1/comamor', comAmorRouter);
  await new Promise<void>(resolve => { server = app.listen(0, () => resolve()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start test server');
  return `http://127.0.0.1:${address.port}`;
}

beforeAll(async () => { baseUrl = await startServer(); });
afterAll(() => { server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  process.env.COMAMOR_INTEGRATION_ENABLED = 'true';
  mocks.authorize.mockResolvedValue(auth);
  mocks.createJob.mockResolvedValue(job);
  mocks.getJob.mockResolvedValue({ job, song: null });
});

describe('ComAmor API routes', () => {
  it('returns 503 while the feature flag is disabled and does not authorize', async () => {
    process.env.COMAMOR_INTEGRATION_ENABLED = 'false';
    const response = await fetch(`${baseUrl}/api/v1/comamor/authorize`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: ORDER_ID }),
    });
    expect(response.status).toBe(503);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it('authorizes the order before showing any create action', async () => {
    const response = await fetch(`${baseUrl}/api/v1/comamor/authorize`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: ORDER_ID }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, orderId: ORDER_ID, occasion: 'Aniversário', generationAttempt: 1 });
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it('returns 403 and creates no job for an unauthorized order', async () => {
    mocks.authorize.mockRejectedValueOnce(new (await import('../services/comamor/client')).ComAmorIntegrationError('Not authorized', 403, 'not_authorized'));
    const response = await fetch(`${baseUrl}/api/v1/comamor/jobs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: ORDER_ID, instruction: 'Uma canção alegre para celebrar esta ocasião.', musicStyle: 'Semba' }),
    });
    expect(response.status).toBe(403);
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it('returns a generic 503 on invalid upstream credentials without exposing them', async () => {
    mocks.authorize.mockRejectedValueOnce(new (await import('../services/comamor/client')).ComAmorIntegrationError('Auth unavailable', 503, 'authorization_unavailable'));
    const response = await fetch(`${baseUrl}/api/v1/comamor/jobs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: ORDER_ID, instruction: 'Uma canção alegre para celebrar esta ocasião.', musicStyle: 'Semba' }),
    });
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).not.toContain('token');
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it('rejects missing, oversized, or simultaneous instruction and lyrics', async () => {
    for (const body of [
      { orderId: ORDER_ID, musicStyle: 'Semba' },
      { orderId: ORDER_ID, instruction: 'x'.repeat(3001), musicStyle: 'Semba' },
      { orderId: ORDER_ID, instruction: 'Uma instrução longa e válida.', lyrics: 'Uma letra longa e válida.', musicStyle: 'Semba' },
    ]) {
      const response = await fetch(`${baseUrl}/api/v1/comamor/jobs`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
    }
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it('returns the same stable job for an idempotent retry', async () => {
    mocks.createJob.mockResolvedValue(job);
    const body = JSON.stringify({ orderId: ORDER_ID, instruction: 'Uma canção alegre para celebrar esta ocasião.', musicStyle: 'Semba' });
    const first = await fetch(`${baseUrl}/api/v1/comamor/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const second = await fetch(`${baseUrl}/api/v1/comamor/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect((await first.json()).jobId).toBe(JOB_ID);
    expect((await second.json()).jobId).toBe(JOB_ID);
    expect(mocks.createJob).toHaveBeenCalledTimes(2);
  });

  it('hides an older job when the latest authorized attempt has advanced', async () => {
    mocks.authorize.mockResolvedValueOnce({ ...auth, generationAttempt: 2, idempotencyKey: `${ORDER_ID}:2` });
    const response = await fetch(`${baseUrl}/api/v1/comamor/jobs/${JOB_ID}?orderId=${ORDER_ID}`);
    expect(response.status).toBe(404);
    expect(mocks.queueStatus).not.toHaveBeenCalled();
  });

  it('returns only result metadata and the audio URL on completion', async () => {
    mocks.getJob.mockResolvedValueOnce({ job: { ...job, status: 'completed' }, song: {
      title: 'Uma canção', audio_url: 'https://audio.seubeat.example/song.mp3', letter_text: 'PRIVATE LYRIC',
    } });
    const response = await fetch(`${baseUrl}/api/v1/comamor/jobs/${JOB_ID}?orderId=${ORDER_ID}`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'completed', title: 'Uma canção', genre: 'Semba', audioUrl: 'https://audio.seubeat.example/song.mp3' });
    expect(JSON.stringify(body)).not.toContain('PRIVATE LYRIC');
  });
});
