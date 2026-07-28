import { LyricsComposition } from './types';
import { logError, logInfo } from '../utils/logger';

const MAX_ATTEMPTS = Number(process.env.AI_MAX_ATTEMPTS || 2);

export function clean(value: unknown, fallback = 'Não informado'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function extractJSON(text: string): unknown {
  const cleanText = text.trim();
  try {
    return JSON.parse(cleanText);
  } catch {}

  const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }

  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleanText.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  throw new Error('Não foi possível extrair um objeto JSON válido da resposta.');
}

export function validateComposition(value: unknown, label: string): LyricsComposition {
  if (!value || typeof value !== 'object') {
    throw new Error(`Resposta ${label} malformada: objeto JSON em falta.`);
  }

  const data = value as Record<string, unknown>;
  const songTitle = clean(data.songTitle, '');
  const lyricsSnippet = clean(data.lyricsSnippet, '');
  const letterText = clean(data.letterText, '');

  let lyrics: string[] = [];
  if (Array.isArray(data.lyrics)) {
    lyrics = data.lyrics.map(line => clean(line, '')).filter(Boolean);
  } else if (typeof data.lyrics === 'string') {
    lyrics = data.lyrics.split('\n').map(line => clean(line, '')).filter(Boolean);
  }

  const missing = [
    songTitle ? null : 'songTitle',
    lyrics.length ? null : 'lyrics',
    letterText ? null : 'letterText'
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Resposta ${label} malformada: campos em falta (${missing.join(', ')}).`);
  }

  if (lyrics.length < 12 || lyrics.join('\n').length < 100) {
    throw new Error(`Resposta ${label} malformada: letra demasiado curta.`);
  }

  return { songTitle, lyrics, lyricsSnippet, letterText };
}

export async function withAIServiceRetry<T>(
  label: string,
  fn: (attempt: number) => Promise<T>,
  extraFatalPatterns?: RegExp
): Promise<T> {
  let lastError: unknown;
  const maxAttempts = MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logInfo(`[${label}] Tentativa ${attempt} de geração de letra...`);
      return await fn(attempt);
    } catch (err: unknown) {
      lastError = err;
      logError(`[${label}] Erro na tentativa ${attempt}`, err instanceof Error ? err : new Error(String(err)));
      const message = err instanceof Error ? err.message : String(err ?? '');
      const fatal = /429|quota|balance|credit|401|403|unauthorized/i;
      const retryable = /timeout|excedeu|JSON|malformada|500|502|503|504|ETIMEDOUT|AbortError/i;
      const combinedFatal = extraFatalPatterns
        ? new RegExp(fatal.source + '|' + extraFatalPatterns.source, fatal.flags)
        : fatal;
      if (combinedFatal.test(message) || !retryable.test(message)) break;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Falha desconhecida ao gerar letra com ${label}.`);
}