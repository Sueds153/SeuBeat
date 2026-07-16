import Anthropic from '@anthropic-ai/sdk';
import { LyricsComposition } from './types';
import { selectPrompt } from './prompts';
import { logWarn, logInfo, logError } from '../utils/logger';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 15000);
const CLAUDE_MAX_ATTEMPTS = Number(process.env.CLAUDE_MAX_ATTEMPTS || 1);

export function validateClaudeComposition(value: unknown): LyricsComposition {
  if (!value || typeof value !== 'object') {
    throw new Error('Resposta Claude malformada: objeto JSON em falta.');
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
    throw new Error(`Resposta Claude malformada: campos em falta (${missing.join(', ')}).`);
  }

  if (lyrics.length < 12 || lyrics.join('\n').length < 100) {
    throw new Error('Resposta Claude malformada: letra demasiado curta.');
  }

  return { songTitle, lyrics, lyricsSnippet, letterText };
}

function clean(value: unknown, fallback = 'Não informado'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function extractJSON(text: string): any {
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

  throw new Error('Não foi possível extrair um objeto JSON válido da resposta do Claude.');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      reject(new Error(`${label} excedeu o limite de ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function shouldRetryClaude(err: any) {
  const message = err?.message || String(err || '');
  if (/429|quota|balance|credit/i.test(message)) return false;
  return /timeout|excedeu|JSON|malformada|500|502|503|504/i.test(message);
}

export async function generateLyricsWithClaude(formData: any): Promise<LyricsComposition> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada no servidor.');
  }

  const prompt = selectPrompt(formData);
  const anthropic = new Anthropic({ apiKey });

  let lastError: any;

  for (let attempt = 1; attempt <= CLAUDE_MAX_ATTEMPTS; attempt++) {
    try {
      logInfo(`[Claude] Tentativa ${attempt} de geração de letra...`);

      const abortController = new AbortController();

      const responsePromise = anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system: `Você é um compositor de estúdio profissional.
Você deve produzir a letra da música e a dedicatória exclusivamente em formato JSON estruturado.
A sua resposta DEVE ser apenas o objeto JSON sem nenhum texto explicativo, preâmbulo ou conclusão fora do JSON.

O JSON gerado deve obrigatoriamente seguir esta estrutura:
{
  "songTitle": "Título Criativo",
  "lyrics": [
    "[Verso 1]",
    "linha 1 do verso...",
    "linha 2 do verso...",
    "[Pré-Refrão]",
    "linha 1 do pré-refrão...",
    "[Refrão]",
    "linha 1 do refrão...",
    "linha 2 do refrão..."
  ],
  "letterText": "Dedicatória curta (2-3 frases) em prosa, sem repetir a letra."
}`,
        messages: [
          {
            role: 'user',
            content: `Gere a musica baseada nestes dados. Retorne apenas o JSON:\n\n${prompt}`
          }
        ]
      });

      const response = await withTimeout(
        responsePromise,
        CLAUDE_TIMEOUT_MS,
        'Geração Claude',
        abortController
      );

      const block = response.content[0];
      if (!block || block.type !== 'text') {
        throw new Error('Claude retornou conteúdo sem texto ou formato inesperado.');
      }

      const json = extractJSON(block.text);
      return validateClaudeComposition(json);
    } catch (err: any) {
      lastError = err;
      logError(`[Claude] Erro na tentativa ${attempt}`, err);

      if (!shouldRetryClaude(err)) break;
      if (attempt < CLAUDE_MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha desconhecida ao gerar letra com Claude.');
}
