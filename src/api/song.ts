const FETCH_TIMEOUT = 10000;

export interface SongApiResponse {
  success: boolean;
  data?: {
    id: string;
    title?: string;
    lyrics?: string[];
    audio_url?: string;
    letter_text?: string;
    dedication_letter?: string;
    recipient_name?: string;
    user_name?: string;
    music_style?: string;
    memory?: string;
    occasion?: string;
    relationship?: string;
    desired_emotion?: string;
    voice_type?: string;
    recipient_gender?: string;
    photo_url?: string;
    status?: string;
    song_requests?: {
      recipient_name?: string;
      music_style?: string;
      memory?: string;
      photo_url?: string;
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

export async function fetchSongWithTimeout(id: string): Promise<SongApiResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetchSong(id, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

