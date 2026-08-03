import { test, expect, Page } from '@playwright/test';

// Valida o comportamento de recuperação de letras implementado nas correções:
// 1. Se a geração "falhar" no cliente mas a letra já existir no servidor,
//    o Wizard deve recuperá-la via /api/latest-song (tryRecoverExistingLyrics).
// 2. Se não existir letra recuperável, deve mostrar o ecrã de erro + "Tentar novamente".

const RECOVERED_SONG = {
  success: true,
  found: true,
  dbSongId: 'recovered-song-id',
  dbSongRequestId: 'recovered-request-id',
  songTitle: 'Canção Recuperada',
  lyrics: ['Verso 1: A nossa história...', 'Refrão: És tu, meu amor...'],
  lyricsSnippet: 'És tu, meu amor...',
  letterText: 'Minha querida, esta canção é para ti.',
  status: 'lyrics_ready',
};

async function mockBaseRoutes(page: Page) {
  await page.route('**/api/payment-details', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entity: '10116', reference: '929423278' }) });
  });
  await page.route('**/api/stats/today-count', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 42 }) });
  });
}

// Percorre o Wizard (9 passos) e submete. A geração deve estar mockada pelo teste.
async function completeWizardAndSubmit(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.waitForTimeout(1000);

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
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 9/)).toBeVisible({ timeout: 15000 });

  // STEP 9: Contact
  await page.selectOption('select', 'Português');
  await page.fill('#user-email-input', 'test@example.com');
  await page.fill('#user-phone-input', '+244922000000');

  // Submit wizard
  await page.locator('#wizard-advance-btn').click();
}

test.describe.configure({ mode: 'serial' });

test('recupera letra existente quando a geracao falha mas o servidor ja criou a musica', async ({ page }) => {
  test.setTimeout(120000);

  await mockBaseRoutes(page);
  await page.route('**/api/generate-lyrics', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Erro interno simulado' }) });
  });
  await page.route('**/api/latest-song*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RECOVERED_SONG) });
  });

  await completeWizardAndSubmit(page);

  // A letra deve ser recuperada via /api/latest-song (NÃO deve aparecer o ecrã de erro).
  await expect(page.getByText(/LETRA CRIADA COM SUCESSO/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Nao foi possivel gerar agora/)).not.toBeVisible();
  await expect(page.getByText(/Canção Recuperada/).first()).toBeVisible();
});

test('mostra ecra de erro com Tentar novamente quando nao existe letra para recuperar', async ({ page }) => {
  test.setTimeout(120000);

  await mockBaseRoutes(page);
  await page.route('**/api/generate-lyrics', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Erro interno simulado' }) });
  });
  await page.route('**/api/latest-song*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, found: false }) });
  });

  await completeWizardAndSubmit(page);

  await expect(page.getByText(/Nao foi possivel gerar agora/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Tentar novamente/ })).toBeVisible();
});
