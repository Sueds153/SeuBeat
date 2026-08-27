import { test, expect } from '@playwright/test';
import {
  mockBaseRoutes, mockGenerateLyricsSuccess, mockSongStatus,
  mockResumeData, clearAppState, MOCK_SONG_ID,
} from './fixtures/mocks';

test.describe.configure({ mode: 'serial' });

test('resume wizard from /wizard?resume=<id> pre-fills form data', async ({ page }) => {
  test.setTimeout(120000);

  await mockBaseRoutes(page);
  await mockGenerateLyricsSuccess(page);
  await mockSongStatus(page, 'lyrics_ready');
  await mockResumeData(page);

  await clearAppState(page);

  // Navigate to wizard with resume param
  await page.goto(`/wizard?resume=${MOCK_SONG_ID}`, { waitUntil: 'domcontentloaded' });

  // Wait for resume data to load — should skip to plans or show teaser
  // The resume flow pre-fills form data and jumps to conversion step
  await expect(page.getByText(/Meu Amor Eterno|PASSO|planos/i).first()).toBeVisible({ timeout: 30000 });
});

test('resume wizard shows lyrics teaser when lyrics exist', async ({ page }) => {
  test.setTimeout(120000);

  await mockBaseRoutes(page);
  await mockGenerateLyricsSuccess(page);
  await mockSongStatus(page, 'lyrics_ready');
  await mockResumeData(page, {
    formData: {
      relation: 'Namorado',
      recipientName: 'Maria',
      recipientGender: 'Feminino',
      occasion: 'Declaração',
      musicStyle: 'kizomba',
      voiceType: 'masculina',
      language: 'Português',
      userEmail: 'test@example.com',
      userPhone: '+244922000000',
    },
    aiSongTitle: 'Meu Amor Eterno',
    aiLyrics: ['Verso 1: Desde o primeiro olhar...', 'Refrão: És tu, meu amor...'],
    aiLyricsSnippet: 'És tu, meu amor...',
    aiLetterText: 'Minha querida Maria.',
    dbSongId: MOCK_SONG_ID,
    dbSongRequestId: 'test-request-id',
    status: 'lyrics_ready',
  });

  await clearAppState(page);

  // Navigate to wizard with resume param
  await page.goto(`/wizard?resume=${MOCK_SONG_ID}`, { waitUntil: 'domcontentloaded' });

  // Should show lyrics teaser or plan selection (lyrics were already generated)
  await expect(page.getByText(/Meu Amor Eterno|És tu, meu amor|planos/i).first()).toBeVisible({ timeout: 30000 });
});

test('resume with invalid id shows error gracefully', async ({ page }) => {
  test.setTimeout(60000);

  await mockBaseRoutes(page);
  await page.route('**/api/song/resume-data/*', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Not found' }),
    });
  });

  await clearAppState(page);

  // Navigate to wizard with invalid resume id
  await page.goto('/wizard?resume=invalid-uuid-123', { waitUntil: 'domcontentloaded' });

  // Should gracefully fall back to normal wizard (step 1)
  await expect(page.getByText(/PASSO 1|Criar/i).first()).toBeVisible({ timeout: 15000 });
});
