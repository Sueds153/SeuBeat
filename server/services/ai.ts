import { LyricsComposition, AIProvider } from './types';
import { generateLyricsWithGPT } from './openai';
import { generateLyricsWithClaude } from './claude';
import { generateLyricsWithGemini } from './gemini';
import { logInfo, logWarn, logError } from '../utils/logger';

export async function generateLyrics(formData: any): Promise<{ result: LyricsComposition; provider: AIProvider }> {
  const providers: { name: AIProvider; key: string; fn: (data: any) => Promise<LyricsComposition> }[] = [
    { name: 'claude', key: 'ANTHROPIC_API_KEY', fn: generateLyricsWithClaude },
    { name: 'openai', key: 'OPENAI_API_KEY', fn: generateLyricsWithGPT },
    { name: 'gemini', key: 'GEMINI_API_KEY', fn: generateLyricsWithGemini },
  ];

  const available = providers.filter(p => !!process.env[p.key]);

  if (available.length === 0) {
    throw new Error('Nenhuma chave de API de IA configurada (ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY).');
  }

  let lastError: any;

  for (const { name, fn } of available) {
    try {
      logInfo(`[AI] A tentar provedor: ${name}`);
      const result = await fn(formData);
      logInfo(`[AI] Letra gerada com sucesso via ${name}`);
      return { result, provider: name };
    } catch (err: any) {
      lastError = err;
      logWarn(`[AI] Provedor ${name} falhou: ${err?.message}`);
    }
  }

  logError('[AI] Todos os provedores falharam', lastError);
  throw lastError instanceof Error ? lastError : new Error('Nenhuma API de IA funcionou.');
}
