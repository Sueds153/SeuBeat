import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-1234567890';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.WHATSAPP_ENABLED_BUCKETS = '30min';

vi.mock('../services/whatsappSender', () => ({
  getLinkStatus: vi.fn(),
  getSendProgress: vi.fn(),
  runSendBulk: vi.fn(),
  getConfigStatus: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));

import { getLinkStatus, getSendProgress, runSendBulk, getConfigStatus } from '../services/whatsappSender';
import { getAdminSupabase } from '../services/supabase';
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

function buildSupabaseMock(data: unknown[]) {
  const query = {
    from: () => query,
    select: () => query,
    in: () => query,
    is: () => query,
    not: () => query,
    order: () => query,
    then: (resolve: (v: unknown) => unknown) => resolve({ data, error: null }),
  };
  (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue({ from: () => query });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/abandoned/send-bulk', () => {
  it('devolve 400 quando a WhatsApp API não está configurada', async () => {
    const base = await startServer();
    const created = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    buildSupabaseMock([
      { id: '11111111-1111-4111-8111-111111111111', phone: '244900000000', recipient_name: 'Ana', created_at: created, email: 'a@b.c', users: [] },
    ]);
    (getSendProgress as ReturnType<typeof vi.fn>).mockReturnValue({ running: false });
    (getLinkStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ linked: false });

    const res = await fetch(`${base}/api/admin/abandoned/send-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('WHATSAPP_API_TOKEN');
    expect(runSendBulk).not.toHaveBeenCalled();
  });

  it('inicia a campanha em background quando ligado', async () => {
    const base = await startServer();
    const created = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    buildSupabaseMock([
      { id: '22222222-2222-4222-8222-222222222222', phone: '244900000001', recipient_name: 'Bruno', created_at: created, email: 'b@c.d', users: [] },
    ]);
    (getSendProgress as ReturnType<typeof vi.fn>).mockReturnValue({ running: false });
    (getLinkStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ linked: true });
    (runSendBulk as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await fetch(`${base}/api/admin/abandoned/send-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.started).toBe(true);
    expect(runSendBulk).toHaveBeenCalledTimes(1);
  });

  it('devolve 409 quando já há envio em curso', async () => {
    const base = await startServer();
    const created = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    buildSupabaseMock([
      { id: '33333333-3333-4333-8333-333333333333', phone: '244900000002', recipient_name: 'Carla', created_at: created, email: 'c@d.e', users: [] },
    ]);
    (getSendProgress as ReturnType<typeof vi.fn>).mockReturnValue({ running: true });

    const res = await fetch(`${base}/api/admin/abandoned/send-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('envio em curso');
  });
});

describe('GET /api/admin/abandoned?range=', () => {
  it('devolve 400 para range inválido', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/admin/abandoned?range=xx`, {
      headers: { Authorization: authHeader() },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Filtro de tempo inválido');
  });

  it('filtra clientes pelo range 1-6h', async () => {
    const base = await startServer();
    const h = 60 * 60 * 1000;
    const now = Date.now();
    buildSupabaseMock([
      { id: '44444444-4444-4444-8444-444444444444', phone: '244900000003', recipient_name: 'Ana', created_at: new Date(now - 2 * h).toISOString(), email: 'a@x.pt', users: [] },
      { id: '55555555-5555-4555-8555-555555555555', phone: '244900000004', recipient_name: 'Bruno', created_at: new Date(now - 10 * h).toISOString(), email: 'b@x.pt', users: [] },
      { id: '66666666-6666-4666-8666-666666666666', phone: '244900000005', recipient_name: 'Carla', created_at: new Date(now - 30 * h).toISOString(), email: 'c@x.pt', users: [] },
    ]);
    (getLinkStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ linked: false });

    const res = await fetch(`${base}/api/admin/abandoned?range=1-6h`, {
      headers: { Authorization: authHeader() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const ids = body.buckets.flatMap((b: { clients: { id: string }[] }) => b.clients.map((c: { id: string }) => c.id));
    expect(ids).toEqual(['44444444-4444-4444-8444-444444444444']);
    expect(body.total).toBe(1);
    expect(body.notContacted).toBe(1);
  });

  it('sem range devolve todos os bucketed', async () => {
    const base = await startServer();
    const h = 60 * 60 * 1000;
    const now = Date.now();
    buildSupabaseMock([
      { id: '77777777-7777-4777-8777-777777777777', phone: '244900000006', recipient_name: 'Ana', created_at: new Date(now - 2 * h).toISOString(), email: 'a@x.pt', users: [] },
      { id: '88888888-8888-4888-8888-888888888888', phone: '244900000007', recipient_name: 'Bruno', created_at: new Date(now - 10 * h).toISOString(), email: 'b@x.pt', users: [] },
      { id: '99999999-9999-4999-8999-999999999999', phone: '244900000008', recipient_name: 'Carla', created_at: new Date(now - 30 * h).toISOString(), email: 'c@x.pt', users: [] },
    ]);
    (getLinkStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ linked: false });

    const res = await fetch(`${base}/api/admin/abandoned`, {
      headers: { Authorization: authHeader() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
  });
});

describe('GET /api/admin/whatsapp/config-status', () => {
  it('devolve configured true com phone quando a API está configurada', async () => {
    const base = await startServer();
    (getConfigStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: true,
      phone: '244922058136',
      phoneNumberId: '123456789',
      templates: [{ bucket: '30min', name: 'seubeat_abandono_30min_v6' }],
      enabledBuckets: ['30min'],
    });

    const res = await fetch(`${base}/api/admin/whatsapp/config-status`, {
      headers: { Authorization: authHeader() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.configured).toBe(true);
    expect(body.phone).toBe('244922058136');
    expect(getConfigStatus).toHaveBeenCalledTimes(1);
  });

  it('devolve configured false quando falta configuração', async () => {
    const base = await startServer();
    (getConfigStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: false,
      phone: '244922058136',
      phoneNumberId: null,
      templates: [],
      enabledBuckets: ['30min'],
    });

    const res = await fetch(`${base}/api/admin/whatsapp/config-status`, {
      headers: { Authorization: authHeader() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.configured).toBe(false);
    expect(body.phoneNumberId).toBeNull();
  });
});
