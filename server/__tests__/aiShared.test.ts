import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  classifyAIError,
  retryBackoffMs,
  withAIServiceRetry,
} from '../services/aiShared';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('classifyAIError', () => {
  it('classifies credit/quota errors as credits', () => {
    expect(classifyAIError('No credits remaining')).toBe('credits');
    expect(classifyAIError('Credit balance too low')).toBe('credits');
    expect(classifyAIError('Insufficient quota for this request')).toBe('credits');
  });

  it('classifies 5xx/high-demand as transient', () => {
    expect(classifyAIError('503 Service Unavailable')).toBe('transient');
    expect(classifyAIError('The model is overloaded. Please try again later.')).toBe('transient');
    expect(classifyAIError('RESOURCE_EXHAUSTED: 429 Too Many Requests')).toBe('transient');
    expect(classifyAIError('Request timed out')).toBe('transient');
  });

  it('classifies config errors as config', () => {
    expect(classifyAIError('OPENAI_API_KEY não configurada')).toBe('config');
    expect(classifyAIError('Missing API key configuration')).toBe('config');
  });

  it('classifies auth errors as auth', () => {
    expect(classifyAIError('401 Unauthorized')).toBe('auth');
    expect(classifyAIError('Invalid API key provided')).toBe('auth');
    expect(classifyAIError('authentication failed')).toBe('auth');
  });

  it('classifies unknown messages as other', () => {
    expect(classifyAIError('Something totally unrelated')).toBe('other');
  });
});

describe('retryBackoffMs', () => {
  it('grows exponentially with attempt', () => {
    const delays = [1, 2, 3].map((attempt) => retryBackoffMs(attempt, 1000, 8000));
    expect(delays[0]).toBeGreaterThanOrEqual(500);
    expect(delays[0]).toBeLessThanOrEqual(1000);
    expect(delays[1]).toBeGreaterThanOrEqual(1000);
    expect(delays[1]).toBeLessThanOrEqual(2000);
    expect(delays[2]).toBeGreaterThanOrEqual(2000);
    expect(delays[2]).toBeLessThanOrEqual(4000);
  });

  it('caps at maxBackoffMs', () => {
    const delay = retryBackoffMs(10, 1000, 3000);
    expect(delay).toBeLessThanOrEqual(3000);
  });

  it('never returns 0 for the first attempt', () => {
    expect(retryBackoffMs(1, 1000, 8000)).toBeGreaterThan(0);
  });
});

describe('withAIServiceRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(withAIServiceRetry('Test', fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors up to transientMaxAttempts', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce('recovered');
    await expect(
      withAIServiceRetry('Test', fn, undefined, { transientMaxAttempts: 4, baseDelayMs: 1, maxBackoffMs: 2 })
    ).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after exhausting transient budget', async () => {
    const fn = vi.fn(async () => {
      throw new Error('503 Service Unavailable');
    });
    await expect(
      withAIServiceRetry('Test', fn, undefined, { transientMaxAttempts: 3, baseDelayMs: 1, maxBackoffMs: 2 })
    ).rejects.toThrow('503');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry fatal errors (429 quota)', async () => {
    const fn = vi.fn(async () => {
      throw new Error('Insufficient quota: 429');
    });
    await expect(withAIServiceRetry('Test', fn)).rejects.toThrow('quota');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses custom fatalPatterns when provided', async () => {
    const fn = vi.fn(async () => {
      throw new Error('SAFETY: blocked content');
    });
    await expect(
      withAIServiceRetry('Test', fn, undefined, { fatalPatterns: /SAFETY|blocked/i })
    ).rejects.toThrow('SAFETY');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows transient patterns even when they overlap default fatal', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce('ok');
    await expect(
      withAIServiceRetry('Test', fn, undefined, {
        fatalPatterns: /SAFETY|401|403|invalid.*key/i,
        transientMaxAttempts: 3,
        baseDelayMs: 1,
        maxBackoffMs: 2
      })
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
