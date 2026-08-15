import { LyricsComposition, AIProvider, WizardFormData } from './types';
import { logError, logInfo, logWarn } from '../utils/logger';

const MAX_ATTEMPTS = Number(process.env.AI_MAX_ATTEMPTS || 2);
const TRANSIENT_MAX_ATTEMPTS = Number(process.env.AI_TRANSIENT_MAX_ATTEMPTS || 4);
const RETRY_BASE_DELAY_MS = Number(process.env.AI_RETRY_BASE_DELAY_MS || 1000);
const RETRY_MAX_BACKOFF_MS = Number(process.env.AI_RETRY_MAX_BACKOFF_MS || 8000);

export type AIFailureKind = 'transient' | 'credits' | 'config' | 'auth' | 'other';

export interface AIProviderFailure {
  provider: AIProvider;
  kind: AIFailureKind;
  message: string;
}

const FATAL_DEFAULT = /429|quota|balance|credit|401|403|unauthorized/i;
const RETRYABLE_DEFAULT = /timeout|excedeu|JSON|malformada|500|502|503|504|ETIMEDOUT|AbortError|429|too many requests|high demand|traffic|overloaded|RESOURCE_EXHAUSTED|temporarily/i;
const TRANSIENT = /500|502|503|504|429|high demand|traffic|overloaded|RESOURCE_EXHAUSTED|temporarily|too many requests/i;

export function classifyAIError(message: string): AIFailureKind {
  if (/no credits|credit balance|credits remaining|quota|balance|insufficient|too low/i.test(message)) return 'credits';
  if (/500|502|503|504|high demand|traffic|overloaded|RESOURCE_EXHAUSTED|temporarily|too many requests|timeout|timed out|excedeu|ETIMEDOUT|AbortError/i.test(message)) return 'transient';
  if (/401|403|unauthorized|authentication|invalid.*key/i.test(message)) return 'auth';
  if (/não configurada|nao configurada|missing.*key|no.*key|_MODEL|configuration|configura/i.test(message)) return 'config';
  return 'other';
}

export function retryBackoffMs(attempt: number, baseDelayMs = RETRY_BASE_DELAY_MS, maxBackoffMs = RETRY_MAX_BACKOFF_MS): number {
  const exponential = Math.min(baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)), maxBackoffMs);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exponential * jitter);
}

