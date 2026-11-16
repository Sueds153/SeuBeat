import { expect, test } from '@playwright/test';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const JOB_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test.describe('ComAmor order flow', () => {
  test('does not show the form until the server confirms authorization', async ({ page }) => {
    await page.route('**/api/v1/comamor/authorize', route => route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Este pedido ainda não está autorizado.' }),
    }));
    await page.goto(`/wizard?comamor_order=${ORDER_ID}`);

    await expect(page.getByRole('heading', { name: 'Ainda não podemos abrir este pedido' })).toBeVisible();
    await expect(page.getByLabel('Conta-nos a ideia')).toHaveCount(0);
  });

  test('keeps written text after a recoverable create request failure', async ({ page }) => {
    await page.route('**/api/v1/comamor/authorize', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, orderId: ORDER_ID, occasion: 'Aniversário', generationAttempt: 1 }),
    }));
    await page.route('**/api/v1/comamor/jobs', route => route.fulfill({
      status: 503, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Serviço temporariamente indisponível. Tenta novamente.' }),
    }));
    await page.goto(`/wizard?comamor_order=${ORDER_ID}`);
    await page.getByLabel('Conta-nos a ideia').fill('Uma canção sobre celebrar uma nova etapa da vida.');
    await page.getByRole('button', { name: 'Criar canção' }).click();

    await expect(page.getByRole('alert')).toContainText('permanece aqui');
    await expect(page.getByLabel('Conta-nos a ideia')).toHaveValue('Uma canção sobre celebrar uma nova etapa da vida.');
  });

  test('returns only an authorized completed result with playable audio', async ({ page }) => {
    await page.route('**/api/v1/comamor/authorize', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, orderId: ORDER_ID, occasion: 'Aniversário', generationAttempt: 1 }),
    }));
    await page.route('**/api/v1/comamor/jobs', route => route.fulfill({
      status: 202, contentType: 'application/json',
      body: JSON.stringify({ success: true, jobId: JOB_ID, status: 'generating', generationAttempt: 1 }),
    }));
    await page.route(`**/api/v1/comamor/jobs/${JOB_ID}?*`, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true, jobId: JOB_ID, generationAttempt: 1, status: 'completed',
        title: 'Uma canção especial', genre: 'Semba', audioUrl: 'https://audio.seubeat.example/song.mp3',
      }),
    }));
    await page.goto(`/wizard?comamor_order=${ORDER_ID}`);
    await page.getByLabel('Conta-nos a ideia').fill('Uma canção sobre celebrar uma nova etapa da vida.');
    await page.getByRole('button', { name: 'Criar canção' }).click();

    await expect(page.getByRole('heading', { name: 'Uma canção especial' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ouvir \/ transferir/ })).toHaveAttribute('href', 'https://audio.seubeat.example/song.mp3');
  });
});
