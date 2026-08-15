import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  classifyAIError,
  retryBackoffMs,
  withAIServiceRetry,
  validateLyricsStructure,
  validateCompositionStrict,
  LYRIC_MARKERS,
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

interface TestComposition {
  songTitle: string;
  lyrics: string[];
  lyricsSnippet: string;
  letterText: string;
}

function buildComposition(linesOverride?: string[]): TestComposition {
  const lines = linesOverride ?? [
    '[Verso 1]', 'linha um do verso', 'linha dois do verso',
    '[Pré-Refrão]', 'linha pre refrao um', 'linha pre refrao dois',
    '[Refrão]', 'o meu amor é bué forte', 'nunca mais te deixo ir',
    '[Verso 2]', 'linha verso dois um', 'linha verso dois dois',
    '[Ponte Emocional]', 'ponte emocional um', 'ponte emocional dois',
    '[Refrão Final]', 'o meu amor é bué forte', 'nunca mais te deixo ir',
  ];
  return {
    songTitle: 'Canção Teste',
    lyrics: lines,
    lyricsSnippet: 'o meu amor é bué forte',
    letterText: 'Dedicatória de teste.',
  };
}

describe('LYRIC_MARKERS', () => {
  it('exposes the 6 canonical markers in order', () => {
    expect(LYRIC_MARKERS).toEqual([
      '[Verso 1]',
      '[Pré-Refrão]',
      '[Refrão]',
      '[Verso 2]',
      '[Ponte Emocional]',
      '[Refrão Final]',
    ]);
  });
});

describe('validateLyricsStructure', () => {
  it('returns no issues for a well-formed composition', () => {
    const result = validateLyricsStructure(buildComposition(), {});
    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('accepts alias markers (Coro, Ponte)', () => {
    const comp = buildComposition();
    const lines = comp.lyrics.map((line) => {
      if (line === '[Refrão]') return '[Coro]';
      if (line === '[Ponte Emocional]') return '[Ponte]';
      return line;
    });
    const result = validateLyricsStructure({ ...comp, lyrics: lines }, {});
    expect(result.issues).toEqual([]);
  });

  it('flags a missing marker', () => {
    const comp = buildComposition();
    const lines = comp.lyrics.filter((line) => line !== '[Ponte Emocional]');
    const result = validateLyricsStructure({ ...comp, lyrics: lines }, {});
    expect(result.issues.join(' ')).toContain('[Ponte Emocional]');
  });

  it('flags markers out of order', () => {
    const comp = buildComposition();
    const lines = [...comp.lyrics];
    const idx = lines.indexOf('[Refrão]');
    const [marker] = lines.splice(idx, 1);
    lines.unshift(marker);
    const result = validateLyricsStructure({ ...comp, lyrics: lines }, {});
    expect(result.issues.join(' ')).toContain('ordem');
  });

  it('flags a hook phrase missing from the lyric', () => {
    const result = validateLyricsStructure(buildComposition(), {
      hookPhrase: 'frase gancho que nunca aparece',
    });
    expect(result.issues.join(' ')).toContain('gancho');
  });

  it('does not flag a hook present in the lyric (chorus fallback)', () => {
    const result = validateLyricsStructure(buildComposition(), {
      hookPhrase: 'o meu amor é bué forte',
    });
    expect(result.issues.join(' ')).not.toContain('gancho');
  });

  it('flags a line repeated more than 3 times', () => {
    const comp = buildComposition();
    const lines = [
      ...comp.lyrics,
      'linha repetida demais',
      'linha repetida demais',
      'linha repetida demais',
      'linha repetida demais',
    ];
    const result = validateLyricsStructure({ ...comp, lyrics: lines }, {});
    expect(result.issues.join(' ')).toContain('repetida');
  });

  it('does not flag chorus lines that repeat 2x across Refrão/Refrão Final', () => {
    const comp = buildComposition();
    const result = validateLyricsStructure({ ...comp, lyrics: comp.lyrics }, {});
    expect(result.issues.join(' ')).not.toContain('repetida');
  });

  it('adds a soft warning when the recipient name is absent', () => {
    const result = validateLyricsStructure(buildComposition(), {
      recipientName: 'Zulmira',
    });
    expect(result.warnings.join(' ')).toContain('Zulmira');
    expect(result.issues).toEqual([]);
  });
});

describe('validateCompositionStrict', () => {
  it('returns the composition even with structure issues (diagnostic-only)', () => {
    const comp = buildComposition();
    const lyrics = comp.lyrics.filter((line) => line !== '[Ponte Emocional]');
    const out = validateCompositionStrict({ ...comp, lyrics }, 'Test');
    expect(out.lyrics).toEqual(lyrics);
  });

  it('still rejects malformed/short compositions (same as validateComposition)', () => {
    expect(() =>
      validateCompositionStrict(
        { songTitle: 'x', lyrics: ['a'], letterText: 'y' },
        'Test'
      )
    ).toThrow();
  });

  it('passes through a valid composition untouched', () => {
    const comp = buildComposition();
    const out = validateCompositionStrict(comp, 'Test');
    expect(out.songTitle).toBe('Canção Teste');
    expect(out.lyrics).toHaveLength(comp.lyrics.length);
  });
});
