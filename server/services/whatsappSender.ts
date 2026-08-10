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
import { qrToDataUrl } from '../utils/qr';
import { logInfo, logWarn, logError } from '../utils/logger';

// Sessão Baileys persistida numa pasta local + espelho no Supabase (disco do Render é efémero).
const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR
  ? path.resolve(process.env.WHATSAPP_AUTH_DIR)
  : path.join(process.cwd(), '.whatsapp-auth');
const SESSION_ID = '00000000-0000-0000-0000-000000000001';

// Constrains da campanha (configuráveis por env)
const DAILY_CAP = Number(process.env.WHATSAPP_DAILY_CAP || 30);
const START_HOUR = Number(process.env.WHATSAPP_START_HOUR || 9);
const END_HOUR = Number(process.env.WHATSAPP_END_HOUR || 20);
// Atraso anti-spam entre mensagens (30–90s), configurável por env.
const MIN_SEND_DELAY_MS = Number(process.env.WHATSAPP_MIN_SEND_DELAY_MS || 30_000);
const MAX_SEND_DELAY_MS = Number(process.env.WHATSAPP_MAX_SEND_DELAY_MS || 90_000);

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
  // reservado para opções futuras — o cap diário e o horário nunca são ignorados
}

interface SendProgress {
  running: boolean;
  total: number;
  processed: number;
  sent: number;
  skippedNoWhatsApp: number;
  failed: number;
  error: string | null;
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
  error: null,
  startedAt: null,
  finishedAt: null,
};

let activeSocket: WASocket | null = null;
let activeSaveCreds: (() => Promise<void>) | null = null;

// Liveness real da ligação — `activeSocket.user` fica preenchido mesmo depois
// da ligação cair, por isso o estado `connected` é só confiável via este flag,
// atualizado no handler global de connection.update.
let liveConnected = false;
// Reconexão automática após quedas não-fatais (connectionClosed/Lost/timedOut/
// restartRequired/connectionReplaced) — backoff exponencial 5s→60s.
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
// Persistência periódica do espelho no Supabase enquanto houver sessão válida.
let persistenceTimer: NodeJS.Timeout | null = null;

const MAX_RECONNECT_DELAY_MS = 60_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PERSIST_INTERVAL_MS = 5 * 60_000;

// Último QR gerado pelo Baileys (string crua). O QR regenera a cada ~20s até o
// scan completar — guardamos o mais recente para o frontend poder refrescar.
let latestQr: string | null = null;

