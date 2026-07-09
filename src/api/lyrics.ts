export interface GenerateLyricsPayload {
  userNick: string;
  recipientName: string;
  recipientNick: string;
  recipientRelation: string;
  occasion: string;
  whyCreatedToday: string;
  musicStyle: string;
  referenceArtist: string;
  voiceType: string;
  whatMakesSpecial: string;
  onlySheDoes: string;
  unforgettableMemory: string;
  whereItHappened: string;
  messageFromTheHeart: string;
  desiredEmotion: string;
  language: string;
  email: string;
  phone: string;
  photoBase64?: string | null;
  photoFilename?: string;
  photoMimeType?: string;
}

export interface GenerateLyricsResponse {
  success: boolean;
  songId?: string;
  songTitle?: string;
  lyrics?: string[];
  error?: string;
}

export async function generateLyrics(data: GenerateLyricsPayload): Promise<GenerateLyricsResponse> {
  const res = await fetch('/api/generate-lyrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro de conexão' }));
    return { success: false, error: body.error || `Erro ${res.status}` };
  }
  return res.json();
}

export async function sendEmail(payload: { songId: string; email: string }): Promise<void> {
  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
