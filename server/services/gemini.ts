import { GoogleGenAI } from '@google/genai';
import { LyricsComposition, WizardFormData } from './types';
import { selectPrompt } from './prompts';
import { withAIServiceRetry, validateComposition, extractJSON } from './aiShared';

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
