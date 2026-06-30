import { SunoResult } from './types';
import { logInfo, logWarn, logError } from '../utils/logger';

const SUNO_TIMEOUT_MS = Number(process.env.SUNO_TIMEOUT_MS || 45000);
const MAX_RETRIES = Number(process.env.SUNO_MAX_RETRIES || 3);
const SUCCESS_STATUSES = new Set(['success', 'completed', 'done', 'finished', 'succeeded']);
const FAILED_STATUSES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled']);

function isQuotaError(status: number, body: string): boolean {
  return status === 429 || /quota|rate\s?limit|exceeded/i.test(body);
}

function getRetryDelay(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
  }
  return Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 30000);
}

export class SunoQuotaError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SunoQuotaError';
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = SUNO_TIMEOUT_MS, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const partialBody = await res.clone().text().then(t => t.slice(0, 500)).catch(() => '');
      if (isQuotaError(res.status, partialBody) && attempt < retries) {
        const backoff = getRetryDelay(attempt, res.headers.get('retry-after'));
        logWarn(`[Suno] Quota/rate limit, retrying`, { status: res.status, attempt, retries, backoff });
        clearTimeout(timeout);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      if (isQuotaError(res.status, partialBody) && attempt >= retries) {
        throw new SunoQuotaError(`Suno quota excedida: ${res.status}. Verifica o teu plano em sunoapi.org.`);
      }
      return res;
    } catch (err: any) {
      if (err instanceof SunoQuotaError) throw err;
      if (err?.name === 'AbortError') {
        throw new Error(`Suno request timeout after ${timeoutMs}ms`);
      }
      if (attempt < retries) {
        const delay = getRetryDelay(attempt);
        logWarn(`[Suno] Attempt failed, retrying`, { attempt, retries, error: err.message, delay });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Suno request failed after ${retries} retries`);
}

async function safeResponseText(res: Response) {
  const text = await res.text();
  return text.slice(0, 800);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function collectAudioUrls(value: unknown, urls: string[] = []): string[] {
  if (!value || typeof value !== 'object') return urls;

  if (Array.isArray(value)) {
    for (const item of value) collectAudioUrls(item, urls);
    return urls;
  }

  const record = value as Record<string, unknown>;
  for (const [key, nestedValue] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();
    if (
      typeof nestedValue === 'string' &&
      /^https?:\/\//i.test(nestedValue) &&
      (
        lowerKey.includes('audio') ||
        lowerKey.includes('song') ||
        lowerKey.includes('url') ||
        lowerKey.endsWith('_url')
      )
    ) {
      urls.push(nestedValue);
    }

    if (nestedValue && typeof nestedValue === 'object') {
      collectAudioUrls(nestedValue, urls);
    }
  }

  return urls;
}

function extractTaskId(payload: any): string | null {
  return firstString(
    payload?.taskId,
    payload?.task_id,
    payload?.data?.taskId,
    payload?.data?.task_id,
    payload?.id,
    payload?.data?.id
  );
}

function extractStatus(payload: any): string {
  const rawStatus = firstString(
    payload?.status,
    payload?.state,
    payload?.data?.status,
    payload?.data?.state,
    payload?.task_status,
    payload?.data?.task_status
  );

  return (rawStatus || 'processing').toLowerCase();
}

function extractAudioUrl(payload: any): string | null {
  // Tentar encontrar urls explicitamente no payload do Suno
  const sunoData = payload?.data?.response?.sunoData || payload?.response?.sunoData;
  if (Array.isArray(sunoData) && sunoData.length > 0) {
    const url = sunoData[0]?.audioUrl || sunoData[0]?.audio_url || sunoData[0]?.url;
    if (url) return url;
  }

  const urls = collectAudioUrls(payload);
  return urls.find(url => /\.(mp3|wav|flac|m4a|aac|ogg)(\?|$)/i.test(url)) || urls[0] || null;
}

export async function querySunoTask(taskId: string): Promise<SunoResult> {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) throw new Error('SUNO_API_KEY nao configurada.');
  if (!taskId) throw new Error('Task Suno em falta.');

  const statusRes = await fetchWithTimeout(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!statusRes.ok) {
    const errText = await safeResponseText(statusRes);
    if (isQuotaError(statusRes.status, errText)) {
      throw new SunoQuotaError(`Suno query falhou (quota): ${statusRes.status} - Verifica o teu plano em sunoapi.org`);
    }
    throw new Error(`Suno query failed: ${statusRes.status} - ${errText}`);
  }

  const statusData = await statusRes.json();
  const status = extractStatus(statusData);
  const audioUrl = extractAudioUrl(statusData);

  if (FAILED_STATUSES.has(status)) {
    const safe = JSON.stringify(statusData).slice(0, 200);
    throw new Error(`Suno task failed: ${safe}`);
  }

  return { taskId, audioUrl, status };
}

export async function startSunoMusic(lyrics: string[], musicStyle: string, songTitle: string, personaId?: string): Promise<SunoResult> {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) throw new Error('SUNO_API_KEY nao configurada.');

  const lyricsText = lyrics.filter(Boolean).join('\n').trim();
  if (!lyricsText) throw new Error('Letra em falta para gerar musica no Suno.');

  // Verificação rápida de créditos (não bloqueante)
  try {
    const creditRes = await fetch('https://api.sunoapi.org/api/v1/generate/credit', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (creditRes.ok) {
      const creditData = await creditRes.json();
      const remaining = creditData?.data?.remaining ?? creditData?.remaining ?? -1;
      if (remaining === 0) {
        logWarn('[Suno] Créditos esgotados (0 restantes)');
      } else if (remaining > 0) {
        logInfo('[Suno] Créditos restantes', { remaining });
      }
    }
  } catch {
    // Falha na verificação de créditos não impede o fluxo
  }

  const styleMap: Record<string, string> = {
    kizomba: 'kizomba, slow tempo, romantic vocal, african beats, sensual rhythm',
    semba: 'semba, tradicional angola beat, acoustic guitar, fast tempo',
    zouk: 'zouk, caribbean rhythm, romantic, soft synth, french creole vibe',
    'bossa nova': 'bossa nova, soft acoustic guitar, gentle vocals, brazilian jazz',
    mpb: 'mpb, brazilian popular music, melodic, warm acoustic, rich harmony',
    samba: 'samba, carnival percussion, energetic, brazilian drums, festive',
    afrobeat: 'afrobeat, upbeat percussion, energetic dance, african pop',
    funk: 'funk, groovy bass, syncopated drums, upbeat, dance floor',
    trap: 'trap, 808 bass, hi-hat rolls, dark atmosphere, urban',
    rap: 'rap, rhythmic flow, spoken word, urban beats, lyrical',
    reggae: 'reggae, offbeat rhythm, bass heavy, jamaican vibe, relaxed',
    rock: 'rock, electric guitar, powerful drums, energetic, anthemic',
    pop: 'pop, catchy melody, polished production, radio friendly',
    balada: 'ballad, slow tempo, piano-driven, emotional, orchestral',
    gospel: 'gospel, choral harmonies, organ backing, inspirational vocal',
    acoustic: 'acoustic guitar, intimate vocals, soft unplugged ballad',
    'romantic pop': 'romantic pop ballad, emotional strings, modern radio melody',
    'r&b': 'r&b, smooth vocals, groovy bassline, soulful rhythm, sensual melody',
  };

  const stylePrompt = styleMap[musicStyle.trim().toLowerCase()] || 'romantic, emotional pop';

  logInfo('[Suno] Submitting music generation task', {
    style: musicStyle,
    titleLength: songTitle?.length || 0,
    lyricsLines: lyrics.length,
    hasPersonaId: !!personaId,
    personaIdDebug: personaId ? `${personaId.slice(0, 8)}...` : undefined,
  });

  const payload: Record<string, any> = {
    prompt: lyricsText,
    style: stylePrompt,
    title: songTitle,
    customMode: true,
    instrumental: false,
    model: 'V5_5',
    callBackUrl: ''
  };

  if (personaId) {
    payload.personaId = personaId;
    payload.personaModel = 'voice_persona';
  }

  if (personaId) {
    logInfo('[Suno] Payload inclui personaId', { personaIdPreview: JSON.stringify(payload.personaId).slice(0, 60) });
  }

  const generateRes = await fetchWithTimeout('https://api.sunoapi.org/api/v1/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!generateRes.ok) {
    const errText = await safeResponseText(generateRes);
    if (isQuotaError(generateRes.status, errText)) {
      throw new SunoQuotaError(`Suno geração falhou (quota excedida): ${generateRes.status}. Renova os créditos em sunoapi.org.`);
    }
    throw new Error(`Suno generation failed: ${generateRes.status} - ${errText}`);
  }

  const generateData = await generateRes.json();
  const taskId = extractTaskId(generateData);
  const immediateAudioUrl = extractAudioUrl(generateData);

  if (!taskId) {
    if (immediateAudioUrl) return { taskId: `instant_${Date.now()}`, audioUrl: immediateAudioUrl };
    throw new Error(`Suno did not return a task ID: ${JSON.stringify(generateData)}`);
  }

  if (personaId) {
    logInfo('[Suno] Response for personaId task', { taskId, hasImmediateAudio: !!immediateAudioUrl });
  }

  logInfo(`[Suno] Task created`, { taskId });
  return { taskId, audioUrl: immediateAudioUrl, status: extractStatus(generateData) };
}

async function pollSunoTask(taskId: string, immediateAudioUrl: string | null, label = 'Suno', maxAttempts = 30): Promise<SunoResult> {
  if (immediateAudioUrl) {
    return { taskId, audioUrl: immediateAudioUrl };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 10000));
    try {
      const result = await querySunoTask(taskId);
      const status = result.status || 'processing';
      logInfo(`[${label} Polling] Attempt`, { attempt: attempt + 1, status, taskId });

      if (result.audioUrl) {
        return result;
      }

      if (SUCCESS_STATUSES.has(status)) {
        throw new Error(`${label} task completed but no audio URL was found.`);
      }
    } catch (err: any) {
      logWarn(`[${label} Polling] Attempt failed`, { attempt: attempt + 1, error: err.message, taskId });
      if (attempt === maxAttempts - 1) throw err;
    }
  }

  throw new Error(`${label} generation timed out after ${(maxAttempts * 10) / 60} minutes.`);
}

export async function continueSunoMusic(taskId: string, personaId?: string): Promise<SunoResult> {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) throw new Error('SUNO_API_KEY nao configurada.');
  if (!taskId) throw new Error('Task Suno em falta para continuar.');

  logInfo(`[Suno] Extending task via continue`, { taskId, hasPersonaId: !!personaId });

  const payload: Record<string, any> = { task_id: taskId };
  if (personaId) {
    payload.personaId = personaId;
    payload.personaModel = 'voice_persona';
    logInfo('[Suno] Continue payload inclui personaId', { personaIdPreview: JSON.stringify(payload.personaId).slice(0, 60) });
  }

  const continueRes = await fetchWithTimeout('https://api.sunoapi.org/api/v1/generate/continue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!continueRes.ok) {
    const errText = await safeResponseText(continueRes);
    throw new Error(`Suno continue failed: ${continueRes.status} - ${errText}`);
  }

  const data = await continueRes.json();
  const newTaskId = extractTaskId(data);
  if (!newTaskId) throw new Error(`Suno continue did not return a task ID: ${JSON.stringify(data)}`);

  logInfo(`[Suno] Continue task created`, { taskId: newTaskId });
  return { taskId: newTaskId, audioUrl: null, status: 'processing' };
}

export async function generateFullSong(lyrics: string[], musicStyle: string, songTitle: string, personaId?: string): Promise<SunoResult> {
  const { taskId, audioUrl: immediateAudioUrl } = await startSunoMusic(lyrics, musicStyle, songTitle, personaId);
  const firstResult = await pollSunoTask(taskId, immediateAudioUrl, 'Suno Gen1');
  if (!firstResult.audioUrl) throw new Error('Primeira geracao Suno falhou - sem URL de audio.');

  logInfo(`[Suno] First clip ready`);

  try {
    const { taskId: continueTaskId } = await continueSunoMusic(firstResult.taskId, personaId);
    const secondResult = await pollSunoTask(continueTaskId, null, 'Suno Gen2 (continue)');
    if (secondResult.audioUrl) {
      logInfo(`[Suno] Extended song ready`);
      return secondResult;
    }
  } catch (err: any) {
    if (err instanceof SunoQuotaError) {
      logWarn(`[Suno] Continue sem créditos, a devolver primeiro clip.`);
    } else {
      logWarn(`[Suno] Continue falhou, a devolver primeiro clip`, { error: err.message });
    }
  }

  return firstResult;
}


