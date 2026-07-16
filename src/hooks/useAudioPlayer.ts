import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerOptions {
  audioUrl: string;
  textFallback?: string;
}

interface UseAudioPlayerResult {
  isPlaying: boolean;
  isMuted: boolean;
  audioProgress: number;
  togglePlay: () => void;
  toggleMute: () => void;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAudioPlayer({ audioUrl, textFallback }: UseAudioPlayerOptions): UseAudioPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getUrl = useCallback(() => {
    return audioUrl || '';
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (isPlaying) {
      if (!audioRef.current) {
        const url = getUrl();
        if (!url) return;
        const audio = new Audio(url);
        audio.ontimeupdate = () => {
          const current = audio.currentTime;
          const duration = audio.duration || 60;
          setAudioProgress(Math.min((current / duration) * 100, 100));
        };
        audio.onended = () => {
          setIsPlaying(false);
          setAudioProgress(0);
        };
        audioRef.current = audio;
      }

      audioRef.current.muted = isMuted;
      audioRef.current.play().catch((err) => {
        console.warn('Audio playback interrupted:', err);
      });
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, isMuted, getUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = useCallback(() => setIsPlaying(prev => !prev), []);
  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);

  return { isPlaying, isMuted, audioProgress, togglePlay, toggleMute, setIsPlaying };
}
