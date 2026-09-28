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
      'Erro ao processar pagamento: something weird'
    );
  });

  it('falls back to default for empty or very long messages', () => {
    expect(publicErrorMessage(new Error(''))).toBe(
      'Não foi possível concluir esta etapa. Tente novamente em instantes.'
    );
    expect(publicErrorMessage(new Error('x'.repeat(300)))).toBe(
      'Não foi possível concluir esta etapa. Tente novamente em instantes.'
    );
  });

  it('handles Supabase error objects (non-Error instances)', () => {
    const supabaseErr = { message: 'new row violates row-level security policy', code: '42501', details: '', hint: '' };
    expect(publicErrorMessage(supabaseErr)).toBe(
      'Houve um erro ao guardar os seus dados. Por favor, verifique a sua ligação e tente novamente.'
    );
  });

  it('handles upload failure messages', () => {
    expect(publicErrorMessage(new Error('Upload do comprovativo falhou: storage error'))).toBe(
      'Houve um erro ao enviar o ficheiro. Verifique a sua ligação e tente novamente.'
    );
    expect(publicErrorMessage(new Error('Upload da amostra de voz falhou: timeout'))).toBe(
      'Houve um erro ao enviar o ficheiro. Verifique a sua ligação e tente novamente.'
    );
  });

  it('handles voice sample too small', () => {
    expect(publicErrorMessage(new Error('Amostra de voz demasiado pequena. Grava pelo menos 3 segundos.'))).toBe(
      'A foto excede o tamanho máximo permitido (10MB). Use um compressor de imagens online ou escolha uma foto menor.'
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

describe('sanitizePaymentAmount', () => {
  it('mantém os valores do catálogo para o plano correspondente', async () => {
    const { sanitizePaymentAmount } = await import('../utils/helpers');
    expect(sanitizePaymentAmount(7900, 'standard')).toBe(7900);
    expect(sanitizePaymentAmount(9900, 'express')).toBe(9900);
    expect(sanitizePaymentAmount(14900, 'premium')).toBe(14900);
  });

  it('mantém base + addon (ex.: standard com addon de 4.000 Kz)', async () => {
    const { sanitizePaymentAmount } = await import('../utils/helpers');
    expect(sanitizePaymentAmount(11900, 'standard')).toBe(11900);
    expect(sanitizePaymentAmount(9400, 'standard')).toBe(9400);
  });

  it('valor desconhecido cai no preço base do plano', async () => {
    const { sanitizePaymentAmount } = await import('../utils/helpers');
    expect(sanitizePaymentAmount(999999, 'express')).toBe(9900);
    expect(sanitizePaymentAmount(0, 'premium')).toBe(14900);
    expect(sanitizePaymentAmount(-500, 'standard')).toBe(7900);
    expect(sanitizePaymentAmount(NaN, 'standard')).toBe(7900);
  });

  it('valor de outro plano não passa (mantém plano e preço coerentes)', async () => {
    const { sanitizePaymentAmount } = await import('../utils/helpers');
    // 9900 é válido no catálogo, mas não para plan=standard
    expect(sanitizePaymentAmount(9900, 'standard')).toBe(7900);
    expect(sanitizePaymentAmount(7900, 'express')).toBe(9900);
  });

  it('plano desconhecido cai no preço base do standard', async () => {
    const { sanitizePaymentAmount } = await import('../utils/helpers');
    expect(sanitizePaymentAmount(12345, 'video_upsell')).toBe(7900);
  });
});
