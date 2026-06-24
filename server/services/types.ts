export interface ClaudeLyricsComposition {
  songTitle: string;
  lyrics: string[];
  lyricsSnippet?: string;
  letterText: string;
}

export interface SunoResult {
  taskId: string;
  audioUrl: string | null;
  status?: string;
}

export interface RequestProgress {
  status: string;
  progress: number;
  message: string;
  error?: string;
  updatedAt: number;
}
