import { test, expect } from '@playwright/test';

test.describe('LandingPage', () => {
  test('loads and shows key elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /Transforme a sua hist/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Criar M/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /WhatsApp/ })).toBeVisible();
  });

  test('clicking CTA starts wizard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /Criar M/ }).first().click();
    await expect(page.getByText('PASSO 1 DE 9', { exact: true })).toBeVisible();
  });
});
