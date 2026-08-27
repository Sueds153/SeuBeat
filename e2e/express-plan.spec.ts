import { test, expect } from '@playwright/test';
import {
  mockBaseRoutes, mockGenerateLyricsSuccess, mockSongStatus,
  mockSubmitPaymentSuccess, mockPaymentStatus, mockPaymentDetails,
  completeWizardAndSubmit, clearAppState, MOCK_PAYMENT_DETAILS,
  ensureTestProofPng,
} from './fixtures/mocks';

test.describe.configure({ mode: 'serial' });

test('Express plan: express payment pre-selected with upsell decline', async ({ page }) => {
  test.setTimeout(180000);

  await mockBaseRoutes(page);
  await mockGenerateLyricsSuccess(page);
  await mockSongStatus(page, 'lyrics_ready');
  await mockSubmitPaymentSuccess(page);
  await mockPaymentStatus(page, 'approved');
  await mockPaymentDetails(page);

  const TEST_PNG = ensureTestProofPng();
  await completeWizardAndSubmit(page);

  // Wait for plan selection
  await expect(page.locator('#standard-plan-btn')).toBeVisible({ timeout: 120000 });

  // Select Express plan
  await page.locator('#express-plan-btn').click();

  // Express plan shows upsell modal — decline it
  await expect(page.locator('#upsell-decline-btn')).toBeVisible({ timeout: 5000 });
  await page.locator('#upsell-decline-btn').click();

  // Express payment pre-selected — verify Express phone
  await expect(page.getByText('929423278').first()).toBeVisible({ timeout: 15000 });

  // Upload proof and submit
  const proofChooser = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.getByText('Carregar arquivo de comprovativo').click();
  const proofFile = await proofChooser;
  await proofFile.setFiles(TEST_PNG);
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Enviar Comprovativo e Libertar a Música")').click();

  // Should show success
  await expect(page.getByText(/Ver dedicatória/i)).toBeVisible({ timeout: 30000 });
});
