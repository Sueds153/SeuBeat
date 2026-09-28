import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
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
  sendRefundEvent: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/email', () => ({
  sendPersonalizedEmail: vi.fn().mockResolvedValue(true),
  sendConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendPaymentRejectionEmail: vi.fn().mockResolvedValue(true),
  sendAdminNotification: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/whatsapp', () => ({
  sendDeliveryWhatsApp: vi.fn().mockResolvedValue('sent'),
  sendPaymentRejectedWhatsApp: vi.fn().mockResolvedValue('sent'),
}));
vi.mock('../services/ai', () => ({ generateLyrics: vi.fn() }));
vi.mock('../services/workflow', () => ({
  setProgress: vi.fn(),
  updateRequestStatus: vi.fn().mockResolvedValue(undefined),
  runBackgroundSunoWorkflow: vi.fn().mockResolvedValue(undefined),
  resumeSunoTaskWorkflow: vi.fn(),
  processSunoVoice: vi.fn(),
}));
vi.mock('../services/proofVerification', () => ({
  // Default: sem verificação (comportamento equivalente a manual_review →
  // pending). Testes que precisam de auto_approve configuram mockResolvedValue.
  verifyPaymentProof: vi.fn(() => Promise.resolve(null)),
  isTxIdAcceptable: vi.fn(() => true),
}));

