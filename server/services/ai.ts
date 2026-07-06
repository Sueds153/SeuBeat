import { LyricsComposition, AIProvider } from './types';
import { generateLyricsWithGPT } from './openai';
import { generateLyricsWithClaude } from './claude';
import { logInfo, logWarn, logError } from '../utils/logger';

function getPrimaryProvider(): AIProvider {
  const provider = (process.env.AI_PRIMARY_PROVIDER || 'claude').toLowerCase();
  if (provider !== 'openai' && provider !== 'claude') return 'claude';
  return provider;
}

function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function hasClaudeKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generateLyrics(formData: any): Promise<{ result: LyricsComposition; provider: AIProvider }> {
  const primary = getPrimaryProvider();
  const hasPrimary = primary === 'openai' ? hasOpenAIKey() : hasClaudeKey();
  const fallback = primary === 'openai' ? 'claude' : 'openai';
  const hasFallback = fallback === 'openai' ? hasOpenAIKey() : hasClaudeKey();

  if (!hasPrimary && !hasFallback) {
    throw new Error('Nenhuma chave de API de IA configurada (OPENAI_API_KEY ou ANTHROPIC_API_KEY).');
  }

  const tryProvider = async (provider: AIProvider): Promise<LyricsComposition> => {
    if (provider === 'openai') return generateLyricsWithGPT(formData);
    return generateLyricsWithClaude(formData);
  };

  if (hasPrimary) {
    try {
      logInfo(`[AI] A tentar provedor primário: ${primary}`);
      const result = await tryProvider(primary);
      logInfo(`[AI] Letra gerada com sucesso via ${primary}`);
      return { result, provider: primary };
    } catch (err: any) {
      logWarn(`[AI] Provedor primário ${primary} falhou: ${err?.message}`);
      if (!hasFallback) throw err;
    }
  }

  logInfo(`[AI] A tentar provedor fallback: ${fallback}`);
  const result = await tryProvider(fallback);
  logInfo(`[AI] Letra gerada com sucesso via ${fallback}`);
  return { result, provider: fallback };
}
