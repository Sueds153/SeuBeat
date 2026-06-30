import { test, expect } from '@playwright/test';

test.describe('Wizard Flow', () => {
  test('advance btn is disabled when step 1 fields empty', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('button:has-text("Criar")').first().click();
    await expect(page.getByText('PASSO 1 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#wizard-advance-btn')).toBeDisabled();
  });

  test('fills step 1 and advances', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('button:has-text("Criar")').first().click();
    await expect(page.getByText('PASSO 1 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.locator('#relation-btn-Namorado').click();
    await page.fill('#recipient-name-input', 'Maria');
    await page.fill('#user-nick-input', 'João');
    await page.fill('#recipient-nick-input', 'Meu Amor');
    await expect(page.locator('#wizard-advance-btn')).toBeEnabled();
    await page.locator('#wizard-advance-btn').click();
    await expect(page.getByText('PASSO 2 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('back button returns to landing on step 1', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('button:has-text("Criar")').first().click();
    await expect(page.getByText('PASSO 1 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.locator('#wizard-back-btn').click();
    await expect(page.getByRole('heading', { name: /Transforme a sua hist/ }).first()).toBeVisible();
  });
});
