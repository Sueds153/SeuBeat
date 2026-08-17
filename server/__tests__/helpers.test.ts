import { describe, it, expect, beforeEach, vi } from 'vitest';
import { publicErrorMessage } from '../utils/helpers';

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe('publicErrorMessage', () => {
  it('prioritizes transient/traffic over credits when both present', () => {
    const err = new Error('Gemini 503 high demand; OpenAI insufficient quota 429');
    expect(publicErrorMessage(err)).toBe('Estamos com muita procura neste momento. Tente novamente em instantes.');
  });

  it('returns transient message for 5xx/high-demand', () => {
    expect(publicErrorMessage(new Error('503 Service Unavailable'))).toBe(
      'Estamos com muita procura neste momento. Tente novamente em instantes.'
    );
    expect(publicErrorMessage(new Error('The model is overloaded. Please try later.'))).toBe(
      'Estamos com muita procura neste momento. Tente novamente em instantes.'
    );
  });

  it('keeps credits message when no transient pattern matches', () => {
    expect(publicErrorMessage(new Error('Credit balance too low: 429'))).toBe(
      'O saldo de créditos da API de geração de letras está esgotado. Contacte a equipa SeuBeat para recarregar.'
    );
  });

  it('keeps config message when no transient pattern matches', () => {
    expect(publicErrorMessage(new Error('CLAUDE_MODEL inválido'))).toBe(
      'A configuração do modelo de geração de letras está incorreta. Por favor, contacte o suporte.'
    );
  });

  it('falls back for unknown errors', () => {
    expect(publicErrorMessage(new Error('something weird'))).toBe(
      'Não foi possível concluir esta etapa. Tente novamente em instantes.'
    );
  });
});

describe('kzToUsd', () => {
  it('converts Kz amounts to USD using default rate 1200', async () => {
    vi.resetModules();
    const { kzToUsd } = await import('../utils/helpers');
    expect(kzToUsd(7900)).toBe(6.58);
    expect(kzToUsd(9900)).toBe(8.25);
    expect(kzToUsd(14900)).toBe(12.42);
  });

  it('respects USD_TO_KZ_RATE env var', async () => {
    vi.stubEnv('USD_TO_KZ_RATE', '900');
    vi.resetModules();
    const { kzToUsd } = await import('../utils/helpers');
    expect(kzToUsd(900)).toBe(1);
    expect(kzToUsd(14900)).toBe(16.56);
  });
});
