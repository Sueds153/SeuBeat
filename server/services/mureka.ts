type MurekaResult = {
  taskId: string;
  audioUrl: string | null;
  status?: string;
};

const MUREKA_TIMEOUT_MS = Number(process.env.MUREKA_TIMEOUT_MS || 45000);
const SUCCESS_STATUSES = new Set(['succeeded', 'success', 'complete', 'completed', 'done', 'finished']);
const PENDING_STATUSES = new Set(['queued', 'pending', 'processing', 'running', 'generating', 'created', 'submitted']);
const FAILED_STATUSES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled', 'timeout', 'timeouted']);

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = MUREKA_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Mureka request timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
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
    payload?.id,
    payload?.task_id,
    payload?.taskId,
    payload?.trace_id,
    payload?.data?.id,
    payload?.data?.task_id,
    payload?.data?.taskId,
    payload?.result?.id,
    payload?.result?.task_id,
    payload?.result?.taskId
  );
}

function extractStatus(payload: any): string {
  const rawStatus = firstString(
    payload?.status,
    payload?.state,
    payload?.task_status,
    payload?.data?.status,
    payload?.data?.state,
    payload?.data?.task_status,
    payload?.result?.status,
    payload?.result?.state,
    payload?.result?.task_status
  );

  return (rawStatus || 'processing').toLowerCase();
}

function extractAudioUrl(payload: any): string | null {
  const explicitUrl = firstString(
    payload?.choices?.[0]?.flac_url,
    payload?.choices?.[0]?.wav_url,
    payload?.choices?.[0]?.mp3_url,
    payload?.choices?.[0]?.url,
    payload?.choices?.[0]?.audio_url,
    payload?.data?.choices?.[0]?.flac_url,
    payload?.data?.choices?.[0]?.wav_url,
    payload?.data?.choices?.[0]?.mp3_url,
    payload?.data?.choices?.[0]?.url,
    payload?.data?.choices?.[0]?.audio_url,
    payload?.flac_url,
    payload?.wav_url,
    payload?.mp3_url,
    payload?.audio_url,
    payload?.song_url,
    payload?.url,
    payload?.data?.flac_url,
    payload?.data?.wav_url,
    payload?.data?.mp3_url,
    payload?.data?.audio_url,
    payload?.data?.song_url,
    payload?.data?.url,
    payload?.result?.flac_url,
    payload?.result?.wav_url,
    payload?.result?.mp3_url,
    payload?.result?.audio_url,
    payload?.result?.song_url,
    payload?.result?.url
  );

  if (explicitUrl) return explicitUrl;

  const urls = collectAudioUrls(payload);
  return urls.find(url => /\.(mp3|wav|flac|m4a|aac|ogg)(\?|$)/i.test(url)) || urls[0] || null;
}

export async function queryMurekaTask(taskId: string): Promise<MurekaResult> {
  const apiKey = process.env.MUREKA_API_KEY || '';
  if (!apiKey) throw new Error('MUREKA_API_KEY nao configurada.');
  if (!taskId) throw new Error('Task Mureka em falta.');

  const statusRes = await fetchWithTimeout(`https://api.mureka.ai/v1/song/query/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!statusRes.ok) {
    const errText = await safeResponseText(statusRes);
    throw new Error(`Mureka query failed: ${statusRes.status} - ${errText}`);
  }

  const statusData = await statusRes.json();
  const status = extractStatus(statusData);
  const audioUrl = extractAudioUrl(statusData);

  if (FAILED_STATUSES.has(status)) {
    throw new Error(`Mureka task failed: ${JSON.stringify(statusData)}`);
  }

  return { taskId, audioUrl, status };
}

// Mureka AI music generation and polling helper.
export async function startMurekaMusic(lyrics: string[], musicStyle: string, songTitle: string): Promise<MurekaResult> {
  const apiKey = process.env.MUREKA_API_KEY || '';
  if (!apiKey) throw new Error('MUREKA_API_KEY nao configurada.');

  const lyricsText = lyrics.filter(Boolean).join('\n').trim();
  if (!lyricsText) throw new Error('Letra em falta para gerar musica no Mureka.');

  const styleMap: Record<string, string> = {
    Kizomba: 'kizomba, romantic, slow, african, sensual',
    Semba: 'semba, afro, traditional angolan, guitar',
    Afrobeat: 'afrobeat, upbeat, african pop, energetic',
    Gospel: 'gospel, choir, piano, inspirational, faith',
    Acoustic: 'acoustic, guitar, intimate, emotional, ballad',
    'Romantic Pop': 'romantic pop, ballad, emotional, radio-friendly',
  };

  const stylePrompt = styleMap[musicStyle] || 'romantic, emotional, african pop';

  console.log('[Mureka] Submitting music generation task.', {
    style: musicStyle,
    titleLength: songTitle?.length || 0,
    lyricsLines: lyrics.length
  });

  const generateRes = await fetchWithTimeout('https://api.mureka.ai/v1/song/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: `${songTitle}. Style: ${stylePrompt}. Full vocal song with lead vocals, complete arrangement and emotional production.`,
      lyrics: lyricsText,
      title: songTitle,
      model: 'auto',
    }),
  });

  if (!generateRes.ok) {
    const errText = await safeResponseText(generateRes);
    throw new Error(`Mureka generation failed: ${generateRes.status} - ${errText}`);
  }

  const generateData = await generateRes.json();
  const taskId = extractTaskId(generateData);
  const immediateAudioUrl = extractAudioUrl(generateData);

  if (!taskId) {
    if (immediateAudioUrl) return { taskId: `instant_${Date.now()}`, audioUrl: immediateAudioUrl };
    throw new Error(`Mureka did not return a task ID: ${JSON.stringify(generateData)}`);
  }

  console.log(`[Mureka] Task created: ${taskId}`);
  return { taskId, audioUrl: immediateAudioUrl, status: extractStatus(generateData) };
}

export async function generateMurekaMusic(lyrics: string[], musicStyle: string, songTitle: string): Promise<MurekaResult> {
  const { taskId, audioUrl: immediateAudioUrl } = await startMurekaMusic(lyrics, musicStyle, songTitle);

  if (immediateAudioUrl) {
    return { taskId, audioUrl: immediateAudioUrl };
  }

  // Poll for completion (max 10 minutes, every 10 seconds).
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10000));

    let taskData: MurekaResult;
    try {
      taskData = await queryMurekaTask(taskId);
    } catch (err: any) {
      if ((err.message || '').includes('Mureka task failed')) throw err;
      console.warn(`Mureka poll ${attempt + 1} failed: ${err.message || String(err)}`);
      continue;
    }

    const status = taskData.status || 'processing';
    const audioUrl = taskData.audioUrl;

    console.log(`Mureka poll ${attempt + 1}: status=${status}${audioUrl ? ' audio=ready' : ''}`);

    if (audioUrl && (SUCCESS_STATUSES.has(status) || !PENDING_STATUSES.has(status))) {
      return { taskId, audioUrl };
    }
  }

  return { taskId, audioUrl: null };
}
