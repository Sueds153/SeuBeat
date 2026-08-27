import { test, expect } from '@playwright/test';
import {
  mockBaseRoutes, mockGenerateLyricsSuccess, mockSongStatus,
  mockSubmitPaymentSuccess, mockPaymentStatus, mockVoiceValidationPhrase,
  mockPaymentDetails,
  clearAppState,
} from './fixtures/mocks';

test.describe.configure({ mode: 'serial' });

test('Premium plan: selects premium from upsell, reaches payment', async ({ page }) => {
  test.setTimeout(180000);

  await mockBaseRoutes(page);
  await mockGenerateLyricsSuccess(page);
  await mockSongStatus(page, 'lyrics_ready');
  await mockSubmitPaymentSuccess(page);
  await mockPaymentStatus(page, 'approved');
  await mockPaymentDetails(page);

  await clearAppState(page);

  // Start wizard
  await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('button:has-text("Criar")').first().click();
  await expect(page.getByText(/PASSO 1/)).toBeVisible({ timeout: 15000 });

  // Complete steps 1-5
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

  // Wait for preview screen, then click CTA to advance to plans
  const ctaButton = page.locator('button:has-text("QUERO QUE")');
  await ctaButton.waitFor({ state: 'visible', timeout: 120000 });
  await ctaButton.click();

  // Wait for plan selection
  await expect(page.locator('#standard-plan-btn')).toBeVisible({ timeout: 120000 });

  // Select Standard plan first (to trigger upsell)
  await page.locator('#standard-plan-btn').click();

  // Voice upsell modal should appear
  await expect(page.locator('#upsell-decline-btn')).toBeVisible({ timeout: 5000 });

  // Accept the upsell (click accept button)
  const acceptBtn = page.locator('#upsell-accept-btn');
  if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptBtn.click();
  } else {
    // Fallback: click the premium plan link text
    await page.getByText('Adicionar voz clonada').click();
  }

  // Should reach payment screen (Premium includes voice)
  await expect(page.getByText(/Multicaixa Express|Referência/i).first()).toBeVisible({ timeout: 15000 });
});

test('voice recording UI elements are present on premium path', async ({ page }) => {
  test.setTimeout(120000);

  await mockBaseRoutes(page);
  await mockGenerateLyricsSuccess(page);
  await mockSongStatus(page, 'lyrics_ready');
  await mockVoiceValidationPhrase(page);
  await mockPaymentDetails(page);

  await clearAppState(page);

  // Start wizard
  await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('button:has-text("Criar")').first().click();
  await expect(page.getByText(/PASSO 1/)).toBeVisible({ timeout: 15000 });

  // Complete steps 1-5
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

  // Wait for preview screen, then click CTA to advance to plans
  const ctaButton2 = page.locator('button:has-text("QUERO QUE")');
  await ctaButton2.waitFor({ state: 'visible', timeout: 120000 });
  await ctaButton2.click();

  // Wait for plan selection
  await expect(page.locator('#standard-plan-btn')).toBeVisible({ timeout: 120000 });

  // Select Standard to trigger upsell
  await page.locator('#standard-plan-btn').click();
  await expect(page.locator('#upsell-decline-btn')).toBeVisible({ timeout: 5000 });

  // Accept upsell for Premium
  const acceptBtn = page.locator('#upsell-accept-btn');
  if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptBtn.click();
  } else {
    await page.getByText('Adicionar voz clonada').click();
  }

  // Payment screen should be visible
  await expect(page.getByText(/Multicaixa Express|Referência/i).first()).toBeVisible({ timeout: 15000 });

  // Voice recording section should be visible in payment screen
  // (Premium plan shows voice recording UI)
  await expect(page.getByText(/Gravar|Voz|voice/i).first()).toBeVisible({ timeout: 10000 });
});