export function clean(value: unknown, fallback = 'Não informado'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function repairTruncatedJSON(text: string): string {
  let s = text.trim();
  s = s.replace(/,\s*$/, '');
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets--;
  }
  for (let i = 0; i < openBrackets; i++) s += ']';
  for (let i = 0; i < openBraces; i++) s += '}';
  return s;
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

  if (firstBrace !== -1) {
    try {
      return JSON.parse(repairTruncatedJSON(cleanText.slice(firstBrace)));
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

export interface LyricsStructureIssues {
  issues: string[];
  warnings: string[];
}

export const LYRIC_MARKERS = [
  '[Verso 1]',
  '[Pré-Refrão]',
  '[Refrão]',
  '[Verso 2]',
  '[Ponte Emocional]',
  '[Refrão Final]',
] as const;

const MARKER_ALIASES: Record<string, string[]> = {
  '[Verso 1]': ['verso 1', 'verso i'],
  '[Pré-Refrão]': ['pre refrao', 'pre-refrao'],
  '[Refrão]': ['refrao', 'refrao 1', 'coro', 'estribilho'],
  '[Verso 2]': ['verso 2', 'verso ii'],
  '[Ponte Emocional]': ['ponte emocional', 'ponte'],
  '[Refrão Final]': ['refrao final', 'refrao 2', 'ultimo refrao', 'refrao final x2', 'refrao final (x2)'],
};

const MAX_LINE_REPEATS = 3;

function normalizeToken(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markerIndex(lines: string[], canonical: string): number {
  const aliases = MARKER_ALIASES[canonical] ?? [];
  for (let i = 0; i < lines.length; i++) {
    if (aliases.includes(normalizeToken(lines[i]))) return i;
  }
  return -1;
}

// Validação DIAGNÓSTICA da estrutura: nunca rejeita nem volta a chamar a IA
// (0 créditos extra). Apenas reporta problemas para observabilidade; o prompt
// (mestre.txt / SYSTEM_PROMPT) é o que melhora a estrutura na 1ª chamada.
export function validateLyricsStructure(
  composition: LyricsComposition,
  formData: WizardFormData = {}
): LyricsStructureIssues {
  const issues: string[] = [];
  const warnings: string[] = [];
  const lines = composition.lyrics;

  const found: { canonical: string; index: number }[] = [];
  for (const marker of LYRIC_MARKERS) {
    const index = markerIndex(lines, marker);
    if (index === -1) {
      issues.push(`faltou o marcador "${marker}"`);
    } else {
      found.push({ canonical: marker, index });
    }
  }

  const inOrder = found.every((entry, i) => i === 0 || entry.index > found[i - 1].index);
  if (!inOrder) {
    issues.push('os marcadores estão fora da ordem esperada ([Verso 1] → [Pré-Refrão] → [Refrão] → [Verso 2] → [Ponte Emocional] → [Refrão Final])');
  }

  const fullText = lines.join('\n');
  const hook = clean(formData.hookPhrase, '');
  if (hook) {
    const normHook = normalizeToken(hook);
    if (!normalizeToken(fullText).includes(normHook)) {
      issues.push(`o gancho "${hook}" não aparece na letra`);
    }
  }

  const counts = new Map<string, number>();
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, count]) => count > MAX_LINE_REPEATS);
  if (repeated.length > 0) {
    issues.push(`${repeated.length} linha(s) repetida(s) mais de ${MAX_LINE_REPEATS} vezes`);
  }

  const recipientName = clean(formData.recipientName, '');
  if (recipientName && normalizeToken(recipientName).length >= 2) {
    const searchable = normalizeToken(`${composition.songTitle}\n${fullText}`);
    if (!searchable.includes(normalizeToken(recipientName))) {
      warnings.push(`nome do destinatário "${recipientName}" não aparece na letra nem no título`);
    }
  }

  return { issues, warnings };
}

export function validateCompositionStrict(
  value: unknown,
  label: string,
  formData: WizardFormData = {}
): LyricsComposition {
  const composition = validateComposition(value, label);
  const { issues, warnings } = validateLyricsStructure(composition, formData);
  if (issues.length > 0) {
    logWarn(`[${label}] Estrutura da letra com problemas (entregue como está, sem rejeição)`, { issues });
  }
  if (warnings.length > 0) {
    logWarn(`[${label}] Personalização com avisos`, { warnings });
  }
  return composition;
}

export interface AIServiceRetryOptions {
  fatalPatterns?: RegExp;
  transientMaxAttempts?: number;
  baseDelayMs?: number;
  maxBackoffMs?: number;
}

export async function withAIServiceRetry<T>(
  label: string,
  fn: (attempt: number) => Promise<T>,
  extraFatalPatterns?: RegExp,
  options?: AIServiceRetryOptions
): Promise<T> {
  let lastError: unknown;
  const maxAttempts = MAX_ATTEMPTS;
  const transientMaxAttempts = options?.transientMaxAttempts ?? TRANSIENT_MAX_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? RETRY_BASE_DELAY_MS;
  const maxBackoffMs = options?.maxBackoffMs ?? RETRY_MAX_BACKOFF_MS;

  const fatal = options?.fatalPatterns
    ? options.fatalPatterns
    : extraFatalPatterns
      ? new RegExp(FATAL_DEFAULT.source + '|' + extraFatalPatterns.source, FATAL_DEFAULT.flags)
      : FATAL_DEFAULT;

  let attempt = 1;
  for (;;) {
    try {
      logInfo(`[${label}] Tentativa ${attempt} de geração de letra...`);
      return await fn(attempt);
    } catch (err: unknown) {
      lastError = err;
      logError(`[${label}] Erro na tentativa ${attempt}`, err instanceof Error ? err : new Error(String(err)));
      const message = err instanceof Error ? err.message : String(err ?? '');
      const isTransient = TRANSIENT.test(message);
      const attemptBudget = isTransient ? transientMaxAttempts : maxAttempts;
      if (fatal.test(message) || !RETRYABLE_DEFAULT.test(message) || attempt >= attemptBudget) break;
      const delay = retryBackoffMs(attempt, baseDelayMs, maxBackoffMs);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Falha desconhecida ao gerar letra com ${label}.`);
}