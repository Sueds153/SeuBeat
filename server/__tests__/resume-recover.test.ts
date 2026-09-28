import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));

import { getAdminSupabase } from '../services/supabase';
import publicRouter from '../routes/public';

let server: http.Server | null = null;

async function startServer(): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use('/api', publicRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const addr = server?.address();
  if (!addr || typeof addr === 'string') throw new Error('Sem endereço');
  return `http://127.0.0.1:${addr.port}`;
}

afterAll(() => {
  server?.close();
  server = null;
});

// Mesmo truque de submit-payment.test.ts: isDevelopment() faz skip dos limiters
// (nenhum destes testes valida rate limiting).
let prevNodeEnv: string | undefined;
function disableRateLimit() {
  prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
}
function restoreNodeEnv() {
  process.env.NODE_ENV = prevNodeEnv;
}

beforeEach(() => {
  vi.clearAllMocks();
  disableRateLimit();
});
afterEach(restoreNodeEnv);

const REQUEST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function buildSupabaseMock(row: unknown) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  q.select = self;
  q.eq = self;
  q.in = self;
  q.is = self;
  q.not = self;
  q.order = self;
  q.limit = self;
  q.maybeSingle = () => Promise.resolve({ data: row, error: null });
  q.single = () => Promise.resolve({ data: row, error: null });
  return { from: () => q };
}

function rejectedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    email: 'cliente@test.com',
    status: 'payment_rejected',
    recipient_name: 'Ana',
    created_at: new Date().toISOString(),
    songs: [{ id: 'song-1', title: 'Para Ana', lyrics: ['linha 1'], lyrics_snippet: 'linha 1', letter_text: '' }],
    users: { name: 'Cliente' },
    ...overrides,
  };
}

describe('resume-data / resume-link / recover-by-email — pedido rejeitado retomável', () => {
  it('GET /song/resume-data/:id aceita payment_rejected (200 com dados)', async () => {
    const base = await startServer();
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(buildSupabaseMock(rejectedRow()));

    const res = await fetch(`${base}/api/song/resume-data/${REQUEST_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('payment_rejected');
    expect(body.data.dbSongRequestId).toBe(REQUEST_ID);
    expect(body.data.formData.recipientName).toBe('Ana');
  });

  it('GET /song/resume-data/:id mantém o guarda para status não retomáveis (delivered → 400)', async () => {
    const base = await startServer();
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(
      buildSupabaseMock(rejectedRow({ status: 'delivered' }))
    );

    const res = await fetch(`${base}/api/song/resume-data/${REQUEST_ID}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('GET /song/:id/resume-link aceita payment_rejected (devolve resumeUrl)', async () => {
    const base = await startServer();
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(buildSupabaseMock(rejectedRow()));

    const res = await fetch(`${base}/api/song/${REQUEST_ID}/resume-link`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resumeUrl).toContain(`/wizard?resume=${REQUEST_ID}`);
  });

  it('POST /song/recover-by-email aceita payment_rejected (devolve resumeUrl)', async () => {
    const base = await startServer();
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(buildSupabaseMock(rejectedRow()));

    const res = await fetch(`${base}/api/song/recover-by-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cliente@test.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('payment_rejected');
    expect(body.resumeUrl).toContain(`/wizard?resume=${REQUEST_ID}`);
  });

  it('POST /song/recover-by-email continua a devolver 404 sem pedido elegível', async () => {
    const base = await startServer();
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(buildSupabaseMock(null));

    const res = await fetch(`${base}/api/song/recover-by-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sem-pedido@test.com' }),
    });
    expect(res.status).toBe(404);
  });
});
