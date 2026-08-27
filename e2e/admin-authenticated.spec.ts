import { test, expect } from '@playwright/test';
import {
  mockAdminLoginSuccess, mockAdminRequests, mockAdminSongs,
  mockAdminDashboard,
} from './fixtures/mocks';

test.describe.configure({ mode: 'serial' });

test.describe('Admin Panel — Authenticated', () => {
  test('login success shows dashboard tabs and stats', async ({ page }) => {
    await mockAdminLoginSuccess(page);
    await mockAdminDashboard(page);
    await mockAdminRequests(page);
    await mockAdminSongs(page);

    await page.goto('/admin');

    // Login
    await page.fill('input[type="password"]', 'correct-password');
    await page.getByRole('button', { name: /Entrar no Painel/ }).click();

    // Should show the admin panel heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    // Navigation tabs should be visible (use exact match to avoid card duplicates)
    await expect(page.getByRole('button', { name: 'Pedidos', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Músicas', exact: true })).toBeVisible();
  });

  test('requests tab shows request cards', async ({ page }) => {
    await mockAdminLoginSuccess(page);
    await mockAdminDashboard(page);
    await mockAdminRequests(page);
    await mockAdminSongs(page);

    await page.goto('/admin');

    // Login
    await page.fill('input[type="password"]', 'correct-password');
    await page.getByRole('button', { name: /Entrar no Painel/ }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    // Navigate to requests tab (use exact match)
    await page.getByRole('button', { name: 'Pedidos', exact: true }).click();

    // Should show the request with recipient name and user name
    await expect(page.getByText('Maria').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Carlos').first()).toBeVisible();
  });

  test('songs tab shows song list', async ({ page }) => {
    await mockAdminLoginSuccess(page);
    await mockAdminDashboard(page);
    await mockAdminRequests(page);
    await mockAdminSongs(page);

    await page.goto('/admin');

    // Login
    await page.fill('input[type="password"]', 'correct-password');
    await page.getByRole('button', { name: /Entrar no Painel/ }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    // Navigate to songs tab (use exact match)
    await page.getByRole('button', { name: 'Músicas', exact: true }).click();

    // Should show the song
    await expect(page.getByText('Meu Amor Eterno').first()).toBeVisible({ timeout: 10000 });
  });
});
