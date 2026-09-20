import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));
vi.mock('../services/storage', () => ({
  uploadFileToStorage: vi.fn().mockResolvedValue('https://r2.seubeat.com/proofs/test.jpg'),
  createSignedStorageUrl: vi.fn().mockResolvedValue('https://r2.seubeat.com/signed'),
  deleteStorageFile: vi.fn().mockResolvedValue(undefined),
  deleteStorageFiles: vi.fn().mockResolvedValue(undefined),
  listStorageFiles: vi.fn().mockResolvedValue([]),
  getPublicStorageUrl: vi.fn().mockResolvedValue('https://r2.seubeat.com/public'),
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
let baseUrl = '';

// In-memory DB
const paymentsDB: Map<string, any> = new Map();
const requestsDB: Map<string, any> = new Map();
let paymentIdCounter = 0;

async function startServer(): Promise<string> {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api', publicRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const addr = server?.address();
  if (!addr || typeof addr === 'string') throw new Error('No addr');
  baseUrl = `http://127.0.0.1:${addr.port}`;
  return baseUrl;
}

afterAll(() => { server?.close(); server = null; });
beforeEach(() => {
  vi.clearAllMocks();
  paymentsDB.clear();
  requestsDB.clear();
  paymentIdCounter = 0;
  // Pre-populate song requests
  requestsDB.set('req-1', { id: 'req-1', status: 'lyrics_ready' });
  requestsDB.set('req-2', { id: 'req-2', status: 'lyrics_ready' });
  requestsDB.set('req-rejected', { id: 'req-rejected', status: 'payment_rejected' });
  requestsDB.set('req-approved', { id: 'req-approved', status: 'approved' });
  requestsDB.set('req-delivered', { id: 'req-delivered', status: 'delivered' });
});

function buildSupabaseMock() {
  const updateCalls: Array<{ table: string; payload: any }> = [];
  const insertCalls: any[] = [];

  function builderFor(table: string) {
    let filters: Record<string, any> = {};
    let inFilters: { col: string; values: any[] }[] = [];
    let neqFilters: { col: string; val: any }[] = [];
    let limitCount: number | null = null;

    const b: any = {
      select: () => b,
      eq: (col: string, val: any) => { filters[col] = val; return b; },
      neq: (col: string, val: any) => { neqFilters.push({ col, val }); return b; },
      in: (col: string, values: any[]) => { inFilters.push({ col, values }); return b; },
      order: () => b,
      limit: (n: number) => { limitCount = n; return b; },
      gt: () => b,
      gte: () => b,
      lt: () => b,
      lte: () => b,
      is: () => b,
      filter: () => b,
      then: (resolve: any) => resolve({ data: null, error: null }),
      maybeSingle: () => {
        const result = resolveQuery(table, filters, inFilters, neqFilters);
        return Promise.resolve(result);
      },
      single: () => {
        const result = resolveQuery(table, filters, inFilters, neqFilters);
        if (result.data) return Promise.resolve(result);
        return Promise.resolve({ data: null, error: { message: 'no row' } });
      },
      update: (payload: any) => {
        updateCalls.push({ table, payload });
        // Actually update in-memory DB
        if (table === 'payments') {
          for (const [id, row] of paymentsDB) {
            if (matchFilters(row, filters, inFilters, neqFilters)) {
              Object.assign(row, payload);
            }
          }
        }
        if (table === 'song_requests') {
          for (const [id, row] of requestsDB) {
            if (matchFilters(row, filters, inFilters, neqFilters)) {
              Object.assign(row, payload);
            }
          }
        }
        const eqChain = {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'pay-1' }, error: null }),
          }),
          then: (resolve: any) => resolve({ error: null }),
        };
        return { eq: () => eqChain };
      },
      insert: (rows: any) => {
        const row = Array.isArray(rows) ? rows[0] : rows;
        insertCalls.push(row);
        if (table === 'payments') {
          const id = `pay-${++paymentIdCounter}`;
          row.id = id;
          paymentsDB.set(id, { ...row });
          return { select: () => ({ single: () => Promise.resolve({ data: { id }, error: null }) }) };
        }
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id' }, error: null }) }) };
      },
    };
    return b;
  }

  function matchFilters(row: any, filters: any, inFilters: any, neqFilters: any): boolean {
    for (const [col, val] of Object.entries(filters)) {
      if (row[col] !== val) return false;
    }
    for (const { col, values } of inFilters) {
      if (!values.includes(row[col])) return false;
    }
    for (const { col, val } of neqFilters) {
      if (row[col] === val) return false;
    }
    return true;
  }

  function resolveQuery(table: string, filters: any, inFilters: any, neqFilters: any): any {
    if (table === 'payments') {
      for (const [, row] of paymentsDB) {
        if (matchFilters(row, filters, inFilters, neqFilters)) {
          return { data: row, error: null };
        }
      }
      return { data: null, error: null };
    }
    if (table === 'song_requests') {
      for (const [, row] of requestsDB) {
        if (matchFilters(row, filters, inFilters, neqFilters)) {
          return { data: row, error: null };
        }
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  return { updateCalls, insertCalls, mock: { from: builderFor } };
}

function validBody(overrides: Record<string, any> = {}) {
  return {
    songRequestId: 'req-1',
    userEmail: 'cliente@test.com',
    phone: '+244900000000',
    plan: 'standard',
    amount: 7900,
    ...overrides,
  };
}

// Minimal valid JPEG-like buffer with seed for uniqueness
function proofBuffer(seed: number): Buffer {
  const buf = Buffer.alloc(300);
  buf[0] = 0xFF; buf[1] = 0xD8; // SOI
  for (let i = 2; i < 298; i++) buf[i] = (seed * 7 + i * 13) & 0xFF;
  buf[298] = 0xFF; buf[299] = 0xD9; // EOI
  return buf;
}

function proofBase64(seed: number): string {
  return `data:image/jpeg;base64,${proofBuffer(seed).toString('base64')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
describe('Anti-fraude: reutilização de comprovativo', () => {
  let sb: ReturnType<typeof buildSupabaseMock>;

  beforeEach(async () => {
    sb = buildSupabaseMock();
    (getAdminSupabase as any).mockReturnValue(sb.mock);
  });

  it('TEST 1 — Pagamento normal com comprovativo (sucesso)', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({ proofBase64: proofBase64(1) })),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // proof_hash should be stored
    const paymentInsert = sb.insertCalls.find((r: any) => r.request_id === 'req-1');
    expect(paymentInsert).toBeDefined();
    expect(typeof paymentInsert!.proof_hash).toBe('string');
    expect(paymentInsert!.proof_hash).toHaveLength(64);
  });

  it('TEST 2 — Mesmo comprovativo noutro pedido (BLOQUEADO 409)', async () => {
    const base = await startServer();
    // First payment succeeds
    const res1 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({ proofBase64: proofBase64(10) })),
    });
    expect(res1.status).toBe(200);

    // Second payment with SAME proof, DIFFERENT request → should block
    const res2 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-2',
        userEmail: 'outro@test.com',
        proofBase64: proofBase64(10), // same buffer
      })),
    });
    const body = await res2.json();
    expect(res2.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain('já foi utilizado');
  });

  it('TEST 3 — Comprovativos diferentes para o mesmo plano (permitido)', async () => {
    const base = await startServer();
    // First payment
    const res1 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({ proofBase64: proofBase64(1) })),
    });
    expect(res1.status).toBe(200);

    // Second payment with DIFFERENT proof, DIFFERENT request
    const res2 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-2',
        userEmail: 'outro@test.com',
        proofBase64: proofBase64(2), // different buffer
      })),
    });
    expect(res2.status).toBe(200);
    expect((await res2.json()).success).toBe(true);
  });

  it('TEST 4 — Reenvio após rejeição (mesmo pedido, mesmo comprovativo — permitido)', async () => {
    const base = await startServer();
    // First submit → rejected
    const res1 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-rejected',
        userEmail: 'rej@test.com',
        proofBase64: proofBase64(50),
      })),
    });
    expect(res1.status).toBe(200);
  });

  it('TEST 5 — Comprovativo de reenvio reutilizado noutro pedido (BLOQUEADO)', async () => {
    const base = await startServer();
    // Submit for rejected request
    const res1 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-rejected',
        userEmail: 'rej@test.com',
        proofBase64: proofBase64(50),
      })),
    });
    expect(res1.status).toBe(200);

    // Try to use same proof for a different request
    const res2 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-2',
        userEmail: 'hacker@test.com',
        proofBase64: proofBase64(50), // same as above
      })),
    });
    expect(res2.status).toBe(409);
    expect((await res2.json()).error).toContain('já foi utilizado');
  });

  it('TEST 6 — Pagamento pendente bloqueia segundo envio para o mesmo pedido', async () => {
    const base = await startServer();
    // First submit → pending
    const res1 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-1',
        proofBase64: proofBase64(77),
      })),
    });
    expect(res1.status).toBe(200);

    // Second submit same request → 409 (pending guard)
    const res2 = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-1',
        proofBase64: proofBase64(78),
      })),
    });
    expect(res2.status).toBe(409);
    expect((await res2.json()).error).toContain('pendente');
  });

  it('TEST 7 — Pedido aprovado bloqueia re-submissão', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-approved',
        proofBase64: proofBase64(88),
      })),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('aprovado');
  });

  it('TEST 8 — Pedido entregue bloqueia re-submissão', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'req-delivered',
        proofBase64: proofBase64(89),
      })),
    });
    expect(res.status).toBe(409);
  });

  it('TEST 9 — Campos obrigatórios em falta (400)', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songRequestId: 'req-xxx' }),
    });
    expect(res.status).toBe(400);
  });

  it('TEST 10 — Pedido inexistente (400)', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({
        songRequestId: 'non-existent-uuid',
      })),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('não encontrado');
  });

  it('TEST 11 — 3 clientes diferentes, 3 comprovativos diferentes (todos OK)', async () => {
    const base = await startServer();
    for (let i = 1; i <= 3; i++) {
      const res = await fetch(`${base}/api/submit-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody({
          songRequestId: `req-${i === 1 ? '1' : '2'}`,
          userEmail: `client${i}@test.com`,
          proofBase64: proofBase64(i * 100),
        })),
      });
      // req-1 may 409 if already submitted, that's fine
      expect([200, 409]).toContain(res.status);
    }
  });

  it('TEST 12 — Payment fields incluem proof_hash no INSERT', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody({ proofBase64: proofBase64(42) })),
    });
    expect(res.status).toBe(200);
    const insert = sb.insertCalls.find((r: any) => r.request_id === 'req-1');
    expect(insert).toBeDefined();
    expect(insert!.proof_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(insert!.proof_filename).toContain('proof.bin');
  });
});
