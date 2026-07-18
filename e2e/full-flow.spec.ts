import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe.configure({ mode: 'serial' });

const FIXTURES = path.join(__dirname, 'fixtures');
const TEST_IMAGE = path.join(FIXTURES, 'test-photo.png');
const TEST_PNG = path.join(FIXTURES, 'test-proof.png');

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
  if (!fs.existsSync(TEST_PNG)) fs.writeFileSync(TEST_PNG, minimalPng);
});

test('completes wizard -> selects plan -> submits payment', async ({ page }) => {
  test.setTimeout(180000);

  // Mock API endpoints
  await page.route('**/api/payment-details', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entity: '10116', reference: '929423278' }) });
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
  await page.fill('#user-nick-input', 'João');
  await page.fill('#recipient-nick-input', 'Meu Amor');
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 2/)).toBeVisible({ timeout: 15000 });

  // STEP 2: Occasion
  await page.locator('#occasion-btn-Declaração').click();
  await page.fill('#why-created-today-textarea', 'Quero declarar todo o meu amor');
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 3/)).toBeVisible({ timeout: 15000 });

  // STEP 3: Music Style
  await page.locator('#style-btn-Kizomba').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 4/)).toBeVisible({ timeout: 15000 });

  // STEP 4: Voice
  await page.locator('#voice-btn-Masculina').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 5/)).toBeVisible({ timeout: 15000 });

  // STEP 5: Traits
  await page.fill('#makes-special-textarea', 'É uma pessoa incrível, carinhosa e única');
  await page.fill('#only-she-does-textarea', 'Ela ri de forma contagiante e ilumina qualquer sala');
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 6/)).toBeVisible({ timeout: 15000 });

  // STEP 6: Memory
  await page.fill('#unforgettable-memory-textarea', 'Aquele dia inesquecível na praia de Cabo Ledo');
  await page.fill('#where-it-happened-input', 'Luanda');
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 7/)).toBeVisible({ timeout: 15000 });

  // STEP 7: Message
  await page.fill('#deep-message-textarea', 'Quero que saibas que sempre estarei ao teu lado');
  await page.fill('#hook-phrase-input', 'és o meu sol');
  await page.locator('#emotion-btn-Amor').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 8/)).toBeVisible({ timeout: 15000 });

  // STEP 8: Photo
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.getByText('Carregue ou arraste uma foto especial').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(TEST_IMAGE);
  await page.waitForTimeout(1500);
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 9/)).toBeVisible({ timeout: 15000 });

  // STEP 9: Contact
  await page.selectOption('select', 'Português');
  await page.fill('#user-email-input', 'test@example.com');
  await page.fill('#user-phone-input', '+244922000000');

  // Submit wizard
  await page.locator('#wizard-advance-btn').click();

  // Wait for plan selection
  await expect(page.locator('#standard-plan-btn')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('#express-plan-btn')).toBeVisible();
  await expect(page.locator('#premium-plan-btn')).toBeVisible();

  // Select Standard plan
  await page.locator('#standard-plan-btn').click();

  // Decline the voice upsell modal
  await expect(page.locator('#upsell-decline-btn')).toBeVisible({ timeout: 5000 });
  await page.locator('#upsell-decline-btn').click();

  // Payment screen
  await expect(page.getByText('10116').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('929423278').first()).toBeVisible();

  // Upload payment proof
  await page.locator('input[type="file"]').last().setInputFiles(TEST_PNG);
  await page.waitForTimeout(1000);

  // Submit payment
  await page.locator('button:has-text("Confirmar e Enviar Comprovativo")').click();

  // Wait for approval success
  await expect(page.getByText(/Ver dedicatória/i)).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#back-home-success-btn')).toBeVisible();
  await expect(page.locator('#create-new-song-success-btn')).toBeVisible();
});
