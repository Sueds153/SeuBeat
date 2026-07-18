import { SunoResult } from './types';
import { logInfo, logWarn, logError } from '../utils/logger';
import { createCircuitBreaker } from '../utils/circuitBreaker';

const sunoBreaker = createCircuitBreaker('suno-api', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60_000,
});

const SUNO_TIMEOUT_MS = Number(process.env.SUNO_TIMEOUT_MS || 45000);
const MAX_RETRIES = Number(process.env.SUNO_MAX_RETRIES || 3);
const SUCCESS_STATUSES = new Set(['success', 'completed', 'done', 'finished', 'succeeded']);
const FAILED_STATUSES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled']);
const DEFAULT_PUBLIC_APP_URL = 'https://seubeat.onrender.com';

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

class SunoQuotaError extends Error {
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

function isImageUrl(key: string, url: string): boolean {
  return (
    key.includes('image') ||
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ||
    /\/image[_-]/i.test(url)
  );
}

function isLikelyAudioUrl(key: string, url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isImageUrl(key, url)) return false;

  return (
    key.includes('audio') ||
    key.includes('song') ||
    /\.(mp3|wav|flac|m4a|aac|ogg)(\?|$)/i.test(url) ||
    /cdn\d*\.suno\.ai\/(?!image[_-])/i.test(url)
  );
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
      isLikelyAudioUrl(lowerKey, nestedValue)
    ) {
      urls.push(nestedValue);
    }

    if (nestedValue && typeof nestedValue === 'object') {
      collectAudioUrls(nestedValue, urls);
    }
  }

  return urls;
}

const STYLE_MAP: Record<string, string> = {
  kizomba: 'kizomba, afro romance, slow tempo 70bpm, sensual rhythm, soft bass, tarraxinha, romantic vocal, african beats',
  semba: 'semba, traditional angolan rhythm, acoustic guitar, fast tempo 120bpm, energetic percussion, dance',
  zouk: 'zouk, caribbean rhythm, romantic, soft synth, french creole vibe, sensual, mid tempo 90bpm',
  samba: 'samba, carnival percussion, brazilian drums, festive, energetic 100bpm, tamborim, agogo, celebration',
  afrobeat: 'afrobeat, upbeat percussion, energetic, african pop, groovy bass, horns, dance 110bpm',
  funk: 'funk, groovy bass, syncopated drums, upbeat, dance, rhythmic guitar, soulful, 100bpm',
  trap: 'trap, 808 bass, hi-hat rolls, dark atmosphere, urban, modern hip hop, 140bpm',
  rap: 'rap, rhythmic flow, spoken word, urban beats, lyrical, hip hop, 90bpm',
  reggae: 'reggae, offbeat rhythm, bass heavy, jamaican vibe, relaxed, skank guitar, 80bpm',
  pop: 'pop, catchy melody, polished production, radio friendly, upbeat, modern, 120bpm',
  balada: 'ballad, slow tempo 70bpm, piano-driven, emotional, orchestral, strings, powerful crescendo',
  gospel: 'gospel, choral harmonies, organ, piano, inspirational, uplifting, powerful vocal, 80bpm',
  acoustic: 'acoustic, soft guitar, intimate vocals, unplugged, warm, gentle, stripped down, 80bpm',
  'romantic pop': 'romantic pop, emotional strings, modern radio ballad, synth pads, catchy chorus, 90bpm',
  'r&b': 'r&b, smooth vocals, groovy bassline, soulful, sensual melody, rhythm and blues, 85bpm',
  hino: 'hino, orchestral, epic cinematic, choir, brass section, majestic, corporate anthem, inspirational, 80bpm',
};

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

export function extractAudioUrl(payload: any): string | null {
  // Tentar encontrar urls explicitamente no payload do Suno
  const sunoData = payload?.data?.response?.sunoData || payload?.response?.sunoData;
  if (Array.isArray(sunoData) && sunoData.length > 0) {
    for (const item of sunoData) {
      const url = firstString(item?.sourceAudioUrl, item?.source_audio_url, item?.audioUrl, item?.audio_url, item?.streamAudioUrl, item?.sourceStreamAudioUrl);
      if (url && isLikelyAudioUrl('audio', url)) return url;
    }
  }

  const urls = collectAudioUrls(payload);
  const sourceUrl = urls.find(url => /cdn\d*\.suno\.ai\/(?!image[_-])/i.test(url));
  if (sourceUrl) return sourceUrl;
  return urls.find(url => /\.(mp3|wav|flac|m4a|aac|ogg)(\?|$)/i.test(url)) || urls[0] || null;
}

const VOICE_STYLE_MAP: Record<string, string> = {
  masculina: 'male vocal, deep voice, masculine tone',
  feminina: 'female vocal, soft voice, feminine tone',
  dueto: 'male and female duet, alternating vocals, harmonized voices',
  'sem preferência': '',
};

const EMOTION_STYLE_MAP: Record<string, string> = {
  amor: 'romantic mood, warm atmosphere, love theme',
  emoção: 'emotional, heartfelt, touching atmosphere',
  gratidão: 'grateful mood, warm and appreciative tone',
  carinho: 'tender, affectionate, gentle mood',
  saudade: 'melancholic, nostalgic, wistful atmosphere',
  inspiração: 'uplifting, inspiring, hopeful mood',
};

