import { test, expect } from '@playwright/test';
import {
  mockBaseRoutes, mockGenerateLyricsSuccess, mockGenerateLyrics503,
  mockSongStatus, clearAppState,
} from './fixtures/mocks';

test.describe.configure({ mode: 'serial' });

test('lyrics generation success shows teaser and title', async ({ page }) => {
  test.setTimeout(120000);

  await mockBaseRoutes(page);
  await mockGenerateLyricsSuccess(page);
  await mockSongStatus(page, 'lyrics_ready');

  await clearAppState(page);

  // Start wizard
  await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('button:has-text("Criar")').first().click();
  await expect(page.getByText(/PASSO 1/)).toBeVisible({ timeout: 15000 });

  // Complete wizard steps 1-5
  await page.locator('#relation-btn-Namorado').click();
  await page.fill('#recipient-name-input', 'Maria');
  await page.locator('#gender-btn-Feminino').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 2/)).toBeVisible({ timeout: 15000 });

  await page.locator('#occasion-btn-Declaração').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 3/)).toBeVisible({ timeout: 15000 });

  await page.locator('#style-btn-Kizomba').click();
  await page.locator('#voice-btn-Masculina').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 4/)).toBeVisible({ timeout: 15000 });

  await page.fill('#makes-special-textarea', 'É uma pessoa incrível');
  await page.fill('#where-it-happened-input', 'Luanda');
  await page.fill('#deep-message-textarea', 'Quero que saibas que sempre estarei ao teu lado');
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 5/)).toBeVisible({ timeout: 15000 });

  await page.selectOption('select', 'Português');
  await page.fill('#user-email-input', 'test@example.com');
  await page.fill('#user-phone-input', '+244922000000');
  await page.locator('#wizard-advance-btn').click();

  // Wait for lyrics generation — preview screen shows "QUERO QUE" CTA
  await expect(page.getByText(/LETRA CRIADA COM SUCESSO/)).toBeVisible({ timeout: 120000 });
  // Song title may appear in multiple elements — use heading
  await expect(page.getByRole('heading', { name: 'Meu Amor Eterno' })).toBeVisible();
});

test('503 transient failure shows queued message', async ({ page }) => {
  test.setTimeout(120000);

  await mockBaseRoutes(page);
  await mockGenerateLyrics503(page);
  await mockSongStatus(page, 'lyrics_ready');

  await clearAppState(page);

  // Start wizard
  await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('button:has-text("Criar")').first().click();
  await expect(page.getByText(/PASSO 1/)).toBeVisible({ timeout: 15000 });

  // Complete wizard steps 1-5
  await page.locator('#relation-btn-Namorado').click();
  await page.fill('#recipient-name-input', 'Maria');
  await page.locator('#gender-btn-Feminino').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 2/)).toBeVisible({ timeout: 15000 });

  await page.locator('#occasion-btn-Declaração').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 3/)).toBeVisible({ timeout: 15000 });

  await page.locator('#style-btn-Kizomba').click();
  await page.locator('#voice-btn-Masculina').click();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 4/)).toBeVisible({ timeout: 15000 });

  await page.fill('#makes-special-textarea', 'É uma pessoa incrível');
  await page.fill('#where-it-happened-input', 'Luanda');
  await page.fill('#deep-message-textarea', 'Quero que saibas que sempre estarei ao teu lado');
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText(/PASSO 5/)).toBeVisible({ timeout: 15000 });

  await page.selectOption('select', 'Português');
  await page.fill('#user-email-input', 'test@example.com');
  await page.fill('#user-phone-input', '+244922000000');
  await page.locator('#wizard-advance-btn').click();

  // Should show the queued message for 503 transient failure
  await expect(page.getByText(/guardámos|guardamos|pedido/i)).toBeVisible({ timeout: 120000 });
});
