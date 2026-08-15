import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendAdminNotification: vi.fn<(subject: unknown, body: unknown) => Promise<void>>(),
  generateLyricsWithGPT: vi.fn(),
  generateLyricsWithClaude: vi.fn(),
  generateLyricsWithGemini: vi.fn(),
  generateLyricsWithDeepSeek: vi.fn(),
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

vi.mock('../services/deepseek', () => ({
  generateLyricsWithDeepSeek: () => mocks.generateLyricsWithDeepSeek(),
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
    delete process.env.DEEPSEEK_API_KEY;
    mocks.generateLyricsWithGPT.mockRejectedValue(new Error('Insufficient quota: 429 Too Many Requests'));
    mocks.generateLyricsWithClaude.mockRejectedValue(new Error('Insufficient quota: 429 Too Many Requests'));
    mocks.generateLyricsWithGemini.mockRejectedValue(new Error('503 The model is overloaded. Please retry later.'));
    mocks.generateLyricsWithDeepSeek.mockRejectedValue(new Error('503 The model is overloaded. Please retry later.'));
  });

  it('usa o deepseek em primeiro lugar quando a chave existe e funciona', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek';
    mocks.generateLyricsWithDeepSeek.mockResolvedValue({
      songTitle: 'Titulo DeepSeek',
      lyrics: Array.from({ length: 16 }, (_, i) => `linha ${i + 1} do refrao final completo`),
      letterText: 'Dedicatória de teste.',
    });

    const { generateLyrics } = await import('../services/ai');
    const { result, provider } = await generateLyrics(minimalForm);

    expect(provider).toBe('deepseek');
    expect(result.songTitle).toBe('Titulo DeepSeek');
    expect(mocks.generateLyricsWithDeepSeek).toHaveBeenCalledTimes(1);
    expect(mocks.generateLyricsWithGemini).not.toHaveBeenCalled();
  });

  it('throws when all providers fail and attaches providerFailures', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek';
    const { generateLyrics } = await import('../services/ai');
    const err = await generateLyrics(minimalForm).then(
      () => null,
      (e) => e as Error & { providerFailures?: AIProviderFailure[] }
    );

    expect(err).toBeInstanceOf(Error);
    expect(err!.providerFailures).toBeDefined();
    expect(err!.providerFailures!.length).toBe(4);
    expect(err!.providerFailures!.map((f) => f.provider).sort()).toEqual(['claude', 'deepseek', 'gemini', 'openai']);
    const deepseek = err!.providerFailures!.find((f) => f.provider === 'deepseek');
    expect(deepseek!.kind).toBe('transient');
    const gemini = err!.providerFailures!.find((f) => f.provider === 'gemini');
    expect(gemini!.kind).toBe('transient');
    const openai = err!.providerFailures!.find((f) => f.provider === 'openai');
    expect(openai!.kind).toBe('credits');
  });

  it('ignora o deepseek quando a chave não existe', async () => {
    const { generateLyrics } = await import('../services/ai');
    const err = await generateLyrics(minimalForm).then(
      () => null,
      (e) => e as Error & { providerFailures?: AIProviderFailure[] }
    );

    expect(err!.providerFailures!.map((f) => f.provider).sort()).toEqual(['claude', 'gemini', 'openai']);
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
