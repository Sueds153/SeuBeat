import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-1234567890';
process.env.ADMIN_PASSWORD = 'test-admin-password';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));

vi.mock('../services/email', () => ({
  sendPersonalizedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentRejectionEmail: vi.fn().mockResolvedValue(undefined),
  sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/metaPixelCapi', () => ({
  sendPurchaseEvent: vi.fn().mockResolvedValue(true),
  generateServerEventId: vi.fn(() => 'evt-test'),
}));

vi.mock('../services/workflow', () => ({
  requestProgressMap: {},
  resumeSunoTaskWorkflow: vi.fn(),
  runBackgroundSunoWorkflow: vi.fn(),
  processSunoVoice: vi.fn(),
}));

import { getAdminSupabase } from '../services/supabase';
import { sendPaymentRejectionEmail, sendConfirmationEmail, sendPersonalizedEmail } from '../services/email';
import { sendPurchaseEvent } from '../services/metaPixelCapi';
import adminRouter from '../routes/admin';

let server: http.Server | null = null;

async function startServer(): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
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

function authHeader(): string {
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, 'test-secret-1234567890', { expiresIn: '1h' });
  return `Bearer ${token}`;
}

const PAYMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SONG_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function buildPaymentRow(opts: { plan?: string; audioUrl?: string | null; voiceSample?: string | null; userEmail?: string } = {}) {
  const { plan = 'standard', audioUrl = 'https://audio.full.mp3', voiceSample = null, userEmail = 'ze@z.pt' } = opts;
  return {
    id: PAYMENT_ID,
    request_id: REQUEST_ID,
    user_email: userEmail,
    status: 'pending_verification',
    plan,
    amount: 5000,
    created_at: '2026-01-01T10:00:00Z',
    approved_at: '2026-01-01T10:00:00Z',
    song_requests: {
      id: REQUEST_ID,
      recipient_name: 'Ana',
      recipient_gender: 'Feminino',
      relationship: 'Parceiro',
      music_style: 'Semba',
      plan,
      voice_sample_url: voiceSample,
      phone: '244900000000',
      users: { name: 'Ze', email: userEmail },
      songs: [{
        id: SONG_ID,
        title: 'T',
        full_song_url: audioUrl,
        audio_url: audioUrl ? null : 'https://audio.alt.mp3',
        letter_text: 'Carta',
        mureka_status: 'completed',
      }],
    },
  };
}

