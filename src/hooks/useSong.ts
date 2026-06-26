import { useState, useEffect } from 'react';
import { fetchSongWithTimeout } from '../api/song';
import { MusicStyleType } from '../types';

export interface SongDetails {
  recipientName: string;
  recipientNick: string;
  userNick: string;
  musicStyle: MusicStyleType;
  memory: string;
  whereItHappened: string;
  letter: string;
  photoUrl: string;
  songTitle: string;
  lyrics: string[];
  audioUrl: string;
}

function parseURLParams(): { params: URLSearchParams; dbSongId: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { params, dbSongId: params.get('id') };
}

function buildInitialFromParams(params: URLSearchParams, savedLocalPhoto: string): SongDetails {
  const hpRecipientName = params.get('recipientName');
  const hpRecipientNick = params.get('recipientNick');
  const hpUserNick = params.get('userNick');
  const hpMusicStyle = params.get('musicStyle');
  const hpMemory = params.get('memory');
  const hpWhereItHappened = params.get('whereItHappened');
  const hpLetter = params.get('letter');
  const hpSongTitle = params.get('songTitle');
  const hpLyricsStr = params.get('lyrics');

  let parsedLyrics: string[] = [];
  if (hpLyricsStr) {
    try { parsedLyrics = JSON.parse(hpLyricsStr); } catch { /* ignore */ }
  }

  return {
    recipientName: hpRecipientName || 'Rosa dos Santos',
    recipientNick: hpRecipientNick || 'Minha Rosa',
    userNick: hpUserNick || 'Rui',
    musicStyle: (hpMusicStyle as MusicStyleType) || 'Kizomba',
    memory: hpMemory || 'O pôr do sol inesquecível na baía do Huambo.',
    whereItHappened: hpWhereItHappened || 'Huambo',
    letter: hpLetter || '',
    photoUrl: savedLocalPhoto || '',
    songTitle: hpSongTitle || '',
    lyrics: parsedLyrics,
    audioUrl: '',
  };
}

function buildInitialFromLocalStorage(savedLocalPhoto: string): SongDetails | null {
  const lastCreatedJSON = localStorage.getItem('seubeat_last_created');
  if (!lastCreatedJSON) return null;
  try {
    const parsed = JSON.parse(lastCreatedJSON);
    return {
      recipientName: parsed.recipientName || 'Rosa dos Santos',
      recipientNick: parsed.recipientNick || 'Minha Rosa',
      userNick: parsed.userNick || 'Rui',
      musicStyle: (parsed.musicStyle as MusicStyleType) || 'Kizomba',
      memory: parsed.unforgettableMemory || 'O pôr do sol inesquecível na baía do Huambo.',
      whereItHappened: parsed.whereItHappened || 'Huambo',
      letter: parsed.messageFromTheHeart || '',
      photoUrl: parsed.photoUrl || savedLocalPhoto || '',
      songTitle: parsed.songTitle || '',
      lyrics: parsed.lyrics || [],
      audioUrl: '',
    };
  } catch {
    return null;
  }
}

interface UseSongResult {
  isLoading: boolean;
  notFound: boolean;
  fetchError: boolean;
  songDetails: SongDetails;
  setSongDetails: React.Dispatch<React.SetStateAction<SongDetails>>;
}

export function useSong(): UseSongResult {
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [songDetails, setSongDetails] = useState<SongDetails>(() => {
    const savedLocalPhoto = localStorage.getItem('seubeat_temp_photo') || '';
    const { params } = parseURLParams();
    const fromStorage = buildInitialFromLocalStorage(savedLocalPhoto);
    if (fromStorage) return fromStorage;
    return buildInitialFromParams(params, savedLocalPhoto);
  });

  useEffect(() => {
    const savedLocalPhoto = localStorage.getItem('seubeat_temp_photo') || '';
    const { params, dbSongId } = parseURLParams();

    if (dbSongId) {
      const initial = buildInitialFromParams(params, savedLocalPhoto);
      setSongDetails(initial);

      fetchSongWithTimeout(dbSongId)
        .then(data => {
          if (data === null) {
            setNotFound(true);
          } else if (data.success && data.data) {
            const dbSong = data.data;
            const dbRequest = dbSong.song_requests;
            setSongDetails(prev => ({
              ...prev,
              recipientName: dbRequest?.recipient_name || prev.recipientName,
              userNick: dbRequest?.users?.name || prev.userNick,
              musicStyle: (dbRequest?.music_style as MusicStyleType) || prev.musicStyle,
              letter: dbSong.letter_text || dbSong.dedication_letter || prev.letter,
              songTitle: dbSong.title || prev.songTitle,
              lyrics: dbSong.lyrics || prev.lyrics,
              audioUrl: dbSong.audio_url || prev.audioUrl,
              photoUrl: dbRequest?.photo_url || prev.photoUrl,
            }));
          } else {
            setFetchError(true);
          }
        })
        .catch(() => setFetchError(true))
        .finally(() => setIsLoading(false));
    } else {
      const fallbackId = localStorage.getItem('seubeat_last_song_id');
      if (fallbackId) {
        fetchSongWithTimeout(fallbackId)
          .then(data => {
            if (data === null) {
              setNotFound(true);
            } else if (data.success && data.data) {
              const dbSong = data.data;
              const dbRequest = dbSong.song_requests;
              setSongDetails(prev => ({
                ...prev,
                recipientName: dbRequest?.recipient_name || prev.recipientName,
                userNick: dbRequest?.users?.name || prev.userNick,
                musicStyle: (dbRequest?.music_style as MusicStyleType) || prev.musicStyle,
                letter: dbSong.letter_text || dbSong.dedication_letter || prev.letter,
                songTitle: dbSong.title || prev.songTitle,
                lyrics: dbSong.lyrics || prev.lyrics,
                audioUrl: dbSong.audio_url || prev.audioUrl,
                photoUrl: dbRequest?.photo_url || prev.photoUrl,
              }));
            }
          })
          .catch(() => setFetchError(true))
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  return { isLoading, notFound, fetchError, songDetails, setSongDetails };
}
