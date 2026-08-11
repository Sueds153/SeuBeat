import { describe, it, expect } from 'vitest';
import { allFailuresTransient, LYRIC_GENERATION_QUEUED_MESSAGE } from '../utils/aiFailure';

describe('allFailuresTransient', () => {
  it('true quando todas as falhas são transitórias', () => {
    expect(
      allFailuresTransient([
        { provider: 'gemini', kind: 'transient', message: '503 high demand' },
        { provider: 'openai', kind: 'transient', message: 'timeout' },
      ])
    ).toBe(true);
  });

  it('false quando não é um array', () => {
    expect(allFailuresTransient(undefined)).toBe(false);
    expect(allFailuresTransient(null)).toBe(false);
    expect(allFailuresTransient({})).toBe(false);
  });

  it('false quando o array está vazio', () => {
    expect(allFailuresTransient([])).toBe(false);
  });

  it('false quando inclui falha não transitória (créditos)', () => {
    expect(
      allFailuresTransient([
        { provider: 'gemini', kind: 'transient', message: '503' },
        { provider: 'openai', kind: 'credits', message: '429 no credits' },
      ])
    ).toBe(false);
  });

  it('false quando inclui falha de configuração', () => {
    expect(
      allFailuresTransient([
        { provider: 'gemini', kind: 'transient', message: '503' },
        { provider: 'claude', kind: 'config', message: 'ANTHROPIC_API_KEY inválida' },
      ])
    ).toBe(false);
  });

  it('a constante de mensagem amigável está definida', () => {
    expect(LYRIC_GENERATION_QUEUED_MESSAGE.length).toBeGreaterThan(10);
  });
});
