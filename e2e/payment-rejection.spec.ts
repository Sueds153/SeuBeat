import { test, expect } from '@playwright/test';
import {
  mockBaseRoutes, mockGenerateLyricsSuccess, mockSongStatus,
  mockSubmitPaymentError, mockSubmitPaymentSuccess, mockPaymentStatus,
  mockPaymentDetails,
  completeWizardAndSubmit, MOCK_PAYMENT_DETAILS,
  ensureTestProofPng,
} from './fixtures/mocks';

test.describe.configure({ mode: 'serial' });

test('payment rejection shows error + re-submit works', async ({ page }) => {
  test.setTimeout(180000);

  const TEST_PNG = ensureTestProofPng();

  await mockBaseRoutes(page);
  await mockGenerateLyricsSuccess(page);
  await mockSongStatus(page, 'lyrics_ready');
  await mockPaymentDetails(page);

  // First submission: server error (simulating rejection)
  await mockSubmitPaymentError(page, 400, 'Comprovativo inválido ou ilegível');

  await completeWizardAndSubmit(page);

  // Wait for plan selection
  await expect(page.locator('#standard-plan-btn')).toBeVisible({ timeout: 120000 });

  // Select Standard plan
  await page.locator('#standard-plan-btn').click();

  // Decline voice upsell
  await expect(page.locator('#upsell-decline-btn')).toBeVisible({ timeout: 5000 });
  await page.locator('#upsell-decline-btn').click();

  // Payment screen — Express is default
  await expect(page.getByText('929423278').first()).toBeVisible({ timeout: 10000 });

  // Upload proof and submit
  const proofChooser = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.getByText('Carregar arquivo de comprovativo').click();
  const proofFile = await proofChooser;
  await proofFile.setFiles(TEST_PNG);
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Enviar Comprovativo e Libertar a Música")').click();

  // Should show error message
  await expect(page.getByText(/Comprovativo inválido|Erro|não foi possível/i)).toBeVisible({ timeout: 15000 });

  // Now mock success for re-submit
  await page.unroute('**/api/submit-payment');
  await mockSubmitPaymentSuccess(page);
  await mockPaymentStatus(page, 'approved');

  // Re-submit
  await page.locator('button:has-text("Enviar Comprovativo e Libertar a Música")').click();

  // Should show success
  await expect(page.getByText(/Ver dedicatória/i)).toBeVisible({ timeout: 30000 });
});
