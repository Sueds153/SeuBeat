import { LyricsComposition, AIProvider, WizardFormData } from './types';
import { generateLyricsWithGPT } from './openai';
import { generateLyricsWithClaude } from './claude';
import { generateLyricsWithGemini } from './gemini';
import { classifyAIError, AIProviderFailure } from './aiShared';
import { sendAdminNotification } from './email';
import { logInfo, logWarn, logError } from '../utils/logger';

const AI_PROVIDER_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 120000);
const ADMIN_ALERT_COOLDOWN_MS = Number(process.env.ADMIN_ALERT_COOLDOWN_MS || 15 * 60 * 1000);

let lastAdminAlertAt = 0;

const DEFAULT_PROVIDER_ORDER: AIProvider[] = ['gemini', 'openai', 'claude'];

// Ordem dos providers controlável por AI_PROVIDER_ORDER (ex: "gemini,openai,claude").
// Útil para despriorizar/ignorar um provider sem chave de créditos (ex: OpenAI 429).
function providerOrder(): AIProvider[] {
  const raw = process.env.AI_PROVIDER_ORDER;
  if (!raw) return DEFAULT_PROVIDER_ORDER;
  const order = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is AIProvider => s === 'openai' || s === 'gemini' || s === 'claude');
  return order.length ? order : DEFAULT_PROVIDER_ORDER;
}

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

export interface GenerateLyricsContext {
  requestId?: string;
  email?: string;
}

export async function generateLyrics(
  formData: WizardFormData,
  context: GenerateLyricsContext = {}
): Promise<{ result: LyricsComposition; provider: AIProvider }> {
  const providers: { name: AIProvider; key: string; fn: (data: WizardFormData) => Promise<LyricsComposition> }[] = [
    { name: 'openai', key: 'OPENAI_API_KEY', fn: generateLyricsWithGPT },
    { name: 'gemini', key: 'GEMINI_API_KEY', fn: generateLyricsWithGemini },
    { name: 'claude', key: 'ANTHROPIC_API_KEY', fn: generateLyricsWithClaude },
  ];

  const available = providers.filter(p => !!process.env[p.key]);

  if (available.length === 0) {
    throw new Error('Nenhuma chave de API de IA configurada (ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY).');
  }

  const order = providerOrder();
  available.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  let lastError: unknown;
  const providerFailures: AIProviderFailure[] = [];

  for (const { name, fn } of available) {
    try {
      logInfo(`[AI] A tentar provedor: ${name}`);
      const result = await withTimeout(fn(formData), AI_PROVIDER_TIMEOUT_MS, name);
      logInfo(`[AI] Letra gerada com sucesso via ${name}`);
      return { result, provider: name };
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      providerFailures.push({ provider: name, kind: classifyAIError(message), message });
      logWarn(`[AI] Provedor ${name} falhou: ${message}`);
    }
  }

  logError('[AI] Todos os provedores falharam', lastError);
  await notifyAdminOnFailure(providerFailures, context);
  const finalError = lastError instanceof Error ? lastError : new Error('Nenhuma API de IA funcionou.');
  (finalError as Error & { providerFailures?: AIProviderFailure[] }).providerFailures = providerFailures;
  throw finalError;
}

async function notifyAdminOnFailure(failures: AIProviderFailure[], context: GenerateLyricsContext): Promise<void> {
  const now = Date.now();
  if (now - lastAdminAlertAt < ADMIN_ALERT_COOLDOWN_MS) {
    logInfo('[AI] Alerta admin suprimido (cooldown)');
    return;
  }
  lastAdminAlertAt = now;

  const detail = failures
    .map(f => `- ${f.provider}: ${f.kind} — ${f.message.slice(0, 300)}`)
    .join('\n');
  const who = context.email ? `Utilizador: ${context.email}` : '';
  const which = context.requestId ? `Request ID: ${context.requestId}` : '';

  try {
    await sendAdminNotification(
      `[ALERTA] Falha na geração de letras (${failures.length} providers)`,
      `Todos os provedores de IA falharam:\n\n${detail}\n\n${[who, which].filter(Boolean).join('\n')}\n\nContacte o utilizador ou verifique as chaves/quotas.`
    );
    logInfo('[AI] Alerta admin enviado com sucesso');
  } catch (err) {
    logWarn('[AI] Falha ao enviar alerta admin', err instanceof Error ? err : new Error(String(err)));
  }
}
