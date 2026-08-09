import { describe, it, expect, beforeEach, afterAll, vi, type Server } from 'vitest';
import express from 'express';
import type http from 'node:http';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-1234567890';
process.env.ADMIN_PASSWORD = 'test-admin-password';

vi.mock('../services/whatsappSender', () => ({
  getLinkStatus: vi.fn(),
  getSendProgress: vi.fn(),
  runSendBulk: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));

import { getLinkStatus, getSendProgress, runSendBulk } from '../services/whatsappSender';
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
  it('devolve 400 quando o WhatsApp não está ligado', async () => {
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
    expect(body.error).toContain('WhatsApp não ligado');
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
