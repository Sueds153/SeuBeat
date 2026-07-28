import Anthropic from '@anthropic-ai/sdk';
import { LyricsComposition, WizardFormData } from './types';
import { selectPrompt } from './prompts';
import { withAIServiceRetry, extractJSON, validateComposition } from './aiShared';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 60000);

const SAFETY_FATAL = /SAFETY|FINISH_REASON_SAFETY|blocked/i;

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

export async function generateLyricsWithClaude(formData: WizardFormData): Promise<LyricsComposition> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada no servidor.');
  }

  const prompt = selectPrompt(formData);
  const anthropic = new Anthropic({ apiKey });

  return withAIServiceRetry('Claude', async () => {
    const abortController = new AbortController();

    const responsePromise = anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
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
    return validateComposition(json, 'Claude');
  }, SAFETY_FATAL);
}
