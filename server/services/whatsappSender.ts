import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { getAdminSupabase } from './supabase';
import { logInfo, logWarn, logError } from '../utils/logger';

// Sessão Baileys persistida numa pasta local + espelho no Supabase (disco do Render é efémero).
const AUTH_DIR = path.join(process.cwd(), '.whatsapp-auth');
const SESSION_ID = '00000000-0000-0000-0000-000000000001';

// Constrains da campanha (configuráveis por env)
const DAILY_CAP = Number(process.env.WHATSAPP_DAILY_CAP || 30);
const START_HOUR = Number(process.env.WHATSAPP_START_HOUR || 9);
const END_HOUR = Number(process.env.WHATSAPP_END_HOUR || 20);

interface ConnectionUpdate {
  connection?: string;
  lastDisconnect?: { error?: { output?: { statusCode?: number } } };
  qr?: string;
}

export interface BulkClient {
  requestId: string;
  phone: string; // E.164 (dígitos)
  message: string;
}

export interface BulkOptions {
  force?: boolean; // ignora cap diário e horário
}

interface SendProgress {
  running: boolean;
  total: number;
  processed: number;
  sent: number;
  skippedNoWhatsApp: number;
  failed: number;
  startedAt: string | null;
  finishedAt: string | null;
}

let sendProgress: SendProgress = {
  running: false,
  total: 0,
  processed: 0,
  sent: 0,
  skippedNoWhatsApp: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
};

let activeSocket: WASocket | null = null;
let activeSaveCreds: (() => Promise<void>) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistência da sessão (pasta local ⇄ Supabase)
// ─────────────────────────────────────────────────────────────────────────────

async function folderHasCreds(): Promise<boolean> {
  try {
    await fs.promises.access(path.join(AUTH_DIR, 'creds.json'));
    return true;
  } catch {
    return false;
  }
}

async function restoreAuthState(): Promise<void> {
  if (await folderHasCreds()) return;
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from('whatsapp_session')
      .select('auth_state')
      .eq('id', SESSION_ID)
      .maybeSingle();
    if (!data?.auth_state || typeof data.auth_state !== 'object') return;
    await fs.promises.mkdir(AUTH_DIR, { recursive: true });
    for (const [file, content] of Object.entries(data.auth_state as Record<string, string>)) {
      await fs.promises.writeFile(path.join(AUTH_DIR, file), String(content), 'utf8');
    }
    logInfo('[WhatsApp] Sessão restaurada do Supabase');
  } catch (err) {
    logWarn('[WhatsApp] Falha ao restaurar sessão', { error: err instanceof Error ? err.message : String(err) });
  }
}

