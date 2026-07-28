export interface LyricsComposition {
  songTitle: string;
  lyrics: string[];
  lyricsSnippet?: string;
  letterText: string;
}

export type AIProvider = 'openai' | 'claude' | 'gemini';

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

export interface WizardFormData {
  recipientName?: string;
  recipientGender?: string;
  recipientRelation?: string;
  recipientNick?: string;
  userNick?: string;
  occasion?: string;
  whyCreatedToday?: string;
  musicStyle?: string;
  referenceArtist?: string;
  voiceType?: string;
  whatMakesSpecial?: string;
  onlySheDoes?: string;
  unforgettableMemory?: string;
  whereItHappened?: string;
  messageFromTheHeart?: string;
  language?: string;
  desiredEmotion?: string;
  hookPhrase?: string;
}
