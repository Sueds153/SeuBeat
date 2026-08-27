import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ensureTestProofPng } from './fixtures/mocks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES = path.join(__dirname, 'fixtures');
const TEST_IMAGE = path.join(FIXTURES, 'test-photo.png');

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  fs.mkdirSync(FIXTURES, { recursive: true });
  const minimalPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00,
    0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27,
    0x11, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  if (!fs.existsSync(TEST_IMAGE)) fs.writeFileSync(TEST_IMAGE, minimalPng);
  ensureTestProofPng();
});

test('completes wizard -> selects plan -> submits payment', async ({ page }) => {
  test.setTimeout(180000);
  const TEST_PNG = ensureTestProofPng();

  // Mock API endpoints
  await page.route('**/api/payment-details', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entidade: '10116', referencia: '929423278', expressPhone: '+244929423278' }) });
  });
  await page.route('**/api/stats/today-count', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 42 }) });
  });
  await page.route('**/api/generate-lyrics', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        dbSongId: 'e2e-test-song-id',
        dbSongRequestId: 'e2e-test-request-id',
        songTitle: 'Meu Amor Eterno',
        lyrics: ['Verso 1: Desde o primeiro olhar...', 'Refrão: És tu, meu amor...'],
        lyricsSnippet: 'És tu, meu amor...',
        letterText: 'Minha querida Maria, esta canção é para ti.'
      })
    });
  });
  await page.route('**/api/song/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { status: 'lyrics_ready', mureka_status: null } }) });
  });
  await page.route('**/api/submit-payment', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.route('**/api/payment-status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'approved', notes: null }) });
  });

  // Clear state
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.waitForTimeout(1000);

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

  // STEP 5: Photo + Finalize
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.getByText('Carregue ou arraste uma foto especial').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(TEST_IMAGE);
  await page.waitForTimeout(1500);
  await page.selectOption('select', 'Português');
  await page.fill('#user-email-input', 'test@example.com');
  await page.fill('#user-phone-input', '+244922000000');

  // Submit wizard
  await page.locator('#wizard-advance-btn').click();

  // Wait for preview screen, then click CTA to advance to plans
  const ctaButton = page.locator('button:has-text("QUERO QUE")');
  await ctaButton.waitFor({ state: 'visible', timeout: 120000 });
  await ctaButton.click();

  // Wait for plan selection
  await expect(page.locator('#standard-plan-btn')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('#express-plan-btn')).toBeVisible();

  // Select Standard plan
  await page.locator('#standard-plan-btn').click();

  // Decline the voice upsell modal
  await expect(page.locator('#upsell-decline-btn')).toBeVisible({ timeout: 5000 });
  await page.locator('#upsell-decline-btn').click();

  // Payment screen — Express is default
  await expect(page.getByText('929423278').first()).toBeVisible({ timeout: 10000 });

  // Upload payment proof (must be >=50KB)
  const proofChooser = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.getByText('Carregar arquivo de comprovativo').click();
  const proofFile = await proofChooser;
  await proofFile.setFiles(TEST_PNG);
  await page.waitForTimeout(1500);

  // Submit payment
  await page.locator('button:has-text("Enviar Comprovativo e Libertar a Música")').click();

  // Wait for approval success
  await expect(page.getByText(/Ver dedicatória/i)).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#back-home-success-btn')).toBeVisible();
  await expect(page.locator('#create-new-song-success-btn')).toBeVisible();
});
