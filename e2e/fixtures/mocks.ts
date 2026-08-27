import { Page, Route, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { deflateSync } from 'zlib';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Shared mock data ────────────────────────────────────────────────────────

export const MOCK_SONG_ID = 'e2e-test-song-id';
export const MOCK_REQUEST_ID = 'e2e-test-request-id';

/** Ensure test-proof.png exists and is >=50KB (Wizard enforces minimum for PNG) */
export function ensureTestProofPng() {
  const dir = path.join(__dirname);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'test-proof.png');
  if (fs.existsSync(p) && fs.statSync(p).size >= 50 * 1024) return p;
  const width = 200, height = 200;
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // PNG filter byte
    const row = randomBytes(width * 3);
    for (let x = 0; x < width * 3; x++) raw.push(row[x]);
  }
  const compressed = deflateSync(Buffer.from(raw));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const crc32 = (buf: Buffer) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  fs.writeFileSync(p, Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]));
  return p;
}

export const MOCK_PAYMENT_DETAILS = {
  entidade: '10116',
  referencia: '929423278',
  expressPhone: '+244929423278',
};

export const MOCK_STATS = { count: 42 };

export const MOCK_LYRICS_RESPONSE = {
  success: true,
  dbSongId: MOCK_SONG_ID,
  dbSongRequestId: MOCK_REQUEST_ID,
  songTitle: 'Meu Amor Eterno',
  lyrics: ['Verso 1: Desde o primeiro olhar...', 'Refrão: És tu, meu amor...'],
  lyricsSnippet: 'És tu, meu amor...',
  letterText: 'Minha querida Maria, esta canção é para ti.',
};