import { getAdminSupabase } from '../services/supabase';
import { verifyPaymentProof, isTxIdAcceptable, type VerificationResult } from '../services/proofVerification';
import { runBackgroundSunoWorkflow } from '../services/workflow';
import { sendConfirmationEmail, sendPaymentRejectionEmail } from '../services/email';
import { sendPaymentRejectedWhatsApp } from '../services/whatsapp';
import {
  sendInitiateCheckoutEvent,
  sendAddPaymentInfoEvent,
  sendSubmitApplicationEvent,
  sendPurchaseEvent,
  sendRefundEvent,
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

let prevNodeEnv: string | undefined;

// O paymentLimiter (20 req/h/IP) é partilhado por todo o ficheiro e não há
// reset disponível no handler v8 (só resetKey, com chave por IP). Nenhum teste
// aqui valida rate limiting, por isso contornamos o limite nestes describes
// via skip() do rateLimiter (isDevelopment()).
function disablePaymentRateLimit() {
  prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
}

function restoreNodeEnv() {
  process.env.NODE_ENV = prevNodeEnv;
}

beforeEach(() => {
  vi.clearAllMocks();
});

interface SupabaseMockOpts {
  pendingPayment?: unknown;
  approvedPayment?: unknown;
  rejectedPayment?: unknown;
  requestRow?: unknown;
  /**
   * Sequência de retornos do SELECT em song_requests (o último elemento repete).
   * Simula re-lecturas ao longo do handler — ex.: a letra relida na geração
   * adiada do auto-approve pode diferir da lida na decisão.
   */
  requestRowSeq?: unknown[];
  updateError?: unknown;
  insertResult?: { data: unknown; error: unknown };
  existingHashPayment?: unknown;
  /** Linha devolvida pelo SELECT meta_purchase_sent_at (Refund condicional). */
  paymentFlagRow?: unknown;
}

function buildSupabaseMock(opts: SupabaseMockOpts) {
  const updateCalls: Array<{ table: string; payload: unknown }> = [];
  const insertCalls: unknown[] = [];
  let songReqReads = 0;

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
        // SELECT meta_purchase_sent_at por id (sem filtro de status) — Refund
        if (filters.some(f => f.startsWith('id=')) && !filters.some(f => f.startsWith('status='))) {
          return { data: opts.paymentFlagRow ?? null, error: null };
        }
      }
      if (table === 'song_requests') {
        if (opts.requestRowSeq && opts.requestRowSeq.length > 0) {
          const idx = Math.min(songReqReads, opts.requestRowSeq.length - 1);
          songReqReads += 1;
          return { data: opts.requestRowSeq[idx] ?? null, error: null };
        }
        return { data: opts.requestRow ?? null, error: null };
      }
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
          // Cadeia update().eq().in() do auto-reject (song_requests → payment_rejected)
          in: () => selectChain,
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

    // Valores em AOA — o mesmo que o browser envia (dedup não pode ver duas moedas)
    const aoaValue = 7900;
    expect(sendInitiateCheckoutEvent).toHaveBeenCalledWith(expect.objectContaining({ value: aoaValue, currency: 'AOA' }));
    expect(sendAddPaymentInfoEvent).toHaveBeenCalledWith(expect.objectContaining({ value: aoaValue, currency: 'AOA' }));
    expect(sendSubmitApplicationEvent).toHaveBeenCalledWith(expect.objectContaining({ value: aoaValue, currency: 'AOA' }));
    // #2: response expõe paymentStatus p/ o browser condicionar fbPurchase
    expect(body.paymentStatus).toBe('pending_verification');
    // Purchase só dispara na aprovação — pendente NÃO é compra (spec Meta)
    expect(sendPurchaseEvent).not.toHaveBeenCalled();
    const flagUpdatePending = sb.updateCalls.find(
      (u: { table: string; payload: unknown }) =>
        u.table === 'payments' &&
        typeof u.payload === 'object' &&
        u.payload !== null &&
        'meta_purchase_sent_at' in (u.payload as Record<string, unknown>)
    );
    expect(flagUpdatePending).toBeFalsy();
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

describe('POST /api/submit-payment — auto-approve pela AI inicia geração da música', () => {
  function autoApproveResult(): VerificationResult {
    return {
      decision: 'auto_approve',
      confidence: 0.9,
      provider: 'test',
      checks: [],
      extracted: { transactionId: 'TX-AUTO-1' },
    } as unknown as VerificationResult;
  }

  function proofBody() {
    const proofBuf = Buffer.alloc(200, 0xef);
    return {
      proofBase64: `data:application/octet-stream;base64,${proofBuf.toString('base64')}`,
    };
  }

  function songRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'song-1',
      title: 'Para Ana',
      lyrics: ['linha 1'],
      audio_url: null,
      full_song_url: null,
      mureka_status: 'not_started',
      mureka_task_id: null,
      ...overrides,
    };
  }

  function autoRequestRow(songOverrides: Record<string, unknown> = {}) {
    return {
      status: 'lyrics_ready',
      recipient_name: 'Ana',
      music_style: 'Semba',
      voice_type: 'Feminina',
      desired_emotion: 'Feliz',
      songs: songRow(songOverrides),
    };
  }

  beforeEach(() => {
    disablePaymentRateLimit();
    // Delay 0 → geração adiada corre dentro do handler (testes existentes
    // esperam a chamada antes/sobre a resposta). Testes dedicados ao adiamento
    // sobrescrevem este valor.
    process.env.AUTO_APPROVE_GEN_DELAY_MS = '0';
  });

  afterEach(() => {
    restoreNodeEnv();
    delete process.env.AUTO_APPROVE_GEN_DELAY_MS;
    // Restaura os defaults da fábrica (null/true) para testes futuros.
    vi.mocked(verifyPaymentProof).mockReset();
    vi.mocked(isTxIdAcceptable).mockReset();
  });

  it('sem áudio: marca music_processing e dispara runBackgroundSunoWorkflow', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoApproveResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: autoRequestRow(),
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentStatus).toBe('approved');

    const autoUpdate = sb.updateCalls.find(
      (u) => u.table === 'song_requests' && (u.payload as Record<string, unknown>).status === 'music_processing'
    );
    expect(autoUpdate).toBeTruthy();
    expect(autoUpdate!.payload).toMatchObject({ status: 'music_processing' });

    expect(runBackgroundSunoWorkflow).toHaveBeenCalledTimes(1);
    expect(runBackgroundSunoWorkflow).toHaveBeenCalledWith(
      'req-1',
      'song-1',
      'Semba',
      'Para Ana',
      ['linha 1'],
      { voiceType: 'Feminina', desiredEmotion: 'Feliz' }
    );
    expect(sendConfirmationEmail).toHaveBeenCalledWith('cliente@test.com', 'Ana', 'req-1');
  });

  it('auto-aprovado: dispara Meta Purchase UMA vez (eventID=req-1) e grava meta_purchase_sent_at', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoApproveResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: autoRequestRow(),
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody(),
        ...proofBody(),
        fbp: 'fb.1.1759000000000000',
        fbc: 'fb.1.abc.def',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentStatus).toBe('approved');
    expect(sendPurchaseEvent).toHaveBeenCalledTimes(1);
    expect(sendPurchaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-test',
        value: 7900,
        currency: 'AOA',
        orderId: 'pay-1',
        fbp: 'fb.1.1759000000000000',
        fbc: 'fb.1.abc.def',
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

  it('já com áudio: aprova sem novo workflow (deliveryScheduler entrega)', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoApproveResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: autoRequestRow({
        audio_url: 'https://cdn.example.com/full.mp3',
        full_song_url: 'https://cdn.example.com/full.mp3',
        mureka_status: 'completed',
      }),
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });

    expect(res.status).toBe(200);
    const autoUpdate = sb.updateCalls.find(
      (u) => u.table === 'song_requests' && (u.payload as Record<string, unknown>).status === 'approved'
    );
    expect(autoUpdate).toBeTruthy();
    expect(runBackgroundSunoWorkflow).not.toHaveBeenCalled();
  });

  it('música já em geração: marca music_processing sem disparar workflow duplicado', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoApproveResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: autoRequestRow({ mureka_status: 'generating', mureka_task_id: 'task-9' }),
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });

    expect(res.status).toBe(200);
    const autoUpdate = sb.updateCalls.find(
      (u) => u.table === 'song_requests' && (u.payload as Record<string, unknown>).status === 'music_processing'
    );
    expect(autoUpdate).toBeTruthy();
    expect(runBackgroundSunoWorkflow).not.toHaveBeenCalled();
  });

  it('geração adiada: re-lê a letra da BD no momento de arrancar e usa a versão editada', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoApproveResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    // Leituras do handler: [guard, decisão de auto-approve, fire-time].
    // Na 3ª (após o delay) a letra já foi editada pelo cliente.
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRowSeq: [
        autoRequestRow(),
        autoRequestRow(),
        autoRequestRow({ lyrics: ['linha 1 EDITADA pelo cliente'] }),
      ],
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });

    expect(res.status).toBe(200);
    expect(runBackgroundSunoWorkflow).toHaveBeenCalledTimes(1);
    expect(runBackgroundSunoWorkflow).toHaveBeenCalledWith(
      'req-1',
      'song-1',
      'Semba',
      'Para Ana',
      ['linha 1 EDITADA pelo cliente'],
      { voiceType: 'Feminina', desiredEmotion: 'Feliz' }
    );
  });

  it('geração adiada: cancelada se o pedido foi rejeitado/apagado durante o delay', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoApproveResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRowSeq: [
        autoRequestRow(),
        autoRequestRow(),
        // Nota: autoRequestRow(enc) só faz override da SONG — o status do
        // request tem de ser setado à mão.
        { ...autoRequestRow(), status: 'payment_rejected' },
      ],
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentStatus).toBe('approved');
    expect(runBackgroundSunoWorkflow).not.toHaveBeenCalled();
  });

  it('geração adiada: espera o delay (não dispara imediatamente) e toca updated_at p/ cobertura do scheduler', async () => {
    const base = await startServer();
    process.env.AUTO_APPROVE_GEN_DELAY_MS = '400';
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoApproveResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: autoRequestRow(),
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });
    expect(res.status).toBe(200);

    // Touch de updated_at no agendamento (reinício → stuck-recovery cobre ao fim de 15min)
    const touch = sb.updateCalls.find(
      (u) => u.table === 'songs' && 'updated_at' in (u.payload as Record<string, unknown>)
    );
    expect(touch).toBeTruthy();

    // Ainda dentro da janela do delay: nada gerado ainda
    expect(runBackgroundSunoWorkflow).not.toHaveBeenCalled();

    await vi.waitFor(
      () => expect(runBackgroundSunoWorkflow).toHaveBeenCalledTimes(1),
      { timeout: 2000 }
    );
    expect(runBackgroundSunoWorkflow).toHaveBeenCalledWith(
      'req-1',
      'song-1',
      'Semba',
      'Para Ana',
      ['linha 1'],
      { voiceType: 'Feminina', desiredEmotion: 'Feliz' }
    );
  });
});

