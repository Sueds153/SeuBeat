import OpenAI from 'openai';
import { LyricsComposition, WizardFormData } from './types';
import { selectPrompt } from './prompts';
import { withAIServiceRetry, extractJSON, validateCompositionStrict } from './aiShared';
import { getDeepSeekApiKey } from './deepseekConfig';

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 30000);

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
}

A letra deve usar EXATAMENTE estes marcadores, cada um numa linha própria do array "lyrics", nesta ordem:
[Verso 1], [Pré-Refrão], [Refrão], [Verso 2], [Ponte Emocional], [Refrão Final]`;

export async function generateLyricsWithDeepSeek(formData: WizardFormData): Promise<LyricsComposition> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY não configurada no servidor (ou alias DEEPSEEK_SECRET_KEY).');
  }

  const prompt = selectPrompt(formData);
  const deepseek = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });

  return withAIServiceRetry('DeepSeek', async () => {
    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 4000,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      // DeepSeek: desliga o modo de raciocínio (thinking) para permitir temperatura
      // e reduzir custo/latência. `thinking` é um campo específico da API DeepSeek.
      ...({ thinking: { type: 'disabled' } } as Record<string, unknown>),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Gere a musica baseada nestes dados. Retorne apenas o JSON:\n\n${prompt}` }
      ]
    }, {
      timeout: DEEPSEEK_TIMEOUT_MS,
      signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('DeepSeek retornou conteúdo vazio ou formato inesperado.');
    }

    const json = extractJSON(content);
    return validateCompositionStrict(json, 'DeepSeek', formData);
  });
}
