import { useState, useEffect } from 'react';
import { fetchSongWithTimeout } from '../api/song';
import { MusicStyleType } from '../types';

export interface SongDetails {
  id: string;
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
  status: string;
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
    id: '',
    recipientName: hpRecipientName || 'Alguém especial',
    recipientNick: hpRecipientNick || hpRecipientName || 'Alguém especial',
    userNick: hpUserNick || 'SeuBeat',
    musicStyle: (hpMusicStyle as MusicStyleType) || 'Kizomba',
    memory: hpMemory || '',
    whereItHappened: hpWhereItHappened || '',
    letter: hpLetter || '',
    photoUrl: savedLocalPhoto || '',
    songTitle: hpSongTitle || '',
    lyrics: parsedLyrics,
    audioUrl: '',
    status: '',
  };
}

function buildInitialFromLocalStorage(savedLocalPhoto: string): SongDetails | null {
  const lastCreatedJSON = localStorage.getItem('seubeat_last_created');
  if (!lastCreatedJSON) return null;
  try {
    const parsed = JSON.parse(lastCreatedJSON);
    return {
      id: parsed.dbSongId || '',
      recipientName: parsed.recipientName || 'Alguém especial',
      recipientNick: parsed.recipientNick || parsed.recipientName || 'Alguém especial',
      userNick: parsed.userNick || 'SeuBeat',
      musicStyle: (parsed.musicStyle as MusicStyleType) || 'Kizomba',
      memory: parsed.unforgettableMemory || '',
      whereItHappened: parsed.whereItHappened || '',
      letter: parsed.messageFromTheHeart || '',
      photoUrl: parsed.photoUrl || savedLocalPhoto || '',
      songTitle: parsed.songTitle || '',
      lyrics: parsed.lyrics || [],
      audioUrl: '',
      status: '',
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

function applyFetchedSong(prev: SongDetails, dbSong: NonNullable<NonNullable<import('../api/song').SongApiResponse['data']>>): SongDetails {
  const dbRequest = dbSong.song_requests;
  const recipientName = dbRequest?.recipient_name || dbSong.recipient_name || prev.recipientName;
  const userNick = dbRequest?.users?.name || dbSong.user_name || prev.userNick;
  const musicStyle = dbRequest?.music_style || dbSong.music_style || prev.musicStyle;
  const memory = dbRequest?.memory || dbSong.memory || prev.memory;
  const photoUrl = dbRequest?.photo_url || dbSong.photo_url || prev.photoUrl;

  return {
    ...prev,
    id: dbSong.id || prev.id,
    recipientName,
    recipientNick: prev.recipientNick && prev.recipientNick !== 'Alguém especial' ? prev.recipientNick : recipientName,
    userNick,
    musicStyle: musicStyle as MusicStyleType,
    memory,
    letter: dbSong.letter_text || prev.letter,
    songTitle: dbSong.title || prev.songTitle,
    lyrics: dbSong.lyrics || prev.lyrics,
    audioUrl: dbSong.audio_url || prev.audioUrl,
    photoUrl,
    status: dbSong.status || prev.status,
  };
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
            setSongDetails(prev => applyFetchedSong(prev, data.data!));
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
              setSongDetails(prev => applyFetchedSong(prev, data.data!));
            } else {
              setFetchError(true);
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
