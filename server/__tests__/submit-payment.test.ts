import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));
vi.mock('../services/storage', () => ({
  uploadFileToStorage: vi.fn().mockResolvedValue('https://r2.example.com/voice-samples/test.wav'),
  createSignedStorageUrl: vi.fn().mockResolvedValue('https://r2.example.com/signed-url'),
  deleteStorageFile: vi.fn().mockResolvedValue(undefined),
  deleteStorageFiles: vi.fn().mockResolvedValue(undefined),
  listStorageFiles: vi.fn().mockResolvedValue([]),
  getPublicStorageUrl: vi.fn().mockResolvedValue('https://r2.example.com/public-url'),
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
import {
  sendInitiateCheckoutEvent,
  sendAddPaymentInfoEvent,
  sendSubmitApplicationEvent,
  sendPurchaseEvent,
  generateServerEventId,
} from '../services/metaPixelCapi';
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
  existingHashPayment?: unknown;
}

function buildSupabaseMock(opts: SupabaseMockOpts) {
  const updateCalls: Array<{ table: string; payload: unknown }> = [];
  const insertCalls: unknown[] = [];

  const createBuilder = (table: string) => {
    let filters: string[] = [];
    let hasNeq = false;

    const resolveMaybeSingle = () => {
      if (table === 'payments') {
        if (filters.includes('status=pending_verification')) return { data: opts.pendingPayment ?? null, error: null };
        if (filters.includes('status=approved') && !hasNeq) return { data: opts.approvedPayment ?? null, error: null };
        if (filters.includes('status=rejected')) return { data: opts.rejectedPayment ?? null, error: null };
        if (filters.includes('in_status_rejected_failed')) return { data: opts.rejectedPayment ?? null, error: null };
        // proof_hash dedup check: eq('proof_hash', ...) + neq('request_id', ...)
        if (filters.some(f => f.startsWith('proof_hash=')) && hasNeq) {
          return { data: opts.existingHashPayment ?? null, error: null };
        }
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
      neq: (col: string, val: unknown) => {
        filters.push(`neq_${col}=${val}`);
        hasNeq = true;
        return builder;
      },
      in: (col: string, values: unknown[]) => {
        if (col === 'status' && Array.isArray(values) && values.includes('rejected') && values.includes('failed')) {
          filters.push('in_status_rejected_failed');
        }
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(resolveMaybeSingle()),
      single: () => Promise.resolve(opts.insertResult ?? { data: null, error: { message: 'no row' } }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: opts.updateError ?? null }),
      update: (payload: unknown) => {
        updateCalls.push({ table, payload });
        const eqResult = {
          data: { id: table === 'payments' ? 'pay-1' : undefined },
          error: opts.updateError ?? null,
        };
        const selectChain = {
          select: () => ({
            single: () => Promise.resolve(eqResult),
          }),
          then: (resolve: (v: unknown) => unknown) => resolve(eqResult),
        };
        const ub: Record<string, unknown> = {
          eq: () => selectChain,
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
      requestRow: { status: 'lyrics_ready' },
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
    const requestUpdates = sb.updateCalls.filter((u: {table: string}) => u.table === 'song_requests');
    expect(requestUpdates).toHaveLength(1);
    expect(requestUpdates[0].payload).toMatchObject({ status: 'payment_submitted' });
    expect(sb.insertCalls.length).toBeGreaterThanOrEqual(1);
    const paymentInsert = sb.insertCalls.find((r: unknown) => (r as Record<string, unknown>).request_id === 'req-1') as Record<string, unknown> | undefined;
    expect(paymentInsert).toBeDefined();
    expect(paymentInsert!.plan).toBe('standard');

    const usdValue = 6.58;
    expect(sendInitiateCheckoutEvent).toHaveBeenCalledWith(expect.objectContaining({ value: usdValue, currency: 'USD' }));
    expect(sendAddPaymentInfoEvent).toHaveBeenCalledWith(expect.objectContaining({ value: usdValue, currency: 'USD' }));
    expect(sendSubmitApplicationEvent).toHaveBeenCalledWith(expect.objectContaining({ value: usdValue, currency: 'USD' }));
    // #2: response expõe paymentStatus p/ o browser condicionar fbPurchase
    expect(body.paymentStatus).toBe('pending_verification');
    // #1: CAPI Purchase usa eventID do songRequestId (dedup c/ browser) e grava flag
    expect(generateServerEventId).toHaveBeenCalledWith('req-1', 'Purchase');
    expect(sendPurchaseEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-test' }));
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

  it('faz rollback do status para o estado anterior quando o insert do pagamento falha', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'lyrics_ready' },
      updateError: null,
      insertResult: { data: null, error: { message: 'connection refused' } },
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
    const paymentUpdates = sb.updateCalls.filter((u: {table: string}) => u.table === 'payments');
    expect(paymentUpdates.length).toBeGreaterThanOrEqual(1);
    expect(paymentUpdates[0].payload).toMatchObject({ payment_method: 'reference' });
    const requestUpdate = sb.updateCalls.find((u: {table: string}) => u.table === 'song_requests');
    expect(requestUpdate!.payload).toMatchObject({ status: 'payment_submitted' });
  });

  it('re-envia comprovativo após pagamento failed faz UPDATE em vez de INSERT', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      rejectedPayment: { id: 'pay-fail' },
      requestRow: { status: 'payment_submitted' },
      updateError: null,
      insertResult: { data: { id: 'pay-fail' }, error: null },
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
    expect(body.paymentId).toBe('pay-fail');
    const paymentUpdates = sb.updateCalls.filter((u: {table: string}) => u.table === 'payments');
    expect(paymentUpdates.length).toBeGreaterThanOrEqual(1);
    expect(sb.insertCalls).toHaveLength(0);
  });

  it('devolve 409 quando insert falha com UNIQUE constraint violation', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      rejectedPayment: null,
      requestRow: { status: 'lyrics_ready' },
      updateError: null,
      insertResult: { data: null, error: { message: 'duplicate key value violates unique constraint "payments_request_id_key"' } },
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
    expect(body.error).toContain('pagamento já foi registado');
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

  it('guarda o voice_free_sample_url no pedido quando enviada a amostra livre de voz', async () => {
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
        voiceFreeSampleBase64: 'data:audio/wav;base64,' + Buffer.alloc(4096, 2).toString('base64'),
        voiceFreeSampleFilename: 'amostra_livre.wav',
        voiceFreeSampleMimeType: 'audio/wav',
        voiceValidationTaskId: 'vt-999',
        voiceValidationPhrase: 'Frase de Validação',
      }),
    });

    expect(res.status).toBe(200);
    const requestUpdate = sb.updateCalls.find((u) => u.table === 'song_requests');
    expect(requestUpdate).toBeDefined();
    const payload = requestUpdate!.payload as Record<string, unknown>;
    expect(payload.voice_sample_url).toBeTruthy();
    expect(payload.voice_free_sample_url).toBeTruthy();
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
    const paymentInsert = sb.insertCalls.find((r: unknown) => (r as Record<string, unknown>).request_id === 'req-1') as Record<string, unknown> | undefined;
    expect(paymentInsert).toBeDefined();
    expect(paymentInsert!.payment_method).toBe('express');
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
    const paymentInsert = sb.insertCalls.find((r: unknown) => (r as Record<string, unknown>).request_id === 'req-1') as Record<string, unknown> | undefined;
    expect(paymentInsert).toBeDefined();
    expect(paymentInsert!.payment_method).toBe('reference');
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
    expect(body.error).toBe('Dados de pagamento inválidos');
    expect(body.validation_errors).toBeDefined();
    expect(body.validation_errors.some((e: { field: string }) => e.field.includes('paymentMethod'))).toBe(true);
    expect(sb.insertCalls).toHaveLength(0);
  });

  it('devolve 409 quando o comprovativo já foi usado noutro pedido (mesmo proof_hash)', async () => {
    const base = await startServer();
    // Need proofBase64 to trigger hash computation
    const proofBuf = Buffer.alloc(200, 0xab);
    const proofBase64 = `data:application/octet-stream;base64,${proofBuf.toString('base64')}`;

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'lyrics_ready' },
      existingHashPayment: { id: 'pay-dup', request_id: 'other-request', status: 'approved', user_email: 'outro@test.com' },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), proofBase64 }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('já foi utilizado');
  });

  it('grava proof_hash no INSERT do pagamento', async () => {
    const base = await startServer();
    const proofBuf = Buffer.alloc(200, 0xcd);
    const proofBase64 = `data:application/octet-stream;base64,${proofBuf.toString('base64')}`;

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'lyrics_ready' },
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), proofBase64 }),
    });

    expect(res.status).toBe(200);
    const paymentInsert = sb.insertCalls.find((r: unknown) => (r as Record<string, unknown>).request_id === 'req-1') as Record<string, unknown> | undefined;
    expect(paymentInsert).toBeDefined();
    expect(typeof paymentInsert!.proof_hash).toBe('string');
    expect((paymentInsert!.proof_hash as string)).toHaveLength(64);
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
    const paymentUpdates = sb.updateCalls.filter((u: {table: string}) => u.table === 'payments');
    expect(paymentUpdates.length).toBeGreaterThanOrEqual(1);
    expect(paymentUpdates[0].payload).toMatchObject({ payment_method: 'express' });
  });
});
