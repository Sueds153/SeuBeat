export interface GenerateLyricsResponse {
  success: boolean;
  dbSongId?: string;
  dbSongRequestId?: string;
  songTitle?: string;
  lyrics?: string[];
  lyricsSnippet?: string;
  letterText?: string;
  error?: string;
  validation_errors?: Array<{ field: string; path?: string; message: string }>;
}

export interface UpdateLyricsResponse {
  success: boolean;
  error?: string;
}

const GENERATE_TIMEOUT = 180000;

function buildGeneratePayload(formData: Record<string, unknown>, photoBase64?: string, photoFilename?: string, photoMimeType?: string) {
  const { photoFile: _pf, photoUrl: _pu, ...formBody } = formData;
  const payload: Record<string, unknown> = { ...formBody };
  if (!payload.email) delete payload.email;
  if (!payload.recipientNick) payload.recipientNick = undefined;
  if (!payload.referenceArtist) payload.referenceArtist = undefined;
  if (!payload.whyCreatedToday) payload.whyCreatedToday = undefined;

  const raw = sessionStorage.getItem('seubeat_utm_params');
  if (raw) {
    try {
      const utm = JSON.parse(raw);
      Object.assign(payload, utm);
    } catch {}
  }

  return {
    ...payload,
    photoBase64,
    photoFilename,
    photoMimeType,
  };
}

export async function generateLyrics(
  formData: Record<string, unknown>,
  photoBase64?: string,
  photoFilename?: string,
  photoMimeType?: string,
  signal?: AbortSignal,
): Promise<GenerateLyricsResponse> {
  const payload = buildGeneratePayload(formData, photoBase64, photoFilename, photoMimeType);
  const res = await fetch('/api/generate-lyrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  const data: GenerateLyricsResponse = await res.json().catch(() => ({
    success: false,
    error: 'Erro na conexão ao gerar letra.',
  }));

  if (!res.ok && !data.error) {
    if (data.validation_errors?.length) {
      const fields = data.validation_errors.map((e) => e.field || e.path || 'campo').join(', ');
      data.error = `Campos inválidos: ${fields}.`;
    } else {
      data.error = `Erro ${res.status}: Não foi possível gerar a letra.`;
    }
  }

  return data;
}

export async function regenerateLyrics(songId: string, signal?: AbortSignal): Promise<GenerateLyricsResponse> {
  const res = await fetch(`/api/song/${songId}/regenerate-lyrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
  });

  return res.json().catch(() => ({ success: false, error: 'Erro na conexão ao regenerar letra.' }));
}

export async function updateLyrics(songId: string, lyrics: string, signal?: AbortSignal): Promise<UpdateLyricsResponse> {
  const res = await fetch(`/api/song/${songId}/lyrics`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lyrics }),
    signal,
  });

  return res.json().catch(() => ({ success: false, error: 'Erro na conexão ao atualizar letra.' }));
}