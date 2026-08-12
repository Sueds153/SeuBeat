import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));
vi.mock('../services/metaPixelCapi', () => ({
  generateServerEventId: vi.fn(() => 'evt-test'),
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

beforeEach(() => {
  vi.clearAllMocks();
});

interface SupabaseMockOpts {
  pendingPayment?: unknown;
  approvedPayment?: unknown;
  requestRow?: unknown;
  updateError?: unknown;
  insertResult?: { data: unknown; error: unknown };
}

function buildSupabaseMock(opts: SupabaseMockOpts) {
  const updateCalls: Array<{ table: string; payload: unknown }> = [];
  const insertCalls: unknown[] = [];

  const createBuilder = (table: string) => {
    let filters: string[] = [];

    const resolveMaybeSingle = () => {
      if (table === 'payments') {
        if (filters.includes('status=pending_verification')) return { data: opts.pendingPayment ?? null, error: null };
        if (filters.includes('status=approved')) return { data: opts.approvedPayment ?? null, error: null };
      }
      if (table === 'song_requests') return { data: opts.requestRow ?? null, error: null };
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
      single: () => Promise.resolve(opts.insertResult ?? { data: null, error: { message: 'no row' } }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: opts.updateError ?? null }),
      update: (payload: unknown) => {
        updateCalls.push({ table, payload });
        const ub: Record<string, unknown> = {
          eq: () => ({ then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: opts.updateError ?? null }) }),
        };
        return ub;
      },
      insert: (rows: unknown) => {
        insertCalls.push(rows);
        return { select: () => ({ single: () => Promise.resolve(opts.insertResult ?? { data: null, error: { message: 'insert failed' } }) }) };
      },
    };
    return builder;
  };

  return {
    updateCalls,
    insertCalls,
    mock: {
      from: (table: string) => createBuilder(table),
      storage: { from: () => ({ upload: () => Promise.resolve({ data: { path: 'proofs/x.jpg' }, error: null }) }) },
    },
  };
}

function validBody() {
  return {
    songRequestId: 'req-1',
    userEmail: 'cliente@test.com',
    phone: '+244900000000',
    plan: 'standard',
    amount: 7900,
  };
}

describe('POST /api/submit-payment — guarda contra rebaixamento de pedidos aprovados', () => {
  it('devolve 409 e NÃO toca no pedido quando já existe pagamento aprovado', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: { id: 'pay-1' },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('aprovado');
    expect(sb.updateCalls).toHaveLength(0);
    expect(sb.insertCalls).toHaveLength(0);
  });

  it('devolve 409 quando o pedido já está delivered (sem payment aprovada)', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'delivered' },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });

    expect(res.status).toBe(409);
    expect(sb.updateCalls).toHaveLength(0);
    expect(sb.insertCalls).toHaveLength(0);
  });

  it('mantém o fluxo normal quando o pedido ainda está em pré-aprovação', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'lyrics_ready' },
      updateError: null,
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.paymentId).toBe('pay-1');
    expect(sb.updateCalls).toHaveLength(1);
    expect(sb.updateCalls[0].payload).toMatchObject({ status: 'payment_submitted' });
    expect(sb.insertCalls).toHaveLength(1);
  });
});
