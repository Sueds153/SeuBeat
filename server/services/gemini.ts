import { GoogleGenAI } from '@google/genai';
import { LyricsComposition } from './types';
import { selectPrompt } from './prompts';
import { logInfo, logError } from '../utils/logger';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 90000);
const GEMINI_MAX_ATTEMPTS = Number(process.env.GEMINI_MAX_ATTEMPTS || 2);

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

function repairTruncatedJSON(text: string): string {
  // Se o JSON foi truncado a meio de um array de lyrics, tenta fechar
  let s = text.trim();
  // Remover vírgula final antes de fechar
  s = s.replace(/,\s*$/, '');
  // Contar chaves/parênteses abertos
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
  // Fechar o que está aberto
  for (let i = 0; i < openBrackets; i++) s += ']';
  for (let i = 0; i < openBraces; i++) s += '}';
  return s;
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

  // Última tentativa: reparar JSON truncado (Gemini cortou antes de fechar)
  if (firstBrace !== -1) {
    try {
      const partial = cleanText.slice(firstBrace);
      return JSON.parse(repairTruncatedJSON(partial));
    } catch {}
  }

  logError('[Gemini] Falha ao extrair JSON da resposta do Gemini.', new Error(cleanText));
  throw new Error('Não foi possível extrair um objeto JSON válido da resposta do Gemini.');
}

function clean(value: unknown, fallback = 'Não informado'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function validateGeminiComposition(value: unknown): LyricsComposition {
  if (!value || typeof value !== 'object') {
    throw new Error('Resposta Gemini malformada: objeto JSON em falta.');
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
    throw new Error(`Resposta Gemini malformada: campos em falta (${missing.join(', ')}).`);
  }

  if (lyrics.length < 12 || lyrics.join('\n').length < 100) {
    throw new Error('Resposta Gemini malformada: letra demasiado curta.');
  }

  return { songTitle, lyrics, lyricsSnippet, letterText };
}

export async function generateLyricsWithGemini(formData: any): Promise<LyricsComposition> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }

  const prompt = selectPrompt(formData);
  const genAI = new GoogleGenAI({ apiKey });

  let lastError: any;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      logInfo(`[Gemini] Tentativa ${attempt} de geração de letra...`);

      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: `Gere a musica baseada nestes dados. Retorne apenas o JSON:\n\n${prompt}` }] }
        ],
        config: {
          systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
          maxOutputTokens: 8192,
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini retornou conteúdo vazio ou formato inesperado.');
      }

      const json = extractJSON(text);
      return validateGeminiComposition(json);
    } catch (err: any) {
      lastError = err;
      logError(`[Gemini] Erro na tentativa ${attempt}`, err);

      const message = err?.message || String(err || '');
      // Parar se o erro for fatal (quota, safety block, auth) ou não for retentável
      const isFatal = /429|quota|balance|credit|401|403|unauthorized|SAFETY|FINISH_REASON_SAFETY|blocked/i.test(message);
      const isRetryable = /timeout|excedeu|JSON|malformada|curta|500|502|503|504|ETIMEDOUT|AbortError/i.test(message);
      if (isFatal || !isRetryable) break;
      if (attempt < GEMINI_MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha desconhecida ao gerar letra com Gemini.');
}
