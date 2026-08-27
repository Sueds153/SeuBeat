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
const FAILED_STATUSES = new Set([
  'failed',
  'failure',
  'error',
  'cancelled',
  'canceled',
  'create_task_failed',
  'generate_audio_failed',
  'sensitive_word_error',
  'callback_exception',
]);
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
    } catch (err: unknown) {
      if (err instanceof SunoQuotaError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Suno request timeout after ${timeoutMs}ms`);
      }
      if (attempt < retries) {
        const delay = getRetryDelay(attempt);
        logWarn(`[Suno] Attempt failed, retrying`, { attempt, retries, error: err instanceof Error ? err.message : String(err), delay });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      logError('[Suno] Fetch failed after all retries', err instanceof Error ? err : new Error(String(err)), { url, retries });
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
  kizomba: 'kizomba, afro romance, angolan romantic, slow tempo 70bpm, sensual rhythm, soft bass, tarraxinha, romantic vocal, african beats',
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

function extractTaskId(payload: unknown): string | null {
  const p = payload as Record<string, unknown>;
  return firstString(
    p['taskId'] as string | undefined,
    p['task_id'] as string | undefined,
    (p['data'] as Record<string, unknown> | undefined)?.['taskId'] as string | undefined,
    (p['data'] as Record<string, unknown> | undefined)?.['task_id'] as string | undefined,
    p['id'] as string | undefined,
    (p['data'] as Record<string, unknown> | undefined)?.['id'] as string | undefined
  );
}

function extractStatus(payload: unknown): string {
  const p = payload as Record<string, unknown>;
  const rawStatus = firstString(
    p['status'] as string | undefined,
    p['state'] as string | undefined,
    (p['data'] as Record<string, unknown> | undefined)?.['status'] as string | undefined,
    (p['data'] as Record<string, unknown> | undefined)?.['state'] as string | undefined,
    p['task_status'] as string | undefined,
    (p['data'] as Record<string, unknown> | undefined)?.['task_status'] as string | undefined
  );

  return (rawStatus || 'processing').toLowerCase();
}

export function extractAudioUrl(payload: unknown): string | null {
  return extractBothAudioUrls(payload).v1;
}

export function extractBothAudioUrls(payload: unknown): { v1: string | null; v2: string | null } {
  const p = payload as Record<string, unknown>;
  const data = p['data'] as Record<string, unknown> | undefined;
  const response = p['response'] as Record<string, unknown> | undefined;
  const sunoData = (data?.['response'] as Record<string, unknown> | undefined)?.['sunoData'] || response?.['sunoData'];

  const validUrls: string[] = [];

  if (Array.isArray(sunoData) && sunoData.length > 0) {
    for (const item of sunoData) {
      const url = firstString(
        (item as Record<string, unknown>)?.['sourceAudioUrl'] as string | undefined,
        (item as Record<string, unknown>)?.['source_audio_url'] as string | undefined,
        (item as Record<string, unknown>)?.['audioUrl'] as string | undefined,
        (item as Record<string, unknown>)?.['audio_url'] as string | undefined,
        (item as Record<string, unknown>)?.['streamAudioUrl'] as string | undefined,
        (item as Record<string, unknown>)?.['sourceStreamAudioUrl'] as string | undefined
      );
      if (url && isLikelyAudioUrl('audio', url)) validUrls.push(url);
    }
  }

  if (validUrls.length < 2) {
    const allUrls = collectAudioUrls(payload);
    for (const url of allUrls) {
      if (validUrls.length >= 2) break;
      if (!validUrls.includes(url)) validUrls.push(url);
    }
  }

  return { v1: validUrls[0] || null, v2: validUrls[1] || null };
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

// Sotaque angolano no canto. Fraseado só positivo (negações são pouco fiáveis
// em prompts de áudio e podem dar efeito contrário). Desligável via env.
const ANGOLAN_ACCENT_STYLE =
  'Angolan Portuguese accent (Luanda), authentic Angolan Portuguese pronunciation, singing in Angolan Portuguese';
const SUNO_ACCENT_ENABLED = process.env.SUNO_ACCENT_ENABLED !== 'false';
const PORTUGUESE_TEXT_RE = /[àáâãéêíóôõúç]/i;

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

function assertSuccessfulSunoPayload(payload: Record<string, unknown>, label: string) {
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
  // Só expor audioUrl quando o estado é final de sucesso. Estados intermédios
  // (TEXT_SUCCESS/FIRST_SUCCESS) devolvem clips parciais que não devem ser entregues.
  let audioUrl: string | null = null;
  let audioUrlV2: string | null = null;
  if (SUCCESS_STATUSES.has(status)) {
    const both = extractBothAudioUrls(statusData);
    audioUrl = both.v1;
    audioUrlV2 = both.v2;
  }

  if (FAILED_STATUSES.has(status)) {
    const safe = JSON.stringify(statusData).slice(0, 200);
    throw new Error(`Suno task failed: ${safe}`);
  }

  return { taskId, audioUrl, audioUrlV2, status };
  });
}

export function normalizeLyricsArray(lyrics: unknown): string[] {
  if (!lyrics) return [];
  if (Array.isArray(lyrics)) {
    return lyrics.map(item => (typeof item === 'string' ? item : String(item || ''))).filter(Boolean);
  }
  if (typeof lyrics === 'string') {
    const trimmed = lyrics.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(item => (typeof item === 'string' ? item : String(item || ''))).filter(Boolean);
        }
      } catch {}
    }
    return trimmed.split('\n').filter(Boolean);
  }
  return [];
}

export async function startSunoMusic(lyrics: string[] | string, musicStyle: string, songTitle: string, personaId?: string, extraParams?: { voiceType?: string; desiredEmotion?: string; referenceArtist?: string }): Promise<SunoResult> {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) throw new Error('SUNO_API_KEY nao configurada.');

  const lyricsArray = normalizeLyricsArray(lyrics);
  const lyricsText = lyricsArray.join('\n').trim();
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

  const isPortugueseLyrics = PORTUGUESE_TEXT_RE.test(lyricsText);
  const accentApplied = SUNO_ACCENT_ENABLED && isPortugueseLyrics;
  if (accentApplied) {
    parts.push(ANGOLAN_ACCENT_STYLE);
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
    accentApplied,
  });

  const payload: Record<string, unknown> = {
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

  if (!taskId) {
    // Nunca devolver um clip parcial como música final
    throw new Error(`Suno did not return a task ID: ${JSON.stringify(generateData).slice(0, 200)}`);
  }

  if (personaId) {
    logInfo('[Suno] Response for personaId task', { taskId });
  }

  logInfo(`[Suno] Task created`, { taskId });
  return { taskId, audioUrl: null, audioUrlV2: null, status: extractStatus(generateData) };
}

export async function pollSunoTask(taskId: string, _immediateAudioUrl: string | null, label = 'Suno', maxAttempts = 30): Promise<SunoResult> {
  // Não aceitar o áudio imediato: pode ser um clip parcial (ex: 8s) devolvido em
  // TEXT_SUCCESS/FIRST_SUCCESS. Esperar sempre pelo estado final SUCCESS.
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
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('task failed')) {
        throw err;
      }
      logWarn(`[${label} Polling] Attempt failed`, { attempt: attempt + 1, error: err instanceof Error ? err.message : String(err), taskId });
      if (attempt === maxAttempts - 1) throw err;
    }
  }

  throw new Error(`${label} generation timed out after ${(maxAttempts * 10) / 60} minutes.`);
}

export async function generateFullSong(lyrics: string[] | string, musicStyle: string, songTitle: string, personaId?: string, extraParams?: { voiceType?: string; desiredEmotion?: string; referenceArtist?: string }): Promise<SunoResult> {
  return sunoBreaker.exec(async () => {
    // O endpoint /api/v1/generate já devolve a música completa (2 pistas, ~2-3 min).
    // O fluxo anterior de "extend" (continueSunoMusic) usava um endpoint que já não
    // existe (404) e entregava um clip parcial (~8s) como música final.
    const { taskId } = await startSunoMusic(lyrics, musicStyle, songTitle, personaId, extraParams);
    const result = await pollSunoTask(taskId, null, 'Suno');
    if (!result.audioUrl) throw new Error('Geracao Suno falhou - sem URL de audio.');

    logInfo(`[Suno] Full song ready`, { taskId });
    return result;
  });
}
