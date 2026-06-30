import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test('shows password form when not authenticated', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByPlaceholder('••••••••••••')).toBeVisible();
  });

  test('shows error on wrong password', async ({ page }) => {
    await page.route('**/api/admin/stats', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Password incorreta.' }) });
    });

    await page.goto('/admin');
    await page.fill('input[type="password"]', 'wrong-password');
    await page.getByRole('button', { name: /Entrar no Painel/ }).click();
    await expect(page.getByText('Password incorreta')).toBeVisible();
  });

  test('shows WhatsApp help on error', async ({ page }) => {
    await page.route('**/api/admin/stats', async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Erro no servidor' }) });
    });

    await page.goto('/admin');
    await page.fill('input[type="password"]', 'test');
    await page.getByRole('button', { name: /Entrar no Painel/ }).click();
    await expect(page.getByText('Falar com apoio')).toBeVisible();
  });
});
