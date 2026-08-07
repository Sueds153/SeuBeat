import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendAdminNotification: vi.fn<(subject: unknown, body: unknown) => Promise<void>>(),
  generateLyricsWithGPT: vi.fn(),
  generateLyricsWithClaude: vi.fn(),
  generateLyricsWithGemini: vi.fn(),
}));

vi.mock('../services/email', () => ({
  sendAdminNotification: (subject: unknown, body: unknown) => mocks.sendAdminNotification(subject, body),
}));

vi.mock('../services/openai', () => ({
  generateLyricsWithGPT: () => mocks.generateLyricsWithGPT(),
}));

vi.mock('../services/claude', () => ({
  generateLyricsWithClaude: () => mocks.generateLyricsWithClaude(),
}));

vi.mock('../services/gemini', () => ({
  generateLyricsWithGemini: () => mocks.generateLyricsWithGemini(),
}));

import { generateLyrics } from '../services/ai';
import type { AIProviderFailure } from '../services/aiShared';

type GenerateLyrics = typeof generateLyrics;

const minimalForm = {
  userNick: 'Autor',
  recipientName: 'Destinatario',
  recipientGender: 'Masculino',
  recipientRelation: 'Parceiro',
  recipientNick: '',
  hookPhrase: '',
  occasion: 'Homenagem',
  whyCreatedToday: '',
  musicStyle: 'Kizomba',
  referenceArtist: '',
  voiceType: 'Masculina',
  unforgettableMemory: '',
  whatMakesSpecial: '',
  onlySheDoes: '',
  whereItHappened: '',
  messageFromTheHeart: '',
  desiredEmotion: 'Emocionante',
  language: 'português',
};

describe('generateLyrics failure handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai';
    process.env.GEMINI_API_KEY = 'test-gemini';
    process.env.ANTHROPIC_API_KEY = 'test-claude';
    mocks.generateLyricsWithGPT.mockRejectedValue(new Error('Insufficient quota: 429 Too Many Requests'));
    mocks.generateLyricsWithClaude.mockRejectedValue(new Error('Insufficient quota: 429 Too Many Requests'));
    mocks.generateLyricsWithGemini.mockRejectedValue(new Error('503 The model is overloaded. Please retry later.'));
  });

  it('throws when all providers fail and attaches providerFailures', async () => {
    const { generateLyrics } = await import('../services/ai');
    const err = await generateLyrics(minimalForm).then(
      () => null,
      (e) => e as Error & { providerFailures?: AIProviderFailure[] }
    );

    expect(err).toBeInstanceOf(Error);
    expect(err!.providerFailures).toBeDefined();
    expect(err!.providerFailures!.length).toBe(3);
    expect(err!.providerFailures!.map((f) => f.provider).sort()).toEqual(['claude', 'gemini', 'openai']);
    const gemini = err!.providerFailures!.find((f) => f.provider === 'gemini');
    expect(gemini!.kind).toBe('transient');
    const openai = err!.providerFailures!.find((f) => f.provider === 'openai');
    expect(openai!.kind).toBe('credits');
  });

  it('sends admin notification with context', async () => {
    const { generateLyrics } = await import('../services/ai');
    await generateLyrics(minimalForm, { requestId: 'abc-123', email: 'cliente@test.com' }).catch(() => undefined);

    expect(mocks.sendAdminNotification).toHaveBeenCalledTimes(1);
    const [subject, body] = mocks.sendAdminNotification.mock.calls[0] as unknown as [string, string];
    expect(subject).toContain('[ALERTA]');
    expect(body).toContain('cliente@test.com');
    expect(body).toContain('abc-123');
    expect(body).toContain('gemini');
  });

  it('suppresses duplicate alerts within cooldown', async () => {
    const { generateLyrics } = await import('../services/ai');
    await generateLyrics(minimalForm, { requestId: 'a' }).catch(() => undefined);
    await generateLyrics(minimalForm, { requestId: 'b' }).catch(() => undefined);

    expect(mocks.sendAdminNotification).toHaveBeenCalledTimes(1);
  });
});
