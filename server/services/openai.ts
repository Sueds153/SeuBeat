import OpenAI from 'openai';
import { LyricsComposition, WizardFormData } from './types';
import { selectPrompt } from './prompts';
import { withAIServiceRetry, extractJSON, validateComposition } from './aiShared';

const GPT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GPT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000);

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

export async function generateLyricsWithGPT(formData: WizardFormData): Promise<LyricsComposition> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no servidor.');
  }

  const prompt = selectPrompt(formData);
  const openai = new OpenAI({ apiKey });

  return withAIServiceRetry('GPT', async () => {
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
    return validateComposition(json, 'GPT');
  });
}