async function persistAuthState(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    const files = await fs.promises.readdir(AUTH_DIR);
    const blob: Record<string, string> = {};
    for (const f of files) {
      blob[f] = await fs.promises.readFile(path.join(AUTH_DIR, f), 'utf8');
    }
    await supabase.from('whatsapp_session').upsert(
      { id: SESSION_ID, auth_state: blob, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  } catch (err) {
    logWarn('[WhatsApp] Falha ao persistir sessão', { error: err instanceof Error ? err.message : String(err) });
  }
}

async function clearAuthState(): Promise<void> {
  try {
    await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
  const supabase = getAdminSupabase();
  if (supabase) {
    await supabase.from('whatsapp_session').delete().eq('id', SESSION_ID);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligação Baileys
// ─────────────────────────────────────────────────────────────────────────────

function connectSocket() {
  return useMultiFileAuthState(AUTH_DIR).then(({ state, saveCreds }) => {
    return fetchLatestBaileysVersion().then(({ version }) => {
      const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });
      return { sock, saveCreds };
    });
  });
}

async function connectAndWaitOpen(): Promise<{ sock: WASocket; saveCreds: () => Promise<void> }> {
  await restoreAuthState();
  if (activeSocket?.user?.id) {
    return { sock: activeSocket, saveCreds: activeSaveCreds || (async () => {}) };
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    connectSocket().then(({ sock, saveCreds }) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        sock.end(new Error('timeout'));
        reject(new Error('Timeout ao ligar ao WhatsApp. Tenta novamente.'));
      }, 45000);

      sock.ev.on('connection.update', async (raw) => {
        if (settled) return;
        const update = raw as ConnectionUpdate;
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
          settled = true;
          clearTimeout(timer);
          activeSocket = sock;
          activeSaveCreds = saveCreds;
          resolve({ sock, saveCreds });
          return;
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
            settled = true;
            clearTimeout(timer);
            await clearAuthState();
            activeSocket = null;
            activeSaveCreds = null;
            reject(new Error('Sessão WhatsApp terminada. Faz o scan do QR novamente.'));
          }
        }
      });

      sock.ev.on('creds.update', () => {
        saveCreds().then(persistAuthState).catch(() => {});
      });
    }).catch((err) => {
      if (settled) return;
      settled = true;
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública para as rotas
// ─────────────────────────────────────────────────────────────────────────────

export async function getLinkStatus(): Promise<{ linked: boolean }> {
  if (activeSocket?.user?.id) return { linked: true };
  await restoreAuthState();
  return { linked: await folderHasCreds() };
}

/**
 * Liga o número por QR. Se já houver sessão, devolve { status: 'linked' }.
 * Se não, devolve { status: 'qr', qr } e mantém o socket aberto para o scan completar.
 */
export async function startLink(): Promise<{ status: 'qr' | 'linked'; qr?: string }> {
  const current = await getLinkStatus();
  if (current.linked) return { status: 'linked' };

  return new Promise((resolve, reject) => {
    let settled = false;
    connectSocket().then(({ sock, saveCreds }) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        sock.end(new Error('timeout'));
        reject(new Error('Timeout ao gerar QR. Tenta novamente.'));
      }, 60000);

      sock.ev.on('connection.update', async (raw) => {
        if (settled) return;
        const update = raw as ConnectionUpdate;
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          settled = true;
          clearTimeout(timer);
          activeSocket = sock;
          activeSaveCreds = saveCreds;
          resolve({ status: 'qr', qr });
          return;
        }
        if (connection === 'open') {
          settled = true;
          clearTimeout(timer);
          activeSocket = sock;
          activeSaveCreds = saveCreds;
          saveCreds().then(persistAuthState).catch(() => {});
          resolve({ status: 'linked' });
          return;
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
            settled = true;
            clearTimeout(timer);
            await clearAuthState();
            activeSocket = null;
            activeSaveCreds = null;
            reject(new Error('Sessão WhatsApp terminada. Faz o scan do QR novamente.'));
          }
        }
      });

      sock.ev.on('creds.update', () => {
        saveCreds().then(persistAuthState).catch(() => {});
      });
    }).catch((err) => {
      if (settled) return;
      settled = true;
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

export function getSendProgress(): SendProgress {
  return sendProgress;
}

async function hasAuthState(): Promise<boolean> {
  await restoreAuthState();
  return folderHasCreds();
}

async function checkConstraints(force: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (force) return { ok: true };
  const h = new Date().getHours();
  if (h < START_HOUR || h >= END_HOUR) {
    return { ok: false, error: `Fora do horário definido (${START_HOUR}h–${END_HOUR}h). Usa o modo forçado para continuar.` };
  }
  const supabase = getAdminSupabase();
  if (supabase) {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('whatsapp_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', today);
    if ((count ?? 0) >= DAILY_CAP) {
      return { ok: false, error: `Limite diário atingido (${count}/${DAILY_CAP}). Usa o modo forçado para continuar.` };
    }
  }
  return { ok: true };
}

async function logSend(client: BulkClient, status: 'sent' | 'skipped' | 'failed', error?: string): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase.from('whatsapp_send_log').insert({
      request_id: client.requestId,
      phone: client.phone,
      status,
      error: error || null,
    });
  } catch {
    // registo é best-effort
  }
}

async function markContacted(requestId: string): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('song_requests')
      .update({ manual_contacted_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch {
    // best-effort
  }
}

/**
 * Envia a fila de mensagens em background. Devolve imediatamente; o progresso
 * é lido via getSendProgress().
 */
export async function runSendBulk(clients: BulkClient[], opts: BulkOptions = {}): Promise<void> {
  if (sendProgress.running) {
    throw new Error('Já existe um envio em curso. Aguarda terminar.');
  }
  if (!clients.length) {
    throw new Error('Não há clientes para enviar.');
  }
  if (!(await hasAuthState())) {
    throw new Error('WhatsApp não ligado. Faz o scan do QR primeiro.');
  }

  sendProgress = {
    running: true,
    total: clients.length,
    processed: 0,
    sent: 0,
    skippedNoWhatsApp: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  logInfo('[WhatsApp] Campanha iniciada', { total: clients.length, force: !!opts.force });

  try {
    const check = await checkConstraints(opts.force ?? false);
    if (!check.ok) throw new Error(check.error);

    const { sock, saveCreds } = await connectAndWaitOpen();

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      sendProgress.processed += 1;
      try {
        const exists = await sock.onWhatsApp(client.phone);
        const onWhatsApp = exists && exists.length > 0 && exists[0].exists;
        if (!onWhatsApp) {
          sendProgress.skippedNoWhatsApp += 1;
          logWarn('[WhatsApp] Número sem WhatsApp', { phone: client.phone });
          await logSend(client, 'skipped', 'número sem WhatsApp');
          continue;
        }
        await sock.sendMessage(`${client.phone}@s.whatsapp.net`, { text: client.message });
        sendProgress.sent += 1;
        await markContacted(client.requestId);
        await logSend(client, 'sent');
      } catch (err) {
        sendProgress.failed += 1;
        logError('[WhatsApp] Falha ao enviar', err instanceof Error ? err : new Error(String(err)), { phone: client.phone });
        await logSend(client, 'failed', err instanceof Error ? err.message : String(err));
      }
      if (i < clients.length - 1) {
        await sleep(8000 + Math.floor(Math.random() * 7000));
      }
    }

    saveCreds().then(persistAuthState).catch(() => {});
    sock.end(new Error('campaign-done'));
    activeSocket = null;
    activeSaveCreds = null;
  } catch (err) {
    logError('[WhatsApp] Campanha falhou', err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    sendProgress.finishedAt = new Date().toISOString();
    sendProgress.running = false;
  }
}