describe('POST /api/submit-payment — fbp/fbc + normalização de valor (Fase 1 Meta)', () => {
  beforeEach(disablePaymentRateLimit);
  afterEach(restoreNodeEnv);

  it('encaminha fbp/fbc do browser para os eventos CAPI (em user_data sem hash)', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'payment_submitted' },
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody(),
        fbp: 'fb.1.1759000000000000',
        fbc: 'fb.1.abc.def',
        eventIds: {
          initiateCheckout: 'ic-client-1',
          addPaymentInfo: 'api-client-1',
          submitApplication: 'sa-client-1',
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(sendInitiateCheckoutEvent).toHaveBeenCalledWith(
      expect.objectContaining({ fbp: 'fb.1.1759000000000000', fbc: 'fb.1.abc.def', eventId: 'ic-client-1' })
    );
    expect(sendAddPaymentInfoEvent).toHaveBeenCalledWith(
      expect.objectContaining({ fbp: 'fb.1.1759000000000000', fbc: 'fb.1.abc.def', eventId: 'api-client-1' })
    );
    // Pendente NÃO é compra — Purchase só dispara na aprovação
    // (fbp/fbc do Purchase cobertos no teste de auto-approve acima)
    expect(sendPurchaseEvent).not.toHaveBeenCalled();
  });

  it('amount fora do catálogo cai no preço base do plano (sanitize) na BD e na CAPI', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'payment_submitted' },
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), amount: 999999 }),
    });

    expect(res.status).toBe(200);
    const inserted = sb.insertCalls[0] as Record<string, unknown>;
    expect(inserted.amount).toBe(7900);
    expect(inserted.amount_kz).toBe(7900);
    // Purchase pendente não dispara; o value sanitizado é exposto via IC
    expect(sendPurchaseEvent).not.toHaveBeenCalled();
    expect(sendInitiateCheckoutEvent).toHaveBeenCalledWith(
      expect.objectContaining({ value: 7900, currency: 'AOA' })
    );
  });

  it('amount válido do catálogo não é alterado', async () => {
    const base = await startServer();
    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'payment_submitted' },
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), plan: 'express', amount: 9900 }),
    });

    expect(res.status).toBe(200);
    expect((sb.insertCalls[0] as Record<string, unknown>).amount).toBe(9900);
    // Purchase pendente não dispara; value íntegro coberto pelo IC
    expect(sendPurchaseEvent).not.toHaveBeenCalled();
    expect(sendInitiateCheckoutEvent).toHaveBeenCalledWith(
      expect.objectContaining({ value: 9900, currency: 'AOA' })
    );
  });
});

