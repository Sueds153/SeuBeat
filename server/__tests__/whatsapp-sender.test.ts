import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('@whiskeysockets/baileys', () => {
  const { EventEmitter } = require('node:events') as typeof import('node:events');
  let currentSock: ReturnType<typeof makeMockSocket> | null = null;
  const makeMockSocket = () => {
    const sock = {
      ev: new EventEmitter(),
      user: null,
      end: vi.fn(),
      onWhatsApp: vi.fn(),
      sendMessage: vi.fn(),
    };
    currentSock = sock;
    return sock;
  };
  return {
    makeWASocket: () => makeMockSocket(),
    useMultiFileAuthState: async () => ({
      state: {},
      saveCreds: async () => {},
    }),
    fetchLatestBaileysVersion: async () => ({ version: [7, 0, 0] }),
    DisconnectReason: { loggedOut: 401, badSession: 500, connectionClosed: 428, connectionLost: 408, timedOut: 440 },
    __getCurrentSock: () => currentSock,
    __resetSock: () => {
      currentSock = null;
    },
  };
});

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
}));

import { getAdminSupabase } from '../services/supabase';

type Sender = typeof import('../services/whatsappSender');
type MockSock = { ev: EventEmitter; user: null; end: ReturnType<typeof vi.fn>; onWhatsApp: ReturnType<typeof vi.fn>; sendMessage: ReturnType<typeof vi.fn> };

let authDir: string;
let wa: Sender;

beforeEach(async () => {
  authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-auth-'));
  process.env.WHATSAPP_AUTH_DIR = authDir;
  vi.clearAllMocks();
  vi.resetModules();
  const baileys = await import('@whiskeysockets/baileys') as unknown as { __resetSock: () => void };
  baileys.__resetSock();
  wa = await import('../services/whatsappSender');
});

afterEach(() => {
  fs.rmSync(authDir, { recursive: true, force: true });
  delete process.env.WHATSAPP_AUTH_DIR;
});

function writeCreds(creds: unknown): void {
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, 'creds.json'), JSON.stringify(creds), 'utf8');
}

function mockSupabaseUpsert() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const query = {
    from: () => query,
    upsert,
    select: () => query,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    eq: () => query,
    delete: () => query,
  };
  (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(query);
  return upsert;
}

describe('getLinkStatus', () => {
  it('devolve linked=false sem creds (nenhuma sessão)', async () => {
    const status = await wa.getLinkStatus();
    expect(status.linked).toBe(false);
  });

  it('devolve linked=false quando creds.json existe mas sem me (sessão parcial pré-scan)', async () => {
    writeCreds({ registered: false, routingInfo: 'abc' });
    const status = await wa.getLinkStatus();
    expect(status.linked).toBe(false);
  });

  it('devolve linked=true quando creds.json tem me.id (sessão pareada)', async () => {
    writeCreds({ registered: true, me: { id: '2449@s.whatsapp.net' } });
    const promise = wa.getLinkStatus();
    const baileys = await import('@whiskeysockets/baileys') as unknown as {
      __getCurrentSock: () => MockSock | null;
    };
    let sock = baileys.__getCurrentSock();
    const started = Date.now();
    while (!sock && Date.now() - started < 2000) {
      await new Promise((r) => setTimeout(r, 5));
      sock = baileys.__getCurrentSock();
    }
    expect(sock).not.toBeNull();
    (sock as MockSock).user = { id: '2449@s.whatsapp.net' } as never;
    sock!.ev.emit('connection.update', { connection: 'open' });
    const status = await promise;
    expect(status.linked).toBe(true);
  });
});

describe('persistAuthState', () => {
  it('não grava no Supabase quando a sessão é parcial (sem me)', async () => {
    const upsert = mockSupabaseUpsert();
    writeCreds({ registered: false });
    await wa.persistAuthState();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('grava no Supabase quando a sessão tem me (pareada)', async () => {
    const upsert = mockSupabaseUpsert();
    writeCreds({ registered: true, me: { id: '2449@s.whatsapp.net' } });
    await wa.persistAuthState();
    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload] = upsert.mock.calls[0] as unknown[];
    expect((payload as { auth_state: Record<string, string> }).auth_state['creds.json']).toContain('2449');
  });
});

describe('startLink', () => {
  it('devolve status=linked quando já existe sessão pareada', async () => {
    writeCreds({ registered: true, me: { id: '2449@s.whatsapp.net' } });
    const promise = wa.startLink();
    const baileys = await import('@whiskeysockets/baileys') as unknown as {
      __getCurrentSock: () => MockSock | null;
    };
    let sock = baileys.__getCurrentSock();
    const started = Date.now();
    while (!sock && Date.now() - started < 2000) {
      await new Promise((r) => setTimeout(r, 5));
      sock = baileys.__getCurrentSock();
    }
    expect(sock).not.toBeNull();
    (sock as MockSock).user = { id: '2449@s.whatsapp.net' } as never;
    sock!.ev.emit('connection.update', { connection: 'open' });
    const result = await promise;
    expect(result.status).toBe('linked');
  });

  it('devolve status=qr (não linked) quando existe apenas creds parcial', async () => {
    writeCreds({ registered: false });
    mockSupabaseUpsert();
    const promise = wa.startLink();
    const baileys = await import('@whiskeysockets/baileys') as unknown as {
      __getCurrentSock: () => MockSock | null;
    };
    let sock = baileys.__getCurrentSock();
    const started = Date.now();
    while (!sock && Date.now() - started < 2000) {
      await new Promise((r) => setTimeout(r, 5));
      sock = baileys.__getCurrentSock();
    }
    expect(sock).not.toBeNull();
    sock!.ev.emit('connection.update', { qr: '2@abc' });
    const result = await promise;
    expect(result.status).toBe('qr');
    expect(result.qr).toBe('2@abc');
  });
});
