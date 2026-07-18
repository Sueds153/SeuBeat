import { LyricsComposition, AIProvider } from './types';
import { generateLyricsWithGPT } from './openai';
import { generateLyricsWithClaude } from './claude';
import { generateLyricsWithGemini } from './gemini';
import { logInfo, logWarn, logError } from '../utils/logger';

const AI_PROVIDER_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 35000);

async function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Provedor ${name} excedeu o tempo limite (${ms / 1000}s)`));
    }, ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function generateLyrics(formData: any): Promise<{ result: LyricsComposition; provider: AIProvider }> {
  const providers: { name: AIProvider; key: string; fn: (data: any) => Promise<LyricsComposition> }[] = [
    { name: 'openai', key: 'OPENAI_API_KEY', fn: generateLyricsWithGPT },
    { name: 'gemini', key: 'GEMINI_API_KEY', fn: generateLyricsWithGemini },
    { name: 'claude', key: 'ANTHROPIC_API_KEY', fn: generateLyricsWithClaude },
  ];

  const available = providers.filter(p => !!process.env[p.key]);

  if (available.length === 0) {
    throw new Error('Nenhuma chave de API de IA configurada (ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY).');
  }

  let lastError: any;

  for (const { name, fn } of available) {
    try {
      logInfo(`[AI] A tentar provedor: ${name}`);
      const result = await withTimeout(fn(formData), AI_PROVIDER_TIMEOUT_MS, name);
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
