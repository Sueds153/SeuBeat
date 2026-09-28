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
    await expect(page.locator('a[href*="wa.me/244922058136"]')).toBeVisible();
  });

  test('renders loading state initially', async ({ page }) => {
    // Gate manual: segura a resposta até a asserção. Um delay fixo (2s) corre em
    // paralelo com o goto e fazia a página já ter os dados quando o expect corria.
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/api/song/*', async (route) => {
      await pending;
      await route.fulfill({ status: 200, body: '{"success":true,"data":{"id":"test"}}' });
    });

    await page.goto('/song/para-alguem?id=some-id');
    await expect(page.getByText('A carregar a tua dedicatória')).toBeVisible({ timeout: 15000 });
    release();
  });
});