function buildSupabaseMock(handlers: {
  paymentSingle?: Record<string, unknown> | null;
  songRequestsUpdate?: () => { error: unknown } | null;
}) {
  const songRequestsUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
  });
  const songsSelect = vi.fn();
  const songsOrder = vi.fn().mockResolvedValue({ data: [{ id: SONG_ID, title: 'T', song_requests: [{ id: REQUEST_ID, recipient_name: 'Ana', music_style: 'Semba' }] }], error: null });
  songsSelect.mockReturnValue({ order: songsOrder });
  const paymentsOrder = vi.fn().mockResolvedValue({ data: [{ request_id: REQUEST_ID, plan: 'standard', created_at: '2026-08-15T00:00:00Z' }], error: null });
  const paymentsIn = vi.fn().mockReturnValue({ order: paymentsOrder });
  const paymentsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: handlers.paymentSingle, error: null }),
    in: paymentsIn,
    order: paymentsOrder,
  });

  const from = vi.fn((table: string) => {
    if (table === 'payments') {
      return {
        update: vi.fn().mockReturnThis(),
        select: paymentsSelect,
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: handlers.paymentSingle, error: null }),
      };
    }
    if (table === 'songs') {
      return { select: songsSelect, order: songsOrder };
    }
    if (table === 'song_requests') {
      return {
        update: songRequestsUpdate,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
    }
    return { update: vi.fn().mockResolvedValue({ error: null }), select: vi.fn().mockResolvedValue({ data: [], error: null }) };
  });

  (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { from, songRequestsUpdate, songsSelect, songsOrder, paymentsSelect, paymentsIn, paymentsOrder };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/payment/:id/approve', () => {
  it('Standard com áudio pronto: agendamento 24h (approved + deliver_at) e email de confirmação', async () => {
    const base = await startServer();
    const { songRequestsUpdate } = buildSupabaseMock({ paymentSingle: buildPaymentRow() });

    const res = await fetch(`${base}/api/admin/payment/${PAYMENT_ID}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ notes: 'ok' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.isStandard).toBe(true);

    const updateCall = songRequestsUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateCall.status).toBe('approved');
    expect(updateCall.deliver_at).toBeTruthy();
    expect(updateCall.final_mixed_audio_url).toBe('https://audio.full.mp3');
    expect(sendConfirmationEmail).toHaveBeenCalledWith('ze@z.pt', 'Ana', REQUEST_ID, 'standard_approved');
    expect(sendPurchaseEvent).toHaveBeenCalledTimes(1);
    expect(sendPurchaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ value: 4.17, currency: 'USD' })
    );
  });

  it('Express com áudio pronto: entrega imediata (delivered + delivered_at)', async () => {
    const base = await startServer();
    const { songRequestsUpdate } = buildSupabaseMock({ paymentSingle: buildPaymentRow({ plan: 'express' }) });

    const res = await fetch(`${base}/api/admin/payment/${PAYMENT_ID}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const updateCall = songRequestsUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateCall.status).toBe('delivered');
    expect(updateCall.delivered_at).toBeTruthy();
  });

  it('devolve 409 quando o pagamento não está em pending_verification', async () => {
    const base = await startServer();
    buildSupabaseMock({ paymentSingle: null });

    const res = await fetch(`${base}/api/admin/payment/${PAYMENT_ID}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(409);
    expect(sendConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/payment/:id/reject', () => {
  it('marca pagamento rejected e o pedido como payment_rejected', async () => {
    const base = await startServer();
    const from = buildSupabaseMock({ paymentSingle: { id: PAYMENT_ID, user_email: 'ze@z.pt', request_id: REQUEST_ID, status: 'pending_verification', proof_path: 'x' } }).from;

    const res = await fetch(`${base}/api/admin/payment/${PAYMENT_ID}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ notes: 'comprovativo ilegível' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const paymentsUpdateCall = from.mock.calls.find(c => c[0] === 'payments');
    expect(paymentsUpdateCall).toBeTruthy();
    expect(sendPaymentRejectionEmail).toHaveBeenCalledWith('ze@z.pt', 'comprovativo ilegível');
  });

  it('devolve 409 quando o pagamento já foi processado', async () => {
    const base = await startServer();
    buildSupabaseMock({ paymentSingle: null });

    const res = await fetch(`${base}/api/admin/payment/${PAYMENT_ID}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(409);
    expect(sendPaymentRejectionEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/request/:id/force-status', () => {
  it('preenche delivered_at quando força song_requests para delivered', async () => {
    const base = await startServer();
    const songRequestsUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: REQUEST_ID, status: 'lyrics_ready' },
            error: null,
          }),
        }),
      }),
    });
    const songRequestSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: REQUEST_ID,
            recipient_name: 'Ana',
            users: { email: 'ze@z.pt' },
            songs: [{ id: SONG_ID, title: 'T', letter_text: 'Carta' }],
          },
          error: null,
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'song_requests') {
        return { update: songRequestsUpdate, select: songRequestSelect };
      }
      return { update: vi.fn().mockResolvedValue({ error: null }) };
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const res = await fetch(`${base}/api/admin/request/${REQUEST_ID}/force-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ table: 'song_requests', status: 'delivered' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const updateCall = songRequestsUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateCall.status).toBe('delivered');
    expect(updateCall.delivered_at).toBeTruthy();
    expect(sendPersonalizedEmail).toHaveBeenCalledWith('ze@z.pt', 'Ana', expect.stringContaining('/song/'), 'Carta');
  });

  it('não toca em delivered_at quando força para outro status', async () => {
    const base = await startServer();
    const songRequestsUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: REQUEST_ID, status: 'lyrics_ready' }, error: null }),
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'song_requests') return { update: songRequestsUpdate, select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
      return { update: vi.fn().mockResolvedValue({ error: null }) };
    });
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const res = await fetch(`${base}/api/admin/request/${REQUEST_ID}/force-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ table: 'song_requests', status: 'failed' }),
    });

    expect(res.status).toBe(200);
    const updateCall = songRequestsUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateCall.status).toBe('failed');
    expect(updateCall.delivered_at).toBeUndefined();
  });
});

describe('POST /api/admin/cron/deliver-pending', () => {
  it('devolve 404 (endpoint órfão removido — scheduler interno entrega)', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/admin/cron/deliver-pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/songs', () => {
  it('devolve músicas com plan vindo de payments para o filtro de plano funcionar', async () => {
    const base = await startServer();
    const { songsSelect, paymentsSelect, paymentsIn } = buildSupabaseMock({ paymentSingle: null });

    const res = await fetch(`${base}/api/admin/songs`, {
      headers: { Authorization: authHeader() },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.songs?.[0]?.song_requests?.[0]?.plan).toBe('standard');

    const selectArg = songsSelect.mock.calls[0]?.[0] as string;
    expect(selectArg).not.toContain('plan');
    expect(paymentsSelect).toHaveBeenCalledWith('request_id, plan, created_at');
    expect(paymentsIn).toHaveBeenCalledWith('request_id', [REQUEST_ID]);
  });
});
