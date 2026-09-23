import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));
vi.mock('../services/storage', () => ({
  uploadFileToStorage: vi.fn().mockResolvedValue('https://r2.example.com/proofs/video_x.jpg'),
  createSignedStorageUrl: vi.fn().mockResolvedValue('https://r2.example.com/signed-url'),
  deleteStorageFile: vi.fn().mockResolvedValue(undefined),
  deleteStorageFiles: vi.fn().mockResolvedValue(undefined),
  listStorageFiles: vi.fn().mockResolvedValue([]),
  getPublicStorageUrl: vi.fn().mockResolvedValue('https://r2.example.com/public-url'),
}));
vi.mock('../services/metaPixelCapi', () => ({
  generateServerEventId: vi.fn(() => 'evt-video-test'),
  sendInitiateCheckoutEvent: vi.fn().mockResolvedValue(true),
  sendAddPaymentInfoEvent: vi.fn().mockResolvedValue(true),
  sendSubmitApplicationEvent: vi.fn().mockResolvedValue(true),
  sendLeadEvent: vi.fn().mockResolvedValue(true),
  sendCompleteRegistrationEvent: vi.fn().mockResolvedValue(true),
  sendPurchaseEvent: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/email', () => ({
  sendPersonalizedEmail: vi.fn().mockResolvedValue(true),
  sendConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendAdminNotification: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/ai', () => ({ generateLyrics: vi.fn() }));
vi.mock('../services/workflow', () => ({
  setProgress: vi.fn(),
  updateRequestStatus: vi.fn().mockResolvedValue(undefined),
  runBackgroundSunoWorkflow: vi.fn(),
  resumeSunoTaskWorkflow: vi.fn(),
  processSunoVoice: vi.fn(),
}));

import { getAdminSupabase } from '../services/supabase';
import { sendPurchaseEvent, generateServerEventId } from '../services/metaPixelCapi';
import publicRouter from '../routes/public';

let server: http.Server | null = null;

async function startServer(): Promise<string> {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
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

beforeEach(() => {
  vi.clearAllMocks();
});

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

interface VideoMockOpts {
  requestRow?: unknown;
  existingPayment?: unknown;
  insertResult?: { data: unknown; error: unknown };
}

function buildVideoSupabaseMock(opts: VideoMockOpts = {}) {
  const updateCalls: Array<{ table: string; payload: unknown }> = [];
  const insertCalls: unknown[] = [];

  const createBuilder = (table: string) => {
    let filters: string[] = [];

    const resolveMaybeSingle = () => {
      if (table === 'song_requests') return { data: opts.requestRow ?? null, error: null };
      if (table === 'payments') {
        if (filters.some(f => f.startsWith('proof_hash='))) return { data: null, error: null };
        if (filters.some(f => f.startsWith('request_id='))) return { data: opts.existingPayment ?? null, error: null };
      }
      return { data: null, error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push(`${col}=${val}`);
        return builder;
      },
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(resolveMaybeSingle()),
      single: () => Promise.resolve(
        table === 'song_requests'
          ? { data: opts.requestRow ?? null, error: opts.requestRow ? null : { message: 'no row' } }
          : (opts.insertResult ?? { data: null, error: { message: 'no row' } })
      ),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      update: (payload: unknown) => {
        updateCalls.push({ table, payload });
        const ub: Record<string, unknown> = {
          eq: () => ({
            then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
          }),
        };
        return ub;
      },
      insert: (rows: unknown) => {
        insertCalls.push(rows);
        return {
          select: () => ({
            single: () => Promise.resolve(opts.insertResult ?? { data: null, error: { message: 'insert failed' } }),
          }),
        };
      },
    };
    return builder;
  };

  return {
    updateCalls,
    insertCalls,
    mock: {
      from: (table: string) => createBuilder(table),
      storage: { from: () => ({ upload: () => Promise.resolve({ data: { path: 'proofs/x' }, error: null }) }) },
    },
  };
}

describe('POST /api/song/:id/video-upsell-payment — Meta CAPI Purchase', () => {
  it('devolve 200 e envia Purchase com eventID = paymentId', async () => {
    const base = await startServer();
    const sb = buildVideoSupabaseMock({
      requestRow: { id: REQUEST_ID, status: 'delivered', recipient_name: 'Ana', video_upsell_paid: false },
      insertResult: { data: { id: 'pay-video-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/song/${REQUEST_ID}/video-upsell-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: 'cliente@test.com',
        paymentMethod: 'express',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.paymentId).toBe('pay-video-1');

    expect(generateServerEventId).toHaveBeenCalledWith('pay-video-1', 'Purchase');
    expect(sendPurchaseEvent).toHaveBeenCalledTimes(1);
    expect(sendPurchaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-video-test',
        contentName: 'video_upsell',
        currency: 'USD',
        email: 'cliente@test.com',
      })
    );

    await vi.waitFor(() => {
      const flagUpdate = sb.updateCalls.find(
        (u: { table: string; payload: unknown }) =>
          u.table === 'payments' &&
          typeof u.payload === 'object' &&
          u.payload !== null &&
          'meta_purchase_sent_at' in (u.payload as Record<string, unknown>)
      );
      expect(flagUpdate).toBeTruthy();
    });
  });

  it('grava o INSERT com plan=video_upsell e amount=2900', async () => {
    const base = await startServer();
    const sb = buildVideoSupabaseMock({
      requestRow: { id: REQUEST_ID, status: 'approved', recipient_name: 'Ana', video_upsell_paid: false },
      insertResult: { data: { id: 'pay-video-2' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/song/${REQUEST_ID}/video-upsell-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: 'cliente@test.com' }),
    });

    expect(res.status).toBe(200);
    const paymentInsert = sb.insertCalls.find(
      (r: unknown) => (r as Record<string, unknown>).request_id === REQUEST_ID
    ) as Record<string, unknown> | undefined;
    expect(paymentInsert).toBeDefined();
    expect(paymentInsert!.plan).toBe('video_upsell');
    expect(paymentInsert!.amount).toBe(2900);
  });

  it('devolve 409 quando o videoclipe já foi pago', async () => {
    const base = await startServer();
    const sb = buildVideoSupabaseMock({
      requestRow: { id: REQUEST_ID, status: 'delivered', recipient_name: 'Ana', video_upsell_paid: true },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/song/${REQUEST_ID}/video-upsell-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: 'cliente@test.com' }),
    });

    expect(res.status).toBe(409);
    expect(sendPurchaseEvent).not.toHaveBeenCalled();
  });

  it('devolve 404 quando o pedido não existe', async () => {
    const base = await startServer();
    const sb = buildVideoSupabaseMock({ requestRow: null });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/song/${REQUEST_ID}/video-upsell-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: 'cliente@test.com' }),
    });

    expect(res.status).toBe(404);
    expect(sendPurchaseEvent).not.toHaveBeenCalled();
  });

  it('UPDATE de reenvio (payment existente) também dispara Purchase com o paymentId existente', async () => {
    const base = await startServer();
    const sb = buildVideoSupabaseMock({
      requestRow: { id: REQUEST_ID, status: 'delivered', recipient_name: 'Ana', video_upsell_paid: false },
      existingPayment: { id: 'pay-video-existing', proof_path: 'proofs/old.jpg' },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/song/${REQUEST_ID}/video-upsell-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: 'cliente@test.com' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentId).toBe('pay-video-existing');
    expect(generateServerEventId).toHaveBeenCalledWith('pay-video-existing', 'Purchase');
    expect(sendPurchaseEvent).toHaveBeenCalledTimes(1);
  });
});
