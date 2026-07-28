import { GoogleGenAI } from '@google/genai';
import { LyricsComposition, WizardFormData } from './types';
import { selectPrompt } from './prompts';
import { withAIServiceRetry, validateComposition } from './aiShared';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 90000);

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

function extractJSON(text: string): unknown {
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
      const partial = cleanText.slice(firstBrace);
      return JSON.parse(repairTruncatedJSON(partial));
    } catch {}
  }

  throw new Error('Não foi possível extrair um objeto JSON válido da resposta do Gemini.');
}

export async function generateLyricsWithGemini(formData: WizardFormData): Promise<LyricsComposition> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }

  const prompt = selectPrompt(formData);
  const genAI = new GoogleGenAI({ apiKey });

  const SAFETY_FATAL = /SAFETY|FINISH_REASON_SAFETY|blocked/i;

  return withAIServiceRetry('Gemini', async () => {
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
    return validateComposition(json, 'Gemini');
  }, SAFETY_FATAL);
}
