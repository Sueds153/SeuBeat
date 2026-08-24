const FETCH_TIMEOUT = 10000;

export interface SongApiResponse {
  success: boolean;
  data?: {
    id: string;
    requestId: string;
    title?: string;
    lyrics?: string[];
    audioUrl?: string;
    letterText?: string;
    dedicationLetter?: string;
    recipientName?: string;
    userName?: string;
    musicStyle?: string;
    memory?: string;
    occasion?: string;
    relationship?: string;
    desiredEmotion?: string;
    voiceType?: string;
    recipientGender?: string;
    photoUrl?: string;
    status?: string;
    lyricsSnippet?: string;
    regenerationCount?: number;
    duration?: number;
    createdAt?: string;
    updatedAt?: string;
    murekaStatus?: string;
    previewUrl?: string;
    elevenlabsVoiceId?: string | null;
    songRequests?: {
      recipientName?: string;
      musicStyle?: string;
      memory?: string;
      photoUrl?: string;
      users?: {
        name?: string;
      };
    };
  };
}

export async function fetchSong(id: string, signal?: AbortSignal): Promise<SongApiResponse | null> {
  const res = await fetch(`/api/song/${id}`, { signal });
  if (res.status === 404) return null;
  return res.json();
}

export async function fetchSongWithTimeout(id: string, signal?: AbortSignal): Promise<SongApiResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  const combinedSignal = signal
    ? combineAbortSignals(controller.signal, signal)
    : controller.signal;
  try {
    return await fetchSong(id, combinedSignal);
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface ResumeDataResponse {
  success: boolean;
  data?: {
    formData: Record<string, string>;
    aiSongTitle?: string;
    aiLyrics?: string[];
    aiLyricsSnippet?: string;
    aiLetterText?: string;
    dbSongId?: string;
    dbSongRequestId?: string;
    status?: string;
  };
  error?: string;
}

export async function fetchResumeData(requestId: string, signal?: AbortSignal): Promise<ResumeDataResponse | null> {
  const res = await fetch(`/api/song/resume-data/${encodeURIComponent(requestId)}`, { signal });
  if (res.status === 404 || res.status === 400) return null;
  return res.json();
}

export interface RecoverByEmailResponse {
  success: boolean;
  status?: string;
  message?: string;
  resumeUrl?: string;
  requestId?: string;
  recipientName?: string;
  error?: string;
}

export async function recoverByEmail(email: string, signal?: AbortSignal): Promise<RecoverByEmailResponse | null> {
  try {
    const res = await fetch('/api/song/recover-by-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal,
    });
    if (res.status === 404) return { success: false, error: 'Não encontrámos nenhuma música para esse email.' };
    return await res.json();
  } catch {
    return null;
  }
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { controller.abort(sig.reason); return controller.signal; }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

