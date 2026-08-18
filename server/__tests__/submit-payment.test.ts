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
import { sendInitiateCheckoutEvent, sendAddPaymentInfoEvent, sendSubmitApplicationEvent } from '../services/metaPixelCapi';
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
  rejectedPayment?: unknown;
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
        if (filters.includes('status=rejected')) return { data: opts.rejectedPayment ?? null, error: null };
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

    const usdValue = 6.58;
    expect(sendInitiateCheckoutEvent).toHaveBeenCalledWith(expect.objectContaining({ value: usdValue, currency: 'USD' }));
    expect(sendAddPaymentInfoEvent).toHaveBeenCalledWith(expect.objectContaining({ value: usdValue, currency: 'USD' }));
    expect(sendSubmitApplicationEvent).toHaveBeenCalledWith(expect.objectContaining({ value: usdValue, currency: 'USD' }));
  });

  it('faz rollback do status para o estado anterior quando o insert do pagamento falha', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'lyrics_ready' },
      updateError: null,
      insertResult: { data: null, error: { message: 'duplicate key value violates unique constraint' } },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });

    expect(res.status).toBe(500);
    const updates = sb.updateCalls.filter((u) => u.table === 'song_requests');
    expect(updates).toHaveLength(2);
    expect(updates[0].payload).toMatchObject({ status: 'payment_submitted' });
    expect(updates[1].payload).toMatchObject({ status: 'lyrics_ready' });
  });

  it('re-envia comprovativo após rejeição fazendo UPDATE em vez de INSERT (UNIQUE request_id)', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      rejectedPayment: { id: 'pay-rej' },
      requestRow: { status: 'payment_rejected' },
      updateError: null,
      insertResult: { data: { id: 'pay-rej' }, error: null },
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
    expect(body.paymentId).toBe('pay-rej');
    expect(sb.insertCalls).toHaveLength(0);
    const paymentUpdate = sb.updateCalls.find((u) => u.table === 'payments');
    expect(paymentUpdate).toBeDefined();
    expect((paymentUpdate!.payload as Record<string, unknown>)).toMatchObject({
      request_id: 'req-1',
      status: 'pending_verification',
      notes: null,
      approved_at: null,
    });
    const requestUpdate = sb.updateCalls.find((u) => u.table === 'song_requests');
    expect(requestUpdate!.payload).toMatchObject({ status: 'payment_submitted' });
  });

  it('guarda o validation_task_id da voz no pedido quando há amostra + task', async () => {
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
      body: JSON.stringify({
        ...validBody(),
        voiceSampleBase64: 'data:audio/wav;base64,' + Buffer.alloc(4096, 1).toString('base64'),
        voiceSampleFilename: 'frase.wav',
        voiceSampleMimeType: 'audio/wav',
        voiceValidationTaskId: 'vt-999',
        voiceValidationPhrase: '  Frase de Validação  ',
      }),
    });

    expect(res.status).toBe(200);
    const requestUpdate = sb.updateCalls.find((u) => u.table === 'song_requests');
    expect(requestUpdate).toBeDefined();
    const payload = requestUpdate!.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ status: 'payment_submitted' });
    expect(payload.voice_sample_url).toBeTruthy();
    expect(payload.elevenlabs_voice_id).toBe(JSON.stringify({ validation_task_id: 'vt-999', phrase: 'Frase de Validação' }));
  });

  it('não guarda elevenlabs_voice_id quando não há validation_task_id', async () => {
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
    const requestUpdate = sb.updateCalls.find((u) => u.table === 'song_requests');
    expect((requestUpdate!.payload as Record<string, unknown>).elevenlabs_voice_id).toBeUndefined();
  });

  it('grava payment_method=express no INSERT quando escolhido Express', async () => {
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
      body: JSON.stringify({ ...validBody(), paymentMethod: 'express' }),
    });

    expect(res.status).toBe(200);
    const insertedRow = (sb.insertCalls[0] as Array<Record<string, unknown>>)[0];
    expect(insertedRow.payment_method).toBe('express');
  });

  it('usa payment_method=reference por omissão quando não é enviado (retrocompatibilidade)', async () => {
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
    const insertedRow = (sb.insertCalls[0] as Array<Record<string, unknown>>)[0];
    expect(insertedRow.payment_method).toBe('reference');
  });

  it('rejeita paymentMethod inválido com 400', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({});
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), paymentMethod: 'bitcoin' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Método de pagamento');
    expect(sb.insertCalls).toHaveLength(0);
  });

  it('grava payment_method no UPDATE de reenvio pós-rejeição', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      rejectedPayment: { id: 'pay-rej' },
      requestRow: { status: 'payment_rejected' },
      updateError: null,
      insertResult: { data: { id: 'pay-rej' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), paymentMethod: 'express' }),
    });

    expect(res.status).toBe(200);
    const paymentUpdate = sb.updateCalls.find((u) => u.table === 'payments');
    expect(paymentUpdate).toBeDefined();
    expect((paymentUpdate!.payload as Record<string, unknown>).payment_method).toBe('express');
  });
});
