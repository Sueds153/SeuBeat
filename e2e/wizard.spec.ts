import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

let page: import('@playwright/test').Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('button:has-text("Criar")').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('button:has-text("Criar")').first().click();
});

test.afterAll(async () => {
  await page.close();
});

test('advance btn is disabled when step 1 fields empty', async () => {
  await expect(page.getByText('PASSO 1 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#wizard-advance-btn')).toBeDisabled();
});

test('fills step 1 and advances', async () => {
  await expect(page.getByText('PASSO 1 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.locator('#relation-btn-Namorado').click();
  await page.fill('#recipient-name-input', 'Maria');
  await page.fill('#user-nick-input', 'João');
  await page.fill('#recipient-nick-input', 'Meu Amor');
  await expect(page.locator('#wizard-advance-btn')).toBeEnabled();
  await page.locator('#wizard-advance-btn').click();
  await expect(page.getByText('PASSO 2 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
});

test('back button returns to landing on step 1', async () => {
  // Reset back to step 1 via back turns from step 2
  await page.locator('#wizard-back-btn').click();
  await expect(page.getByText('PASSO 1 DE 9', { exact: true })).toBeVisible({ timeout: 15000 });
  // Now back from step 1 goes to landing
  await page.locator('#wizard-back-btn').click();
  await expect(page.getByRole('heading', { name: /Transforme a sua hist/ }).first()).toBeVisible();
});
