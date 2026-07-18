import OpenAI from 'openai';
import { LyricsComposition } from './types';
import { selectPrompt } from './prompts';
import { logInfo, logError } from '../utils/logger';

const GPT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GPT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000);
const GPT_MAX_ATTEMPTS = Number(process.env.OPENAI_MAX_ATTEMPTS || 2);

const SYSTEM_PROMPT = `Você é um compositor de estúdio profissional.
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
  "letterText": "Dedicatória curta (2-3 frases) em prosa, sem repetir a letra.",
  "lyricsSnippet": "Pequeno trecho da letra (máx 200 caracteres) para pré-visualização."
}`;

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

  throw new Error('Não foi possível extrair um objeto JSON válido da resposta do GPT.');
}

function clean(value: unknown, fallback = 'Não informado'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function validateGPTComposition(value: unknown): LyricsComposition {
  if (!value || typeof value !== 'object') {
    throw new Error('Resposta GPT malformada: objeto JSON em falta.');
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
    throw new Error(`Resposta GPT malformada: campos em falta (${missing.join(', ')}).`);
  }

  if (lyrics.length < 12 || lyrics.join('\n').length < 100) {
    throw new Error('Resposta GPT malformada: letra demasiado curta.');
  }

  return { songTitle, lyrics, lyricsSnippet, letterText };
}

export async function generateLyricsWithGPT(formData: any): Promise<LyricsComposition> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no servidor.');
  }

  const prompt = selectPrompt(formData);
  const openai = new OpenAI({ apiKey });

  let lastError: any;

  for (let attempt = 1; attempt <= GPT_MAX_ATTEMPTS; attempt++) {
    try {
      logInfo(`[GPT] Tentativa ${attempt} de geração de letra...`);

      const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        max_tokens: 4000,
        temperature: 0.8,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Gere a musica baseada nestes dados. Retorne apenas o JSON:\n\n${prompt}` }
        ]
      }, {
        timeout: GPT_TIMEOUT_MS,
        signal: AbortSignal.timeout(GPT_TIMEOUT_MS),
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('GPT retornou conteúdo vazio ou formato inesperado.');
      }

      const json = extractJSON(content);
      return validateGPTComposition(json);
    } catch (err: any) {
      lastError = err;
      logError(`[GPT] Erro na tentativa ${attempt}`, err);

      const message = err?.message || String(err || '');
      // Parar se o erro for fatal (quota, auth, etc.) ou não for retentável
      const isFatal = /429|quota|balance|credit|401|403|unauthorized/i.test(message);
      const isRetryable = /timeout|excedeu|JSON|malformada|500|502|503|504|ETIMEDOUT|AbortError/i.test(message);
      if (isFatal || !isRetryable) break;
      if (attempt < GPT_MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha desconhecida ao gerar letra com GPT.');
}
