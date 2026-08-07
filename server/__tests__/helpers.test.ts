import { describe, it, expect } from 'vitest';
import { publicErrorMessage } from '../utils/helpers';

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