const ARTIST_STYLE_MAP: Record<string, string> = {
  'Anselmo Ralph': 'anselmo ralph style, romantic kizomba, warm tenor vocal, soft brass, zouk',
  'Matias Damásio': 'matias damasio style, poetic ballad, emotional vocal, orchestral strings, angolan romantic',
  'Gerilson Insrael': 'gerilson insrael style, afro pop, energetic rhythm, modern angolan, dance vibe',
  'Chelsea Dinorath': 'chelsea dinorath style, neo kizomba, r&b influence, smooth female vocal, sensual',
  'Ary': 'ary style, semba rhythm, soulful vocal, traditional angolan with modern production',
  'Cef': 'cef style, ghetto zouk, romantic dance, catchy rhythm, angolan urban',
  'Nelson Freitas': 'nelson freitas style, zouk international, r&b fusion, smooth romantic, cabo love',
};

function getSunoCallbackUrl() {
  if (process.env.SUNO_CALLBACK_URL) return process.env.SUNO_CALLBACK_URL;

  const appUrl = process.env.APP_URL || DEFAULT_PUBLIC_APP_URL;
  const publicAppUrl = /^https:\/\//i.test(appUrl) ? appUrl : DEFAULT_PUBLIC_APP_URL;
  return `${publicAppUrl.replace(/\/+$/, '')}/api/suno-callback`;
}

function assertSuccessfulSunoPayload(payload: any, label: string) {
  if (typeof payload?.code === 'number' && payload.code !== 200) {
    throw new Error(`${label} API error: ${payload.code} - ${payload.msg || 'Erro desconhecido'}`);
  }
}

export async function querySunoTask(taskId: string): Promise<SunoResult> {
  return sunoBreaker.exec(async () => {
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
  });
}

async function startSunoMusic(lyrics: string[], musicStyle: string, songTitle: string, personaId?: string, extraParams?: { voiceType?: string; desiredEmotion?: string; referenceArtist?: string }): Promise<SunoResult> {
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

  const baseStyle = STYLE_MAP[musicStyle.trim().toLowerCase()] || 'romantic, emotional pop';
  const parts = [baseStyle];

  if (extraParams?.voiceType) {
    const voiceStyle = VOICE_STYLE_MAP[extraParams.voiceType.trim().toLowerCase()];
    if (voiceStyle) parts.push(voiceStyle);
  }

  if (extraParams?.desiredEmotion) {
    const emotionStyle = EMOTION_STYLE_MAP[extraParams.desiredEmotion.trim().toLowerCase()];
    if (emotionStyle) parts.push(emotionStyle);
  }

  if (extraParams?.referenceArtist) {
    const artistStyle = ARTIST_STYLE_MAP[extraParams.referenceArtist.trim()];
    if (artistStyle) parts.push(artistStyle);
  }

  const stylePrompt = parts.join(', ');

  logInfo('[Suno] Submitting music generation task', {
    style: musicStyle,
    enhancedStyle: stylePrompt,
    titleLength: songTitle?.length || 0,
    lyricsLines: lyrics.length,
    hasPersonaId: !!personaId,
    personaIdDebug: personaId ? `${personaId.slice(0, 8)}...` : undefined,
    voiceType: extraParams?.voiceType,
    desiredEmotion: extraParams?.desiredEmotion,
    referenceArtist: extraParams?.referenceArtist,
  });

  const payload: Record<string, any> = {
    prompt: lyricsText,
    style: stylePrompt,
    title: songTitle,
    customMode: true,
    instrumental: false,
    model: 'V5_5',
    callBackUrl: getSunoCallbackUrl(),
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
  assertSuccessfulSunoPayload(generateData, 'Suno generation');
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

async function continueSunoMusic(taskId: string, personaId?: string): Promise<SunoResult> {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) throw new Error('SUNO_API_KEY nao configurada.');
  if (!taskId) throw new Error('Task Suno em falta para continuar.');

  logInfo(`[Suno] Extending task via continue`, { taskId, hasPersonaId: !!personaId });

  const payload: Record<string, any> = { task_id: taskId, callBackUrl: getSunoCallbackUrl() };
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
  assertSuccessfulSunoPayload(data, 'Suno continue');
  const newTaskId = extractTaskId(data);
  if (!newTaskId) throw new Error(`Suno continue did not return a task ID: ${JSON.stringify(data)}`);

  logInfo(`[Suno] Continue task created`, { taskId: newTaskId });
  return { taskId: newTaskId, audioUrl: null, status: 'processing' };
}

export async function generateFullSong(lyrics: string[], musicStyle: string, songTitle: string, personaId?: string, extraParams?: { voiceType?: string; desiredEmotion?: string; referenceArtist?: string }): Promise<SunoResult> {
  return sunoBreaker.exec(async () => {
    const { taskId, audioUrl: immediateAudioUrl } = await startSunoMusic(lyrics, musicStyle, songTitle, personaId, extraParams);
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
  });
}