export const MOCK_SONG_DATA = {
  id: MOCK_SONG_ID,
  requestId: MOCK_REQUEST_ID,
  status: 'delivered',
  murekaStatus: 'completed',
  audioUrl: 'https://cdn.example.com/audio/test_song.mp3',
  audioUrlV2: 'https://cdn.example.com/audio/test_song_v2.mp3',
  previewUrl: 'https://cdn.example.com/preview/test_preview.mp3',
  duration: 197,
  title: 'Meu Amor Eterno',
  lyrics: ['Verso 1: Desde o primeiro olhar...', 'Refrão: És tu, meu amor...'],
  lyricsSnippet: 'És tu, meu amor...',
  letterText: 'Minha querida Maria, esta canção é para ti.',
  musicStyle: 'kizomba',
  voiceType: 'masculina',
  photoUrl: null,
  desiredEmotion: 'Romântico',
  occasion: 'Declaração',
  userName: 'Carlos',
  recipientName: 'Maria',
  recipientNick: '',
  userNick: 'Carlos',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_ADMIN_REQUESTS = [
  {
    id: MOCK_REQUEST_ID,
    status: 'payment_submitted',
    plan: 'standard',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    user_name: 'Carlos',
    user_email: 'test@example.com',
    recipient_name: 'Maria',
    occasion: 'Declaração',
    ai_song_title: 'Meu Amor Eterno',
    ai_lyrics_snippet: 'És tu, meu amor...',
    music_style: 'kizomba',
    voice_type: 'masculina',
    payments: [{ id: 'pay-1', status: 'pending_verification', amount: 4900, proof_url: 'https://example.com/proof.jpg' }],
    users: { name: 'Carlos', email: 'test@example.com', phone: '+244922000000' },
  },
];

export const MOCK_ADMIN_SONGS = [
  {
    id: MOCK_SONG_ID,
    request_id: MOCK_REQUEST_ID,
    status: 'completed',
    title: 'Meu Amor Eterno',
    audio_url: 'https://cdn.example.com/audio/test.mp3',
    audio_url_v2: null,
    duration: 197,
    mureka_status: 'completed',
    song_requests: {
      recipient_name: 'Maria',
      music_style: 'kizomba',
      occasion: 'Declaração',
      plan: 'standard',
      users: { name: 'Carlos', email: 'test@example.com' },
    },
  },
];

// ─── Route handlers ──────────────────────────────────────────────────────────

type FulfillOptions = {
  status?: number;
  body?: unknown;
  delay?: number;
};

async function fulfill(route: Route, opts: FulfillOptions = {}) {
  const { status = 200, body = {}, delay = 0 } = opts;
  if (delay > 0) await new Promise(r => setTimeout(r, delay));
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Mock base routes shared across all wizard tests */
export async function mockBaseRoutes(page: Page) {
  await page.route('**/api/payment-details', async (route) => {
    await fulfill(route, { body: MOCK_PAYMENT_DETAILS });
  });
  await page.route('**/api/stats/today-count', async (route) => {
    await fulfill(route, { body: MOCK_STATS });
  });
}

/** Mock payment details endpoint (standalone) */
export async function mockPaymentDetails(page: Page, data?: Record<string, string>) {
  await page.route('**/api/payment-details', async (route) => {
    await fulfill(route, { body: data || MOCK_PAYMENT_DETAILS });
  });
}

/** Mock lyrics generation returning success */
export async function mockGenerateLyricsSuccess(page: Page, overrides?: Partial<typeof MOCK_LYRICS_RESPONSE>) {
  await page.route('**/api/generate-lyrics', async (route) => {
    await fulfill(route, { body: { ...MOCK_LYRICS_RESPONSE, ...overrides } });
  });
}

/** Mock lyrics generation returning 500 */
export async function mockGenerateLyricsError(page: Page) {
  await page.route('**/api/generate-lyrics', async (route) => {
    await fulfill(route, { status: 500, body: { success: false, error: 'Erro interno simulado' } });
  });
}

/** Mock lyrics generation returning 503 (all providers transient) */
export async function mockGenerateLyrics503(page: Page) {
  await page.route('**/api/generate-lyrics', async (route) => {
    await fulfill(route, {
      status: 503,
      body: {
        success: false,
        error: 'Todos os providers falharam temporariamente',
        queued: true,
        message: 'Guardámos o teu pedido — vamos gerar automaticamente',
      },
    });
  });
}

/** Mock song status polling (returns a given status) */
export async function mockSongStatus(page: Page, status: string = 'lyrics_ready') {
  await page.route('**/api/song/**', async (route) => {
    await fulfill(route, { body: { success: true, data: { status, mureka_status: null } } });
  });
}

/** Mock latest-song recovery endpoint */
export async function mockLatestSong(page: Page, data: Record<string, unknown>) {
  await page.route('**/api/latest-song*', async (route) => {
    await fulfill(route, { body: data });
  });
}

/** Mock submit-payment returning success */
export async function mockSubmitPaymentSuccess(page: Page) {
  await page.route('**/api/submit-payment', async (route) => {
    await fulfill(route, { body: { success: true } });
  });
}

/** Mock submit-payment returning error */
export async function mockSubmitPaymentError(page: Page, status = 500, error = 'Erro no servidor') {
  await page.route('**/api/submit-payment', async (route) => {
    await fulfill(route, { status, body: { success: false, error } });
  });
}

/** Mock payment-status returning a given status */
export async function mockPaymentStatus(page: Page, status: string = 'approved', notes?: string) {
  await page.route('**/api/payment-status*', async (route) => {
    await fulfill(route, { body: { status, notes: notes || null } });
  });
}

/** Mock full song data for dedication page */
export async function mockSongFullData(page: Page, overrides?: Partial<typeof MOCK_SONG_DATA>) {
  await page.route('**/api/song/*', async (route) => {
    await fulfill(route, { body: { success: true, data: { ...MOCK_SONG_DATA, ...overrides } } });
  });
}

/** Mock admin login returning success */
export async function mockAdminLoginSuccess(page: Page) {
  await page.route('**/api/admin/login', async (route) => {
    await fulfill(route, { body: { success: true, token: 'fake-jwt-token-for-e2e' } });
  });
}

/** Mock admin login returning error */
export async function mockAdminLoginError(page: Page, status = 401, error = 'Password inválida.') {
  await page.route('**/api/admin/login', async (route) => {
    await fulfill(route, { status, body: { error } });
  });
}

/** Mock admin requests endpoint */
export async function mockAdminRequests(page: Page, data?: Array<Record<string, unknown>>) {
  await page.route('**/api/admin/requests*', async (route) => {
    await fulfill(route, { body: { success: true, requests: data || MOCK_ADMIN_REQUESTS } });
  });
}

/** Mock admin songs endpoint */
export async function mockAdminSongs(page: Page, data?: Array<Record<string, unknown>>) {
  await page.route('**/api/admin/songs*', async (route) => {
    await fulfill(route, { body: { success: true, songs: data || MOCK_ADMIN_SONGS } });
  });
}

/** Mock admin dashboard/stats endpoints */
export async function mockAdminDashboard(page: Page) {
  await page.route('**/api/admin/stats', async (route) => {
    await fulfill(route, {
      body: {
        success: true,
        totalRequests: 217,
        pendingPayments: 2,
        deliveredSongs: 13,
        revenue: 127400,
        requestsByStatus: {
          lyrics_ready: 50,
          payment_submitted: 5,
          approved: 10,
          delivered: 13,
          failed: 3,
          music_processing: 2,
        },
        avgApprovalHours: 2.5,
      },
    });
  });
  await page.route('**/api/admin/credits', async (route) => {
    await fulfill(route, {
      body: {
        success: true,
        data: {
          anthropic: { ok: true, credits: 5.0 },
          openai: { ok: true, credits: 10.0 },
          gemini: { ok: true, credits: 15.0 },
          deepseek: { ok: true, credits: 2.0 },
          suno: { ok: true, credits: 500 },
          brevo: { ok: true, credits: 1000 },
        },
      },
    });
  });
}

/** Mock resume-data endpoint */
export async function mockResumeData(page: Page, data?: Record<string, unknown>) {
  await page.route('**/api/song/resume-data/*', async (route) => {
    await fulfill(route, {
      body: {
        success: true,
        data: data || {
          formData: {
            relation: 'Namorado',
            recipientName: 'Maria',
            recipientGender: 'Feminino',
            occasion: 'Declaração',
            musicStyle: 'kizomba',
            voiceType: 'masculina',
            language: 'Português',
            userEmail: 'test@example.com',
            userPhone: '+244922000000',
          },
          aiSongTitle: 'Meu Amor Eterno',
          aiLyrics: ['Verso 1: Desde o primeiro olhar...', 'Refrão: És tu, meu amor...'],
          aiLyricsSnippet: 'És tu, meu amor...',
          aiLetterText: 'Minha querida Maria.',
          dbSongId: MOCK_SONG_ID,
          dbSongRequestId: MOCK_REQUEST_ID,
          status: 'lyrics_ready',
        },
      },
    });
  });
}

/** Mock voice validation-phrase endpoint */
export async function mockVoiceValidationPhrase(page: Page) {
  await page.route('**/api/song/voice/validation-phrase', async (route) => {
    await fulfill(route, {
      body: {
        phrase: 'O sol nasce sempre, mas o teu sorriso brilha mais',
        validationTaskId: 'test-validation-task-id',
      },
    });
  });
}

/** Navigate to / and clear all storage */
export async function clearAppState(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.waitForTimeout(500);
}

/** Complete wizard steps 1-5 and submit (mock generate-lyrics must be set up before calling) */
export async function completeWizardAndSubmit(page: Page, opts?: { withPhoto?: boolean }) {
  await clearAppState(page);

  // Start wizard
  await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('button:has-text("Criar")').first().click();
  await expect(page.getByText(/PASSO 1/)).toBeVisible({ timeout: 15000 });

  // STEP 1: Relation
  await page.locator('#relation-btn-Namorado').click();
  await page.fill('#recipient-name-input', 'Maria');
  await page.locator('#gender-btn-Feminino').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 2/)).toBeVisible({ timeout: 15000 });

  // STEP 2: Occasion
  await page.locator('#occasion-btn-Declaração').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 3/)).toBeVisible({ timeout: 15000 });

  // STEP 3: Music Style + Voice
  await page.locator('#style-btn-Kizomba').click();
  await page.locator('#voice-btn-Masculina').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 4/)).toBeVisible({ timeout: 15000 });

  // STEP 4: Story
  await page.fill('#makes-special-textarea', 'É uma pessoa incrível, carinhosa e única');
  await page.fill('#where-it-happened-input', 'Luanda');
  await page.fill('#deep-message-textarea', 'Quero que saibas que sempre estarei ao teu lado');
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 5/)).toBeVisible({ timeout: 15000 });

  // STEP 5: Finalize
  if (opts?.withPhoto) {
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
    await page.getByText('Carregue ou arraste uma foto especial').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'test-photo.png'));
    await page.waitForTimeout(1000);
  }
  await page.selectOption('select', 'Português');
  await page.fill('#user-email-input', 'test@example.com');
  await page.fill('#user-phone-input', '+244922000000');

  // Submit wizard — triggers lyrics generation
  await page.locator('#wizard-advance-btn').click();

  // Wait for preview screen (lyrics generated) then click CTA to advance to plans
  const ctaButton = page.locator('button:has-text("QUERO QUE")');
  await ctaButton.waitFor({ state: 'visible', timeout: 120000 });
  await ctaButton.click();
}


