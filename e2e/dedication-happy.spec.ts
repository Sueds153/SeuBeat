import { test, expect } from '@playwright/test';
import { mockSongFullData, MOCK_SONG_DATA } from './fixtures/mocks';

const TEST_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

test.describe('Dedication Page — Happy Path', () => {
  test('renders song title, lyrics, audio player, and share for delivered song', async ({ page }) => {
    await mockSongFullData(page);

    await page.goto(`/song/para-alguem?id=${TEST_UUID}`);

    // Song title visible (heading)
    await expect(page.getByRole('heading', { name: MOCK_SONG_DATA.title })).toBeVisible({ timeout: 15000 });

    // Creator info visible
    await expect(page.getByText('Carlos')).toBeVisible();
    await expect(page.getByText('Maria').first()).toBeVisible();

    // Music style badge
    await expect(page.getByText('Kizomba')).toBeVisible();

    // Occasion badge
    await expect(page.getByText('Declaração')).toBeVisible();

    // Audio player visible (MÚSICA COMPLETA badge)
    await expect(page.getByText('MÚSICA COMPLETA', { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // Lyrics section visible
    await expect(page.getByText('Letra').first()).toBeVisible();

    // Letter section visible
    await expect(page.getByText('Carta Dedicatória')).toBeVisible();

    // Share section (SongShare component)
    await expect(page.getByText('Partilha esta dedicatória')).toBeVisible();

    // Upsell banner (video clip)
    await expect(page.getByText('ETERNIZE O MOMENTO')).toBeVisible();
  });

  test('shows version toggle when v2 exists', async ({ page }) => {
    await mockSongFullData(page, {
      audioUrlV2: 'https://cdn.example.com/audio/test_v2.mp3',
    });

    await page.goto(`/song/para-alguem?id=${TEST_UUID}`);
    await expect(page.getByRole('heading', { name: MOCK_SONG_DATA.title })).toBeVisible({ timeout: 15000 });

    // Version toggle should be visible
    await expect(page.getByText('Versão').first()).toBeVisible();
    await expect(page.locator('button:has-text("A")').first()).toBeVisible();
    await expect(page.locator('button:has-text("B")').first()).toBeVisible();
  });

  test('hides version toggle when v2 does not exist', async ({ page }) => {
    await mockSongFullData(page, { audioUrlV2: null });

    await page.goto(`/song/para-alguem?id=${TEST_UUID}`);
    await expect(page.getByRole('heading', { name: MOCK_SONG_DATA.title })).toBeVisible({ timeout: 15000 });

    // Version toggle should NOT be visible
    await expect(page.getByText('Versão').first()).not.toBeVisible();
  });

  test('shows preview badge for non-delivered song', async ({ page }) => {
    await mockSongFullData(page, { status: 'approved' });

    await page.goto(`/song/para-alguem?id=${TEST_UUID}`);
    await expect(page.getByRole('heading', { name: MOCK_SONG_DATA.title })).toBeVisible({ timeout: 15000 });

    // Should show MÚSICA COMPLETA (approved is also unlocked)
    await expect(page.getByText('MÚSICA COMPLETA', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test('falls back to localStorage song id when no ?id= param', async ({ page }) => {
    await mockSongFullData(page);

    // Set the localStorage fallback
    await page.goto('/');
    await page.evaluate((uuid) => {
      localStorage.setItem('seubeat_last_song_id', uuid);
    }, TEST_UUID);

    // Navigate without ?id=
    await page.goto('/song/para-alguem');

    // Should still load the song
    await expect(page.getByRole('heading', { name: MOCK_SONG_DATA.title })).toBeVisible({ timeout: 15000 });
  });
});