describe('POST /api/submit-payment — Refund só quando já houve Purchase', () => {
  beforeEach(disablePaymentRateLimit);

  function autoRejectResult(): VerificationResult {
    return {
      decision: 'auto_reject',
      confidence: 0.4,
      provider: 'test',
      checks: [{ name: 'Montante', passed: false, expected: '7900', actual: '100' }],
      extracted: { transactionId: 'TX-REJ-1' },
    } as unknown as VerificationResult;
  }

  function proofBody() {
    const proofBuf = Buffer.alloc(200, 0xef);
    return {
      proofBase64: `data:application/octet-stream;base64,${proofBuf.toString('base64')}`,
    };
  }

  afterEach(() => {
    vi.mocked(verifyPaymentProof).mockReset();
    vi.mocked(isTxIdAcceptable).mockReset();
    restoreNodeEnv();
  });

  it('com meta_purchase_sent_at preenchido: envia Refund em AOA', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoRejectResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'payment_submitted' },
      insertResult: { data: { id: 'pay-1' }, error: null },
      paymentFlagRow: { meta_purchase_sent_at: '2026-09-27T10:00:00Z' },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentStatus).toBe('rejected');
    expect(sendRefundEvent).toHaveBeenCalledTimes(1);
    expect(sendRefundEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 7900,
        currency: 'AOA',
        contentName: 'standard',
        orderId: 'pay-1',
      })
    );
    // O Purchase não volta a ser enviado para um pagamento rejeitado
    expect(sendPurchaseEvent).not.toHaveBeenCalled();
  });

  it('sem Purchase prévio (flag vazia): NÃO envia Refund', async () => {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoRejectResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'payment_submitted' },
      insertResult: { data: { id: 'pay-1' }, error: null },
      paymentFlagRow: { meta_purchase_sent_at: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });

    expect(res.status).toBe(200);
    expect(sendRefundEvent).not.toHaveBeenCalled();
  });
});

