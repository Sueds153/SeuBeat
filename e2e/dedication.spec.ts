import { test, expect } from '@playwright/test';

test.describe('Dedication Page', () => {
  test('shows not found for invalid song id', async ({ page }) => {
    await page.route('**/api/song/*', async (route) => {
      await route.fulfill({ status: 404 });
    });

    await page.goto('/song/para-alguem?id=invalid-id-123');
    await expect(page.getByText('Música não encontrada')).toBeVisible();
  });

  test('shows error banner on fetch failure', async ({ page }) => {
    await page.route('**/api/song/*', async (route) => {
      await route.abort('connectionrefused');
    });

    await page.goto('/song/para-alguem?id=any-id');
    await expect(page.getByText('Não foi possível carregar os dados')).toBeVisible();
  });

  test('shows WhatsApp help on not found', async ({ page }) => {
    await page.route('**/api/song/*', async (route) => {
      await route.fulfill({ status: 404 });
    });

    await page.goto('/song/para-alguem?id=invalid-id');
    await expect(page.getByText('Preciso de ajuda')).toBeVisible();
    await expect(page.locator('a[href*="wa.me/244929423278"]')).toBeVisible();
  });

  test('renders loading state initially', async ({ page }) => {
    await page.route('**/api/song/*', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({ status: 200, body: '{"success":true,"data":{"id":"test"}}' });
    });

    await page.goto('/song/para-alguem?id=some-id');
    await expect(page.getByText('A carregar a tua dedicatória')).toBeVisible({ timeout: 3000 });
  });
});