// Resultado da última verificação "ao vivo" (socket aberto de verdade). Cache
// curto para o polling de link-status não abrir um socket a cada 5s.
let lastLiveCheck: { at: number; linked: boolean; phone?: string } | null = null;
const LIVE_CHECK_TTL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistência da sessão (pasta local ⇄ Supabase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devolve true apenas quando existe uma sessão realmente pareada.
 * O Baileys escreve `creds.json` durante a fase de QR (antes do scan) — por
 * exemplo via handler de `edge_routing` — com `registered: false` e SEM `me`.
 * Só depois do `pair-success` é que `creds.me.id` fica preenchido. Confiar só
 * na existência do ficheiro fazia `getLinkStatus()` reportar `linked: true`
 * sem o utilizador ter escaneado nada (bug "QR nem aparece").
 */
async function credsHasValidSession(): Promise<boolean> {
  try {
    const raw = await fs.promises.readFile(path.join(AUTH_DIR, 'creds.json'), 'utf8');
    const creds = JSON.parse(raw) as { me?: { id?: string } | null } | null;
    return !!creds?.me?.id;
  } catch {
    return false;
  }
}

async function restoreAuthState(): Promise<void> {
  if (await credsHasValidSession()) return;
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from('whatsapp_session')
      .select('auth_state')
      .eq('id', SESSION_ID)
      .maybeSingle();
    if (!data?.auth_state || typeof data.auth_state !== 'object') return;
    const storedCredsRaw = (data.auth_state as Record<string, string>)['creds.json'];
    if (!storedCredsRaw) return;
    const storedCreds = JSON.parse(storedCredsRaw) as { me?: { id?: string } | null } | null;
    if (!storedCreds?.me?.id) {
      logWarn('[WhatsApp] Sessão parcial no Supabase ignorada (sem creds.me) — será gerado novo QR');
      return;
    }
    await fs.promises.mkdir(AUTH_DIR, { recursive: true });
    for (const [file, content] of Object.entries(data.auth_state as Record<string, string>)) {
      await fs.promises.writeFile(path.join(AUTH_DIR, file), String(content), 'utf8');
    }
    logInfo('[WhatsApp] Sessão restaurada do Supabase');
  } catch (err) {
    logWarn('[WhatsApp] Falha ao restaurar sessão', { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function persistAuthState(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    if (!(await credsHasValidSession())) {
      logWarn('[WhatsApp] Sessão parcial ignorada na persistência (sem creds.me)');
      return;
    }
    const files = await fs.promises.readdir(AUTH_DIR);
    const blob: Record<string, string> = {};
    for (const f of files) {
      blob[f] = await fs.promises.readFile(path.join(AUTH_DIR, f), 'utf8');
    }
    await supabase.from('whatsapp_session').upsert(
      { id: SESSION_ID, auth_state: blob, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    logInfo('[WhatsApp] Sessão persistida no Supabase');
  } catch (err) {
    logWarn('[WhatsApp] Falha ao persistir sessão', { error: err instanceof Error ? err.message : String(err) });
  }
}

async function clearAuthState(): Promise<void> {
  latestQr = null;
  lastLiveCheck = null;
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

async function resolveBaileysVersion(): Promise<{ version: [number, number, number] }> {
  try {
    return await fetchLatestBaileysVersion();
  } catch {
    return { version: [7, 0, 0] };
  }
}

function connectSocket() {
  return useMultiFileAuthState(AUTH_DIR).then(({ state, saveCreds }) => {
    return resolveBaileysVersion().then(({ version }) => {
      const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });
      attachGlobalHandlers(sock, saveCreds);
      return { sock, saveCreds };
    });
  });
}

/**
 * Handler GLOBAL de cada socket Baileys. Garante que a liveness (`liveConnected`)
 * reflete a ligação real (não o `user.id` stale) e que quedas não-fatais são
 * resolvidas por reconexão automática — sem apagar credenciais.
 */
function attachGlobalHandlers(sock: WASocket, saveCreds: () => Promise<void>): void {
  sock.ev.on('creds.update', () => {
    saveCreds().then(persistAuthState).catch(() => {});
  });

  sock.ev.on('connection.update', (raw: unknown) => {
    const update = raw as ConnectionUpdate;
    const { connection, qr, lastDisconnect } = update;
    if (qr) latestQr = qr;
    if (connection === 'open') {
      liveConnected = true;
      reconnectAttempts = 0;
      if (activeSocket !== sock) {
        activeSocket = sock;
        activeSaveCreds = saveCreds;
      }
      saveCreds().then(persistAuthState).catch(() => {});
      startPersistenceTimer();
      return;
    }
    if (connection === 'close') {
      liveConnected = false;
      lastLiveCheck = null;
      if (activeSocket === sock) {
        activeSocket = null;
        activeSaveCreds = null;
      }
      const code = lastDisconnect?.error?.output?.statusCode;
      logWarn('[WhatsApp] Socket fechado (global)', { code: code ?? null });
      if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
        latestQr = null;
        void clearAuthState();
        return;
      }
      // Quedas não-fatais (connectionClosed/connectionLost/timedOut/
      // restartRequired/connectionReplaced): reconectar sem apagar a sessão.
      scheduleReconnect();
    }
  });
}

// Serialização da criação do socket: com o mesmo AUTH_DIR, abrir dois sockets
// em simultâneo faz o WhatsApp invalidar a sessão (o segundo substitui o
// primeiro). Este promise-chain garante uma criação de cada vez.
let socketCreatePromise: Promise<{ sock: WASocket; saveCreds: () => Promise<void> }> | null = null;

function ensureSocketCreated(): Promise<{ sock: WASocket; saveCreds: () => Promise<void> }> {
  if (!socketCreatePromise) {
    socketCreatePromise = connectSocket().finally(() => {
      socketCreatePromise = null;
    });
  }
  return socketCreatePromise;
}

/** Liveness real: socket existente, autenticado e com ligação confirmada como aberta. */
function isSocketAlive(): boolean {
  return !!activeSocket?.user?.id && liveConnected === true;
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logWarn('[WhatsApp] Circuit breaker: demasiadas reconexões falhadas — auto-reconexão desligada até nova ligação manual');
    return;
  }
  const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
  reconnectAttempts += 1;
  const timer = setTimeout(() => {
    reconnectTimer = null;
    void reconnectInBackground();
  }, delay);
  timer.unref?.();
  reconnectTimer = timer;
}

async function reconnectInBackground(): Promise<void> {
  try {
    await restoreAuthState();
    // Pairing QR em curso — não interferir (o scan do admin está a decorrer).
    if (activeSocket && !activeSocket.user?.id) return;
    if (!(await credsHasValidSession())) return;
    if (isSocketAlive()) return;
    await connectAndWaitOpen();
    logInfo('[WhatsApp] Ligação restabelecida automaticamente após queda');
  } catch {
    scheduleReconnect();
  }
}

function stopReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function startPersistenceTimer(): void {
  if (persistenceTimer) return;
  const timer = setInterval(() => {
    void persistAuthState();
  }, PERSIST_INTERVAL_MS);
  timer.unref?.();
  persistenceTimer = timer;
}

function stopPersistenceTimer(): void {
  if (persistenceTimer) {
    clearInterval(persistenceTimer);
    persistenceTimer = null;
  }
}

async function connectAndWaitOpen(): Promise<{ sock: WASocket; saveCreds: () => Promise<void> }> {
  await restoreAuthState();
  // Liveness real: só reusa o socket atual se a ligação estiver confirmada como
  // aberta (não basta `user.id` — fica stale depois da ligação cair).
  if (isSocketAlive()) {
    return { sock: activeSocket as WASocket, saveCreds: activeSaveCreds || (async () => {}) };
  }
  // Socket em fase de pairing (QR ainda por escanear): abrir um segundo socket
  // com as mesmas credenciais mataria o primeiro. Devolvemos erro claro.
  if (activeSocket && !activeSocket.user?.id) {
    throw new Error('Ligação do WhatsApp em curso (QR). Completa o scan primeiro.');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    ensureSocketCreated().then(({ sock, saveCreds }) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        sock.end(new Error('timeout'));
        reject(new Error('Timeout ao ligar ao WhatsApp. Tenta novamente.'));
      }, 45000);

      sock.ev.on('connection.update', async (raw) => {
        const update = raw as ConnectionUpdate;
        const { connection, lastDisconnect } = update;
        if (settled && connection !== 'open' && connection !== 'close') return;
        if (connection === 'open') {
          settled = true;
          clearTimeout(timer);
          latestQr = null;
          activeSocket = sock;
          activeSaveCreds = saveCreds;
          resolve({ sock, saveCreds });
          return;
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          logWarn('[WhatsApp] Socket fechado', { code });
          if (
            code === DisconnectReason.loggedOut ||
            code === DisconnectReason.badSession ||
            code === DisconnectReason.connectionReplaced
          ) {
            settled = true;
            clearTimeout(timer);
            await clearAuthState();
            activeSocket = null;
            activeSaveCreds = null;
            latestQr = null;
            reject(new Error('Sessão WhatsApp terminada. Faz o scan do QR novamente.'));
          } else if (code === DisconnectReason.restartRequired) {
            settled = true;
            clearTimeout(timer);
            activeSocket = null;
            activeSaveCreds = null;
            reject(new Error('O WhatsApp pediu reinício da ligação. Tenta novamente.'));
          }
          // connectionClosed/connectionLost/timeout: deixa o timer expirar e
          // o handler repõe o socket.
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

/**
 * Verificação "ao vivo": abre o socket Baileys e confirma o número autenticado.
 * Diferente do getLinkStatus() (que só reflete a existência de uma sessão
 * válida em disco), esta função realmente conecta. Usada pelo botão
 * "Verificar ligação" e pelo live-check do getLinkStatus().
 */
async function liveCheckSocket(): Promise<{ linked: boolean; phone?: string; error?: string }> {
  try {
    const { sock } = await connectAndWaitOpen();
    const jid = sock?.user?.id || activeSocket?.user?.id;
    if (jid) {
      const digits = String(jid).split('@')[0]?.replace(/\D/g, '') || '';
      logInfo('[WhatsApp] liveCheckSocket: ligação confirmada', { jid });
      return { linked: true, phone: digits };
    }
    logWarn('[WhatsApp] liveCheckSocket: socket aberto mas sem user.id');
    return { linked: false, error: 'Socket aberto mas sem utilizador autenticado.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWarn('[WhatsApp] liveCheckSocket: falhou', { error: message });
    return { linked: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública para as rotas
// ─────────────────────────────────────────────────────────────────────────────

export async function getLinkStatus(): Promise<{ linked: boolean; qr?: string }> {
  // Socket realmente aberto e autenticado — ligação confirmada (liveness real).
  if (isSocketAlive()) return { linked: true };

  // Cache curto da verificação viva para o polling não abrir socket a cada 5s.
  if (lastLiveCheck && Date.now() - lastLiveCheck.at < LIVE_CHECK_TTL_MS) {
    if (lastLiveCheck.linked) return { linked: true };
    if (latestQr) return { linked: false, qr: await qrToDataUrl(latestQr) };
    return { linked: false };
  }

  await restoreAuthState();

  // Sessão em disco mas sem socket vivo: confirmar de verdade. Se o WhatsApp a
  // rejeitar (loggedOut/badSession), limpamos a sessão morta para o painel não
  // mostrar "ligado" e para o próximo scan começar limpo.
  if (await credsHasValidSession()) {
    const live = await liveCheckSocket();
    lastLiveCheck = { at: Date.now(), linked: live.linked, phone: live.phone };
    if (live.linked) return { linked: true };
    logWarn('[WhatsApp] Sessão persistida inválida no servidor — a limpar para novo scan');
    await clearAuthState();
    lastLiveCheck = { at: Date.now(), linked: false };
  }

  if (latestQr) {
    return { linked: false, qr: await qrToDataUrl(latestQr) };
  }
  return { linked: false };
}

/**
 * Verificação real da ligação: abre o socket Baileys e confirma o número
 * autenticado. Usado pelo botão "Verificar ligação" do painel.
 */
export async function verifyConnection(): Promise<{ connected: boolean; phone?: string; error?: string }> {
  const live = await liveCheckSocket();
  lastLiveCheck = { at: Date.now(), linked: live.linked, phone: live.phone };
  if (live.linked) {
    return { connected: true, phone: live.phone };
  }
  // Sessão morta confirmada: limpar para o painel deixar de mostrar "ligado".
  await clearAuthState();
  lastLiveCheck = { at: Date.now(), linked: false };
  return { connected: false, error: live.error || 'WhatsApp não conectado.' };
}

/**
 * Liga o número por QR. Se já houver sessão, devolve { status: 'linked' }.
 * Se não, devolve { status: 'qr', qr } e mantém o socket aberto para o scan completar.
 */
export async function startLink(): Promise<{ status: 'qr' | 'linked'; qr?: string }> {
  const current = await getLinkStatus();
  if (current.linked) {
    logInfo('[WhatsApp] startLink: sessão válida existente, devolvido linked');
    return { status: 'linked' };
  }
  // QR já em curso (socket de pairing aberto): reutiliza em vez de abrir um
  // segundo socket com as mesmas credenciais (isso mataria o pairing).
  if (latestQr && activeSocket && !activeSocket.user?.id) {
    logInfo('[WhatsApp] startLink: QR em curso reutilizado');
    return { status: 'qr', qr: latestQr };
  }
  logInfo('[WhatsApp] startLink: sem sessão válida, a gerar QR');

  return new Promise((resolve, reject) => {
    let settled = false;
    ensureSocketCreated().then(({ sock, saveCreds }) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        sock.end(new Error('timeout'));
        reject(new Error('Timeout ao gerar QR. Tenta novamente.'));
      }, 60000);

      sock.ev.on('connection.update', async (raw) => {
        const update = raw as ConnectionUpdate;
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          latestQr = qr;
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          activeSocket = sock;
          activeSaveCreds = saveCreds;
          logInfo('[WhatsApp] startLink: QR gerado');
          resolve({ status: 'qr', qr });
          return;
        }
        if (connection === 'open') {
          latestQr = null;
          settled = true;
          clearTimeout(timer);
          activeSocket = sock;
          activeSaveCreds = saveCreds;
          logInfo('[WhatsApp] startLink: conexão aberta, sessão ligada');
          saveCreds().then(persistAuthState).catch(() => {});
          resolve({ status: 'linked' });
          return;
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          logWarn('[WhatsApp] startLink: socket fechado', { code });
          if (
            code === DisconnectReason.loggedOut ||
            code === DisconnectReason.badSession ||
            code === DisconnectReason.connectionReplaced
          ) {
            latestQr = null;
            settled = true;
            clearTimeout(timer);
            await clearAuthState();
            activeSocket = null;
            activeSaveCreds = null;
            reject(new Error('Sessão WhatsApp terminada. Faz o scan do QR novamente.'));
          } else if (code === DisconnectReason.restartRequired) {
            latestQr = null;
            settled = true;
            clearTimeout(timer);
            activeSocket = null;
            activeSaveCreds = null;
            reject(new Error('O WhatsApp pediu reinício da ligação. Tenta novamente.'));
          }
          // connectionClosed/connectionLost/timeout: deixa o timer expirar.
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

/**
 * Termina a sessão de forma explícita: encerra o socket ativo e remove todas
 * as credenciais (disco + Supabase). Usado pelo botão "Terminar sessão" do
 * painel para escapar de sessões mortas/reescanear do zero.
 */
export async function logout(): Promise<void> {
  stopReconnect();
  stopPersistenceTimer();
  const sock = activeSocket;
  activeSocket = null;
  activeSaveCreds = null;
  liveConnected = false;
  reconnectAttempts = 0;
  latestQr = null;
  lastLiveCheck = null;
  if (sock) {
    try {
      sock.end(new Error('logout'));
    } catch {
      // ignore
    }
  }
  await clearAuthState();
  logInfo('[WhatsApp] Sessão terminada manualmente');
}

async function hasAuthState(): Promise<boolean> {
  await restoreAuthState();
  return credsHasValidSession();
}

async function checkConstraints(): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = new Date().getHours();
  if (h < START_HOUR || h >= END_HOUR) {
    return { ok: false, error: `Fora do horário definido (${START_HOUR}h–${END_HOUR}h).` };
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
      return { ok: false, error: `Limite diário atingido (${count}/${DAILY_CAP}).` };
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
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  logInfo('[WhatsApp] Campanha iniciada', { total: clients.length });

  try {
    const check = await checkConstraints();
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
        // Anti-spam: 30–90s aleatório entre mensagens para evitar ban do WhatsApp.
        await sleep(MIN_SEND_DELAY_MS + Math.floor(Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS)));
      }
    }

    saveCreds().then(persistAuthState).catch(() => {});
    sock.end(new Error('campaign-done'));
    activeSocket = null;
    activeSaveCreds = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendProgress.error = message;
    logError('[WhatsApp] Campanha falhou', err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    sendProgress.finishedAt = new Date().toISOString();
    sendProgress.running = false;
  }
}