describe('POST /api/submit-payment — auto-reject: motivo + notificação ao cliente', () => {
  beforeEach(disablePaymentRateLimit);

  function autoRejectResult(): VerificationResult {
    return {
      decision: 'auto_reject',
      confidence: 0.4,
      provider: 'test',
      checks: [{ name: 'Montante', passed: false, expected: '7900', actual: '100' }],
      extracted: { transactionId: 'TX-REJ-9' },
    } as unknown as VerificationResult;
  }

  function proofBody() {
    const proofBuf = Buffer.alloc(200, 0xef);
    return {
      proofBase64: `data:application/octet-stream;base64,${proofBuf.toString('base64')}`,
    };
  }

  afterEach(() => {
    vi.mocked(verifyPaymentProof).mockReset();
    vi.mocked(isTxIdAcceptable).mockReset();
    restoreNodeEnv();
  });

  async function runAutoReject() {
    const base = await startServer();
    vi.mocked(verifyPaymentProof).mockResolvedValue(autoRejectResult());
    vi.mocked(isTxIdAcceptable).mockReturnValue(true);

    const sb = buildSupabaseMock({
      pendingPayment: null,
      approvedPayment: null,
      requestRow: { status: 'payment_submitted', recipient_name: 'Ana' },
      insertResult: { data: { id: 'pay-1' }, error: null },
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(sb.mock);

    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), ...proofBody() }),
    });
    return { res, sb };
  }

  it('grava notes com o motivo PT no INSERT do pagamento rejeitado', async () => {
    const { res, sb } = await runAutoReject();
    expect(res.status).toBe(200);
    const paymentInsert = sb.insertCalls.find(
      (r: unknown) => (r as Record<string, unknown>).request_id === 'req-1'
    ) as Record<string, unknown> | undefined;
    expect(paymentInsert).toBeDefined();
    expect(paymentInsert!.notes).toContain('não aprovado');
    expect(paymentInsert!.notes).toContain('Montante: esperado 7900, encontrado 100');
  });

  it('marca song_requests como payment_rejected (antes ficava payment_submitted)', async () => {
    const { res, sb } = await runAutoReject();
    expect(res.status).toBe(200);
    const srUpdate = sb.updateCalls.find(
      (u) => u.table === 'song_requests' && (u.payload as Record<string, unknown>).status === 'payment_rejected'
    );
    expect(srUpdate).toBeTruthy();
  });

  it('envia email de rejeição ao cliente com o motivo', async () => {
    const { res } = await runAutoReject();
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(sendPaymentRejectionEmail).toHaveBeenCalledTimes(1);
    });
    expect(sendPaymentRejectionEmail).toHaveBeenCalledWith(
      'cliente@test.com',
      expect.stringContaining('Montante')
    );
  });

  it('envia WhatsApp de rejeição com o motivo', async () => {
    const { res } = await runAutoReject();
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(sendPaymentRejectedWhatsApp).toHaveBeenCalledTimes(1);
    });
    expect(sendPaymentRejectedWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        phone: '+244900000000',
        recipientName: 'Ana',
        reason: expect.stringContaining('Montante'),
      })
    );
  });

  it('re-submissão após rejeição limpa notes (novo estado pendente)', async () => {
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
    const paymentUpdates = sb.updateCalls.filter((u) => u.table === 'payments');
    expect(paymentUpdates.length).toBeGreaterThanOrEqual(1);
    expect(paymentUpdates[0].payload).toMatchObject({ status: 'pending_verification', notes: null });
    expect(sendPaymentRejectionEmail).not.toHaveBeenCalled();
  });
});
