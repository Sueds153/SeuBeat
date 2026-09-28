import { test, expect } from '@playwright/test';
import { expectWizardStep } from './fixtures/mocks';

test.describe('LandingPage', () => {
  test('loads and shows key elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByText('Transforme a sua história').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Criar M/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /WhatsApp/ }).first()).toBeVisible();
  });

  test('clicking CTA starts wizard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /Criar M/ }).first().click();
  await expectWizardStep(page, 1);
  });
});
