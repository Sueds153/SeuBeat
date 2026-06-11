import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Heart, Share2, 
  Download, ArrowLeft, Sparkles, Check, Copy, 
  FileText, MessageCircle, RefreshCw, Upload, Image as ImageIcon,
  Cloud, ExternalLink, LogOut, FolderOpen, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MusicStyleType, EmotionType } from '../types';

interface PersonalizedSongPageProps {
  onBackToLanding: () => void;
}

export default function PersonalizedSongPage({ onBackToLanding }: PersonalizedSongPageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [copiedType, setCopiedType] = useState<'link' | 'share' | null>(null);
  const [likesCount, setLikesCount] = useState(382);
  const [hasLiked, setHasLiked] = useState(false);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);

  // Google Drive Integration States
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleProfile, setGoogleProfile] = useState<any>(null);
  const [isOauthConfigured, setIsOauthConfigured] = useState<boolean | null>(null);
  const [googleDriveLoading, setGoogleDriveLoading] = useState<boolean>(false);
  const [googleDriveError, setGoogleDriveError] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [savedFileLink, setSavedFileLink] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Decode from URL parameters to construct fully shareable page
  const [songDetails, setSongDetails] = useState({
    recipientName: 'Marta Domingos',
    recipientNick: 'Martinha',
    userNick: 'António',
    musicStyle: 'Kizomba' as MusicStyleType,
    memory: 'O nosso passeio romântico ao final da tarde na Marginal de Luanda.',
    whereItHappened: 'Marginal de Luanda',
    letter: '',
    photoUrl: '',
    songTitle: '',
    lyrics: [] as string[],
    audioUrl: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
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
      try {
        parsedLyrics = JSON.parse(hpLyricsStr);
      } catch (e) {
        console.warn("Could not parse lyrics array parameter", e);
      }
    }

    // Attempt to salvage uploaded image from localStorage if not passed in URL to save bandwidth
    const savedLocalPhoto = localStorage.getItem('seubeat_temp_photo');

    let initialDetails = {
      recipientName: 'Rosa dos Santos',
      recipientNick: 'Minha Rosa',
      userNick: 'Rui',
      musicStyle: 'Kizomba' as MusicStyleType,
      memory: 'O pôr do sol inesquecível na baía do Huambo.',
      whereItHappened: 'Huambo',
      letter: '',
      photoUrl: savedLocalPhoto || '',
      songTitle: '',
      lyrics: [] as string[]
    };

    if (hpRecipientName) {
      initialDetails = {
        recipientName: hpRecipientName,
        recipientNick: hpRecipientNick || 'Meu Amor',
        userNick: hpUserNick || 'Alguém especial',
        musicStyle: (hpMusicStyle as MusicStyleType) || 'Kizomba',
        memory: hpMemory || 'Aquele dia inesquecível em que sorrimos juntos.',
        whereItHappened: hpWhereItHappened || 'Angola',
        letter: hpLetter || '',
        photoUrl: savedLocalPhoto || '',
        songTitle: hpSongTitle || '',
        lyrics: parsedLyrics
      };
      setSongDetails(initialDetails);
    } else {
      // Fallback or read from fallback local storage in case they just completed checkout
      const lastCreatedJSON = localStorage.getItem('seubeat_last_created');
      if (lastCreatedJSON) {
        try {
          const parsed = JSON.parse(lastCreatedJSON);
          initialDetails = {
            recipientName: parsed.recipientName || 'Rosa dos Santos',
            recipientNick: parsed.recipientNick || 'Minha Rosa',
            userNick: parsed.userNick || 'Rui',
            musicStyle: (parsed.musicStyle as MusicStyleType) || 'Kizomba',
            memory: parsed.unforgettableMemory || 'O pôr do sol inesquecível na baía do Huambo.',
            whereItHappened: parsed.whereItHappened || 'Huambo',
            letter: parsed.messageFromTheHeart || '',
            photoUrl: parsed.photoUrl || savedLocalPhoto || '',
            songTitle: parsed.songTitle || '',
            lyrics: parsed.lyrics || []
          };
          setSongDetails(initialDetails);
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Now, if there is a dbSongId, fetch from Supabase to guarantee data consistency
    const dbSongId = params.get('id');
    if (dbSongId) {
      fetch(`/api/song/${dbSongId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
             const dbSong = data.data;
             const dbRequest = dbSong.song_requests;
             const dbUser = dbRequest?.users;
             
             setSongDetails(prev => ({
                ...prev,
                recipientName: dbRequest?.recipient_name || prev.recipientName,
                userNick: dbUser?.name || prev.userNick,
                musicStyle: (dbRequest?.music_style as MusicStyleType) || prev.musicStyle,
                letter: dbSong.letter_text || dbSong.dedication_letter || prev.letter,
                songTitle: dbSong.title || prev.songTitle,
                lyrics: dbSong.lyrics || prev.lyrics,
                audioUrl: dbSong.audio_url || prev.audioUrl,
                photoUrl: dbRequest?.photo_url || prev.photoUrl
              }));
          }
        })
        .catch(err => console.error("Could not fetch song from Supabase:", err));
    }
  }, []);

  // Sync real ElevenLabs audio playback and progress tracking
  useEffect(() => {
    if (isPlaying) {
      if (!liveAudioRef.current) {
        let url = '';
        if (songDetails.audioUrl) {
          url = songDetails.audioUrl;
        } else {
          // Build beautiful text for speech
          const speechText = songDetails.letter || generateLyrics().join(' ') || "Fiz esta canção dedicada com todo o meu amor para ti.";
          const encodedText = encodeURIComponent(speechText.substring(0, 300));
          url = `/api/speech-preview?text=${encodedText}&voiceType=Dueto`;
        }
        liveAudioRef.current = new Audio(url);

        liveAudioRef.current.ontimeupdate = () => {
          if (liveAudioRef.current) {
            const current = liveAudioRef.current.currentTime;
            const duration = liveAudioRef.current.duration || 60;
            const percentage = Math.min((current / duration) * 100, 100);
            setAudioProgress(percentage);
          }
        };

        liveAudioRef.current.onended = () => {
          setIsPlaying(false);
          setAudioProgress(0);
        };
      }

      // Check mute state
      liveAudioRef.current.muted = isMuted;

      liveAudioRef.current.play().catch(err => {
        console.warn("Dedicated page audio playback interrupted:", err);
      });
    } else {
      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
      }
    }
  }, [isPlaying, isMuted, songDetails.letter]);

  // Sync volume with isMuted state
  useEffect(() => {
    if (liveAudioRef.current) {
      liveAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
        liveAudioRef.current = null;
      }
    };
  }, []);

  // Check Google OAuth backend status on mount
  useEffect(() => {
    fetch('/api/auth/google/status')
      .then(res => res.json())
      .then(data => {
        setIsOauthConfigured(data.configured);
        if (!data.configured) {
          setIsDemoMode(true);
        }
      })
      .catch(err => {
        console.error("Erro ao verificar Google OAuth status:", err);
        setIsOauthConfigured(false);
        setIsDemoMode(true);
      });
  }, []);

  // Listen for callback popups postMessage
  useEffect(() => {
    const handleGoogleAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const isTrusted = origin.endsWith('.run.app') || origin.includes('localhost') || origin.includes('127.0.0.1');
      if (!isTrusted) return;

      if (event.data?.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
        const { accessToken, profile } = event.data;
        setGoogleToken(accessToken);
        setGoogleProfile(profile);
        setGoogleDriveError(null);
        setIsDemoMode(false);
        fetchDriveFiles(accessToken);
      }
    };
    window.addEventListener('message', handleGoogleAuthMessage);
    return () => window.removeEventListener('message', handleGoogleAuthMessage);
  }, []);

  const fetchDriveFiles = async (token: string) => {
    setGoogleDriveLoading(true);
    setGoogleDriveError(null);
    try {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name contains 'SeuBeat' and trashed = false&fields=files(id, name, webViewLink, createdTime)&orderBy=createdTime desc`;
      const res = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      } else {
        throw new Error(`Erro na API Google Drive: ${res.statusText}`);
      }
    } catch (err: any) {
      console.error("Falha ao recolher ficheiros do Drive:", err);
      setGoogleDriveError(err.message || "Erro de ligação ao recolher.");
    } finally {
      setGoogleDriveLoading(false);
    }
  };

  const startGoogleOAuth = async () => {
    setGoogleDriveLoading(true);
    setGoogleDriveError(null);
    
    if (isDemoMode && !isOauthConfigured) {
      const useMock = window.confirm(
        "O cliente Google OAuth (OAUTH_CLIENT_ID) não está configurado. Deseja iniciar o MODO SIMULADO DE DEMONSTRAÇÃO SeuBeat para testar localmente?"
      );
      if (useMock) {
        setGoogleProfile({
          name: "Desenvolvedor SeuBeat",
          email: "demo@seubeat.com",
          picture: ""
        });
        setGoogleToken("demo-token-12345");
        setDriveFiles([
          {
            id: 'demo-1',
            name: `SeuBeat_Cancao_de_Martinha_Demo.txt`,
            webViewLink: 'https://drive.google.com',
            createdTime: new Date().toISOString()
          }
        ]);
        setGoogleDriveLoading(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/auth/google/url');
      if (!res.ok) {
        throw new Error("Não foi possível alcançar o URL de autorização.");
      }
      const data = await res.json();
      
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        data.url,
        'seubeat_google_drive_oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );

      if (!authWindow) {
        throw new Error("O popup foi bloqueado pelo seu browser. Por favor, permita popups para este site.");
      }
    } catch (err: any) {
      console.error("Erro ao iniciar login Google OAuth:", err);
      setGoogleDriveError(err.message || "Não foi possível iniciar o popup de autenticação.");
    } finally {
      setGoogleDriveLoading(false);
    }
  };

  const handleDisconnectDrive = () => {
    setGoogleToken(null);
    setGoogleProfile(null);
    setDriveFiles([]);
    setSavedFileLink(null);
  };

  const handleSaveToGoogleDrive = async () => {
    const confirmed = window.confirm(
      `Deseja guardar uma cópia poética completa de "${songDetails.songTitle || `Canção de ${songDetails.recipientName}`}" no seu Google Drive pessoal?`
    );
    if (!confirmed) return;

    setGoogleDriveLoading(true);
    setGoogleDriveError(null);
    setSavedFileLink(null);

    if (isDemoMode || !isOauthConfigured) {
      setTimeout(() => {
        const mockId = `mock-file-${Math.random().toString(36).substring(4)}`;
        const mockFile = {
          id: mockId,
          name: `SeuBeat_Cancao_de_${songDetails.recipientName.replace(/\s+/g, '_')}.txt`,
          webViewLink: 'https://drive.google.com',
          createdTime: new Date().toISOString()
        };
        setDriveFiles(prev => [mockFile, ...prev]);
        setSavedFileLink('https://drive.google.com');
        setGoogleDriveLoading(false);
      }, 1000);
      return;
    }

    if (!googleToken) {
      setGoogleDriveError("Necessita de se conectar autonomamente primeiro.");
      setGoogleDriveLoading(false);
      return;
    }

    try {
      let folderId = '';
      const folderSearchUrl = `https://www.googleapis.com/drive/v3/files?q=name='SeuBeat - Canções d'Amor' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
      const folderSearchRes = await fetch(folderSearchUrl, {
        headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      if (folderSearchRes.ok) {
        const folderSearchData = await folderSearchRes.json();
        if (folderSearchData.files && folderSearchData.files.length > 0) {
          folderId = folderSearchData.files[0].id;
        }
      }

      if (!folderId) {
        const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: "SeuBeat - Canções d'Amor",
            mimeType: "application/vnd.google-apps.folder"
          })
        });
        if (createFolderRes.ok) {
          const newFolderData = await createFolderRes.json();
          folderId = newFolderData.id;
        }
      }

      const lyricsLines = generateLyrics();
      const fileContent = `================================================
DEDICATÓRIA DE AMOR SEUBEAT
Música: ${songDetails.songTitle || `Canção de ${songDetails.recipientName}`}
Género: ${songDetails.musicStyle}
Autor: ${songDetails.userNick}
Para: ${songDetails.recipientName} (${songDetails.recipientNick})
Criado em: ${new Date().toLocaleString('pt-AO')}
================================================

LETRA COMPLETA DA CANÇÃO:
------------------------------------------------
${lyricsLines.map((line) => `[Letra] ${line}`).join('\n')}

------------------------------------------------
CARTA ESCRITA DO CORAÇÃO:
------------------------------------------------
${getFullComposedLetter()}

------------------------------------------------
Criado com ❤️ no estúdio SeuBeat (teusom.com)
Angola ${(new Date().getFullYear())}
Ouve a canção online: ${getShareUrl()}
================================================`;

      const boundary = 'seubeat_multipart_boundary';
      const metadata = {
        name: `SeuBeat_Cancao_de_${songDetails.recipientName.replace(/\s+/g, '_')}.txt`,
        mimeType: 'text/plain',
        ...(folderId ? { parents: [folderId] } : {})
      };

      const multipartBody = 
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
        fileContent +
        `\r\n--${boundary}--`;

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload falhou: ${uploadRes.statusText}`);
      }

      const uploadedFile = await uploadRes.json();
      setSavedFileLink(uploadedFile.webViewLink);
      fetchDriveFiles(googleToken);

    } catch (err: any) {
      console.error("Erro ao guardar no Google Drive:", err);
      setGoogleDriveError(err.message || 'Erro ao comunicar com o Google Drive.');
    } finally {
      setGoogleDriveLoading(false);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleLike = () => {
    if (hasLiked) {
      setLikesCount(prev => prev - 1);
      setHasLiked(false);
    } else {
      setLikesCount(prev => prev + 1);
      setHasLiked(true);
    }
  };

  // Dynamic lyric line sheets generated on-the-fly based on selected parameters
  const generateLyrics = () => {
    if (songDetails.lyrics && songDetails.lyrics.length > 0) {
      return songDetails.lyrics;
    }
    const { recipientName, recipientNick, userNick, musicStyle, memory, whereItHappened } = songDetails;
    
    return [
      `Desde o dia em que te conheci, minha querida ${recipientNick},`,
      `O meu peito rebate no compasso de um ritmo profundo.`,
      `Estávamos juntos em ${whereItHappened || 'Angola'}, recordas-te meu bem?`,
      `Aquele momento: ${memory || 'em que trocámos o nosso primeiro olhar sincero'}.`,
      `O teu sorriso brilha mais que o luar na baía,`,
      `Com o teu amor aqueces o meu peito de harmonia e alegria.`,
      `Ao som deste ${musicStyle || 'Semba'}, declaro-te toda a minha afeição,`,
      `És a eterna comandante do meu fiel coração.`,
      `Prometo amar-te todos os dias, com alma e dignidade,`,
      `Do teu companheiro dedicado de verdade: ${userNick}.`
    ];
  };

  const getFullComposedLetter = () => {
    const { recipientName, recipientNick, userNick, memory, whereItHappened, letter } = songDetails;
    if (letter) return letter;

    return `Minha querida ${recipientName} (${recipientNick}),\n\nEscrevo estas palavras com o coração totalmente aberto e transbordando de carinho. Há momentos na vida que ficam gravados para sempre na alma, e um deles é, sem dúvida, ${memory || 'tudo o que partilhámos juntos'} que aconteceu em ${whereItHappened || 'Angola'}.\n\nQuero que saibas que o teu sorriso ilumina os meus dias mais cinzentos e que a tua presença traz uma paz inigualável. Criar esta canção personalizada no estúdio SeuBeat foi a forma mais profunda e sincera que encontrei de eternizar o nosso companheirismo e declarar o meu carinho inabalável por ti.\n\nCom todo o amor do mundo,\n${userNick}`;
  };

  // MP3 simulation helper
  const handleDownloadMP3 = () => {
    if (songDetails.audioUrl) {
      const element = document.createElement("a");
      element.href = songDetails.audioUrl;
      element.target = "_blank";
      element.download = `${songDetails.recipientName.replace(/\s+/g, '_')}_SeuBeat_Completa.mp3`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      const element = document.createElement("a");
      const file = new Blob([
        "ID3v2.3.0\nTIT2:SeuBeat Song\nTPE1:SeuBeat Estúdio\n\n[MOCK AUDIO DATA BINARY STREAM FOR PREMIUM MP3 AUDIO GENERATION]"
      ], { type: 'audio/mp3' });
      element.href = URL.createObjectURL(file);
      element.download = `${songDetails.recipientName.replace(/\s+/g, '_')}_SeuBeat_Completa.mp3`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  // PDF Lyrics simulator (plain text export formatted beautifully)
  const handleDownloadLyrics = () => {
    const lyricsLines = generateLyrics();
    const fullText = `================================================
DEDICATÓRIA DE AMOR SEUBEAT
Música: ${songDetails.recipientName} (Canção de Amor)
Género: ${songDetails.musicStyle}
Autor: ${songDetails.userNick}
Para: ${songDetails.recipientName} (${songDetails.recipientNick})
================================================

LETRA COMPLETA DA CANÇÃO:
${lyricsLines.map((line, idx) => `[0:${(idx * 18).toString().padStart(2, '0')}] ${line}`).join('\n')}

------------------------------------------------
CARTA ESCRITA DO CORAÇÃO:
${getFullComposedLetter()}

------------------------------------------------
Criado com ❤️ no estúdio SeuBeat (teusom.com)
Angola ${(new Date().getFullYear())}
================================================`;

    const element = document.createElement("a");
    const file = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Letra_SeuBeat_${songDetails.recipientName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Generate URL for sharing
  const getShareUrl = () => {
    const params = new URLSearchParams();
    params.set('recipientName', songDetails.recipientName);
    params.set('recipientNick', songDetails.recipientNick);
    params.set('userNick', songDetails.userNick);
    params.set('musicStyle', songDetails.musicStyle);
    params.set('memory', songDetails.memory);
    params.set('whereItHappened', songDetails.whereItHappened);
    params.set('letter', getFullComposedLetter());
    
    return `${window.location.origin}/song/${encodeURIComponent(
      songDetails.recipientName.toLowerCase().replace(/\s+/g, '-')
    )}?${params.toString()}`;
  };

  const copyToClipboard = (type: 'link' | 'share') => {
    const shareUrl = getShareUrl();
    navigator.clipboard.writeText(shareUrl);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleWhatsAppShare = () => {
    const shareUrl = getShareUrl();
    const text = `Olha a surpresa linda que o(a) ${songDetails.userNick} criou para a ${songDetails.recipientName}! Uma música personalizada real! Ouve aqui: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCustomPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      // Save visually
      setSongDetails(prev => ({ ...prev, photoUrl: url }));
      // Also write base64 template to persist locally on reload
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          localStorage.setItem('seubeat_temp_photo', reader.result);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[#090807] text-stone-100 flex flex-col justify-between selection:bg-amber-500/20 selection:text-amber-300 relative overflow-hidden">
      {/* Visual background glows */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] bg-rose-500/5 rounded-full filter blur-[130px] pointer-events-none" />

      {/* Decorative starry patterns */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Header element */}
      <header className="border-b border-stone-900 bg-stone-950/80 backdrop-blur sticky top-0 z-40 px-4 md:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 text-stone-400 hover:text-stone-100 text-xs font-mono transition-colors font-semibold group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>CRIA UMA PÁGINA ASSIM</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest font-bold">PÁGINA DEDICADA EXCLUSIVA</span>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-10 md:py-16 flex-grow flex flex-col justify-center space-y-12 relative z-10">
        
        {/* Intro Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xxs font-mono uppercase tracking-widest font-bold animate-[pulse_2s_infinite]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Uma surpresa feita com a alma</span>
          </div>
          <h1 className="font-serif text-4xl md:text-6xl text-white font-black tracking-tight max-w-3xl mx-auto leading-none">
            {songDetails.songTitle || `Música de ${songDetails.recipientName}`} 💝
          </h1>
          <p className="text-xs md:text-sm text-stone-400 font-mono tracking-wide uppercase">
            Criada poéticamente no estilo <span className="text-amber-400 font-bold">{songDetails.musicStyle}</span> por <span className="text-rose-400 font-bold">{songDetails.userNick}</span>
          </p>
        </div>

        {/* Unified Music Player & Custom Vinyl layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* COLUMN L: Vinyl Spin Artwork */}
          <div className="lg:col-span-5 bg-gradient-to-b from-stone-900/50 to-stone-950/80 rounded-[32px] p-6 border border-stone-850/60 flex flex-col justify-between items-center text-center space-y-8 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500 opacity-20" />
            
            {/* Spinning disk container */}
            <div className="relative w-56 h-56 md:w-64 md:h-64 flex items-center justify-center">
              {/* Outer pulsing ring */}
              <AnimatePresence>
                {isPlaying && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 0.15, scale: 1.15 }}
                    exit={{ opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                    className="absolute inset-0 bg-amber-500 rounded-full"
                  />
                )}
              </AnimatePresence>

              {/* Vinyl disk */}
              <motion.div 
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ repeat: Infinity, ease: "linear", duration: 8 }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,#121110_0%,#1a1918_30%,#090909_100%)] rounded-full border-8 border-stone-950 flex items-center justify-center shadow-2xl relative"
              >
                {/* Grooves */}
                <div className="absolute inset-6 rounded-full border border-stone-900/40" />
                <div className="absolute inset-12 rounded-full border border-stone-900/60" />
                <div className="absolute inset-20 rounded-full border border-stone-900/25" />

                {/* Disc core Sticker / couple photo uploader */}
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-rose-950 to-amber-950 overflow-hidden flex items-center justify-center relative border border-stone-800 shadow-inner group">
                  {songDetails.photoUrl ? (
                    <img 
                      src={songDetails.photoUrl} 
                      alt="Dedicatoria casal" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center p-3 text-stone-500 group-hover:text-amber-400 cursor-pointer flex flex-col items-center gap-1">
                      <ImageIcon className="w-5 h-5 mx-auto" />
                      <span className="text-[8px] font-mono font-semibold uppercase leading-none">Foto Casal</span>
                    </div>
                  )}

                  {/* Absolute Center Spindle Hole */}
                  <div className="absolute inset-0 m-auto w-3 h-3 bg-[#090807] rounded-full border border-stone-900 flex items-center justify-center" />

                  {/* Hover Uploader Overlay */}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-stone-300">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span className="text-[8px] font-mono uppercase mt-1">Sua Foto</span>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleCustomPhoto}
                    />
                  </label>
                </div>
              </motion.div>
            </div>

            {/* Subtitle description */}
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono rounded-full uppercase tracking-widest font-extrabold inline-block">
                Completa • Qualidade HD (MP3)
              </span>
              <h3 className="font-serif text-xl font-bold text-stone-100">
                {songDetails.songTitle || `A canção de ${songDetails.recipientName}`}
              </h3>
              <p className="text-xs text-stone-500 font-mono tracking-tight leading-relaxed max-w-xs mx-auto">
                Eternizando rimas sinceras sobre {songDetails.recipientNick} em {songDetails.whereItHappened || 'Angola'}.
              </p>
            </div>

            {/* Likes heart controller */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLike}
                className={`py-2 px-4 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  hasLiked 
                    ? 'bg-rose-500/10 border-rose-500 text-rose-400 ring-2 ring-rose-500/10' 
                    : 'bg-stone-950/60 border-stone-850 text-stone-500 hover:text-stone-300'
                }`}
              >
                <Heart className={`w-4 h-4 ${hasLiked ? 'fill-rose-500' : ''}`} />
                <span className="text-xs font-mono font-bold">{likesCount} Gosto</span>
              </button>
            </div>
          </div>

          {/* COLUMN R: The Audio Controller Player & Live lyrics */}
          <div className="lg:col-span-7 bg-stone-900/15 rounded-[32px] p-6 md:p-8 border border-stone-850/60 flex flex-col justify-between space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full filter blur-[50px]" />
            
            {/* Player interface box */}
            <div className="bg-stone-950 rounded-2xl p-5 md:p-6 border border-stone-850/80 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-stone-500 font-mono uppercase tracking-widest">AUDIO PLAYER INTEGRADO</span>
                <span className="text-[10px] text-rose-500 font-mono tracking-widest uppercase font-bold flex items-center gap-1.5 p-1 bg-rose-500/5 rounded border border-rose-500/10">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" /> FULL SONG COMPACT
                </span>
              </div>

              {/* Dynamic waveform visualizer lines */}
              <div className="h-14 flex items-end gap-1.5 px-3 pt-3">
                {Array.from({ length: 40 }).map((_, idx) => {
                  const activeStep = Math.floor((audioProgress / 100) * 40);
                  const isPast = idx < activeStep;
                  const isActive = idx === activeStep;
                  
                  // create nice structured wave shape heights
                  const height = [20, 35, 12, 45, 60, 20, 75, 40, 50, 65, 15, 42, 55, 30, 65, 45, 25, 55, 70, 40, 80, 22, 50, 60, 30, 68, 48, 20, 38, 55, 12, 35, 45, 20, 58, 38, 14, 25, 42, 55][idx];
                  
                  return (
                    <div 
                      key={idx}
                      style={{ height: `${height}%` }}
                      className={`w-full rounded-sm transition-all duration-300 ${
                        isActive 
                          ? 'bg-gradient-to-t from-amber-500 to-rose-500 animate-[pulse_0.8s_infinite]'
                          : isPast 
                          ? 'bg-gradient-to-t from-amber-500/80 to-rose-500/80' 
                          : 'bg-stone-900'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Simulated timeline counters */}
              <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono px-1">
                <span>
                  {Math.floor((audioProgress / 100) * 185 / 60)}:
                  {String(Math.floor((audioProgress / 100) * 185 % 60)).padStart(2, '0')}
                </span>
                <span className="text-amber-400 font-medium">Ficheiro Completo Desbloqueado</span>
                <span>3:05</span>
              </div>

              {/* Main Button layout */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="flex-grow py-3.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-stone-950 font-black text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer active:scale-99 transition-transform"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-stone-950 text-stone-950" />
                      <span>PAUSAR MÚSICA</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-stone-950 text-stone-950" />
                      <span>REPRODUZIR MÚSICA COMPLETA</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-3 bg-stone-900 hover:bg-stone-850 hover:text-white rounded-xl border border-stone-850 text-stone-400 cursor-pointer transition-colors"
                  title="Silenciar"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Syncing emotional lyrics display */}
            <div className="bg-stone-950/40 p-5 rounded-2xl border border-stone-850 text-center space-y-3">
              <span className="text-[9px] font-mono text-stone-550 tracking-widest uppercase block border-b border-stone-900 pb-1.5">LETRA COMPLICADA SÍNCRONA:</span>
              <div className="max-h-[140px] overflow-y-auto space-y-2 py-1 scrollbar-thin">
                {generateLyrics().map((line, idx) => {
                  const lyricCount = generateLyrics().length;
                  const currentLyricIndex = Math.min(
                    Math.floor((audioProgress / 100) * lyricCount),
                    lyricCount - 1
                  );
                  const isCurrent = idx === currentLyricIndex;
                  const isPast = idx < currentLyricIndex;

                  return (
                    <p 
                      key={idx}
                      className={`text-xs md:text-sm font-serif transition-all duration-300 ${
                        isCurrent 
                          ? 'text-amber-400 font-bold scale-102 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.15)]' 
                          : isPast 
                          ? 'text-stone-500 font-light line-through decoration-stone-800' 
                          : 'text-stone-300'
                      }`}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* Google Drive Integration Panel */}
            <div className="bg-stone-950 p-4 md:p-5 rounded-2xl border border-stone-850 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-mono font-bold text-stone-300">GOOGLE DRIVE CLOUD WORKSPACE</span>
                </div>
                {isDemoMode && (
                  <span className="text-[9px] font-mono font-extrabold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Modo Simulado
                  </span>
                )}
              </div>

              {!googleToken ? (
                <div className="space-y-3 text-left">
                  <p className="text-xxs md:text-xs text-stone-400 font-sans leading-relaxed">
                    Sincronize a sua conta Google para guardar com total segurança as letras, rimas, e detalhes da sua carta romântica exclusiva numa pasta dedicada no seu Drive.
                  </p>
                  
                  {isOauthConfigured === false && (
                    <div className="bg-stone-900/60 border border-stone-850 p-3 rounded-lg flex items-start gap-2 text-left">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 block font-mono">CONFIGURAÇÃO DE ACESSO NECESSÁRIA:</span>
                        <p className="text-[9.5px] text-stone-400 leading-relaxed">
                          O cliente OAuth real não está inicializado nos ambientes do AI Studio (Defina <code className="font-mono bg-stone-950 px-1 py-0.5 text-xs text-amber-500 font-bold">OAUTH_CLIENT_ID</code> nas Configurações). Poderá testar o fluxo ativando a simulação interativa no botão abaixo.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={startGoogleOAuth}
                    disabled={googleDriveLoading}
                    className="w-full py-2.5 bg-stone-900 hover:bg-stone-850 text-amber-400 border border-stone-800 hover:border-amber-500/30 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {googleDriveLoading ? (
                      <span className="inline-block animate-spin border-2 border-amber-500 border-t-transparent w-3 h-3 rounded-full mr-1" />
                    ) : (
                      <Cloud className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>CONECTAR GOOGLE DRIVE</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  {/* Connected profile badge */}
                  <div className="flex items-center justify-between bg-stone-900/55 p-2 rounded-xl border border-stone-850">
                    <div className="flex items-center gap-2">
                      {googleProfile?.picture ? (
                        <img 
                          src={googleProfile.picture} 
                          alt="Avatar" 
                          className="w-7 h-7 rounded-full border border-stone-800"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center font-bold text-amber-400 font-mono text-xs">
                          {googleProfile?.name?.charAt(0) || 'C'}
                        </div>
                      )}
                      <div className="text-left leading-tight">
                        <span className="text-[11px] font-bold block text-stone-200">{googleProfile?.name || 'Compositor'}</span>
                        <span className="text-[9px] text-stone-500 block font-mono">{googleProfile?.email || 'drive@seubeat.com'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      className="p-1 px-2 border border-stone-800 hover:border-red-500/30 text-stone-500 hover:text-red-400 rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      title="Sair do Google Drive"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Sair</span>
                    </button>
                  </div>

                  {/* Actions inside Drive */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleSaveToGoogleDrive}
                      disabled={googleDriveLoading}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-amber-500/10"
                    >
                      {googleDriveLoading ? (
                        <span className="inline-block animate-spin border-2 border-stone-950 border-t-transparent w-3.5 h-3.5 rounded-full mr-1" />
                      ) : (
                        <Cloud className="w-4 h-4 fill-stone-950" />
                      )}
                      <span>GUARDAR CÓPIA COMPLETA NO GOOGLE DRIVE</span>
                    </button>

                    {savedFileLink && (
                      <a
                        href={savedFileLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xxs font-mono rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-emerald-500/15"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>VER FICHEIRO GRAVADO NO DRIVE</span>
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                      </a>
                    )}
                  </div>

                  {googleDriveError && (
                    <div className="p-2 border border-rose-950 bg-rose-950/20 text-red-400 text-[10px] rounded-lg text-left">
                      <strong>Erro:</strong> {googleDriveError}
                    </div>
                  )}

                  {/* List previously saved files */}
                  <div className="space-y-2 pt-2 border-t border-stone-900/60">
                    <div className="flex items-center gap-1 text-[10px] text-stone-400 font-mono font-bold uppercase tracking-wider">
                      <FolderOpen className="w-3 h-3 text-amber-500" />
                      <span>Ficheiros Guardados em "SeuBeat - Canções d'Amor":</span>
                    </div>

                    {driveFiles.length === 0 ? (
                      <p className="text-[10px] text-stone-600 font-mono italic">
                        Nenhum ficheiro detetado nesta pasta ainda. Carregue no botão superior para guardar!
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-[100px] overflow-y-auto scrollbar-thin">
                        {driveFiles.map((file: any) => (
                          <div 
                            key={file.id} 
                            className="flex items-center justify-between p-1.5 bg-stone-950 rounded border border-stone-900 text-left text-[10px] hover:border-stone-800 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                              <FileText className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              <span className="text-stone-300 font-medium truncate font-mono">{file.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-stone-600 font-mono">
                                {new Date(file.createdTime).toLocaleDateString('pt-AO')}
                              </span>
                              <a 
                                href={file.webViewLink} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-amber-500 hover:text-amber-400 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Downloads column buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadMP3}
                className="py-3 px-4 bg-stone-900 hover:bg-stone-850 text-stone-200 hover:text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-stone-800 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Descarregar Áudio (MP3)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadLyrics}
                className="py-3 px-4 bg-stone-900 hover:bg-stone-850 text-stone-200 hover:text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-stone-800 cursor-pointer transition-all"
              >
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Descarregar Letra (PDF/Texto)</span>
              </button>
            </div>

          </div>
        </div>

        {/* The beautiful handwritten romantic letter display */}
        <div className="bg-gradient-to-b from-stone-900/30 to-stone-950/80 rounded-[32px] p-6 md:p-10 border border-stone-850/60 space-y-6 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full filter blur-[50px]" />
          
          <div className="border-b border-stone-850/60 pb-4">
            <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold">A Carta Dedicatória Escrita do Coração</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-stone-100 mt-1">Palavras De Sentimento Verdadeiro ✍️</h2>
          </div>

          <div className="bg-stone-950 p-6 md:p-8 rounded-2xl border border-stone-850 font-serif text-sm md:text-base leading-relaxed text-stone-300 max-w-3xl whitespace-pre-wrap italic">
            {getFullComposedLetter()}
          </div>
        </div>

        {/* Sharing options layout */}
        <div className="bg-stone-900/10 rounded-[32px] p-6 md:p-8 border border-stone-850/60 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="font-serif text-xl font-bold text-stone-100">Partilhe esta página de Dedicatória Especial 💍</h3>
            <p className="text-xs text-stone-400">
              Copie o link individual da página ou envie diretamente no WhatsApp para que o destinatário ouça a sua composição com todo o romance merecido.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-xl mx-auto">
            {/* WhatsApp Share */}
            <button
              onClick={handleWhatsAppShare}
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors uppercase tracking-wider"
            >
              <MessageCircle className="w-4 h-4 fill-stone-950 text-stone-950" />
              <span>Enviar no WhatsApp</span>
            </button>

            {/* Copy link */}
            <button
              onClick={() => copyToClipboard('link')}
              className="w-full sm:w-auto px-6 py-3.5 bg-stone-900 hover:bg-stone-850 text-stone-100 font-bold text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 border border-stone-800 cursor-pointer transition-colors uppercase tracking-wider"
            >
              {copiedType === 'link' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Link Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-amber-500" />
                  <span>Copiar Link Dedicatória</span>
                </>
              )}
            </button>
          </div>
        </div>

      </main>

      {/* Aesthetic micro footer element */}
      <footer className="border-t border-stone-900 py-8 text-center bg-stone-950 text-stone-550 text-xxs font-mono">
        <p>© {new Date().getFullYear()} SeuBeat Estúdio Angola • Todos os direitos reservados.</p>
        <p className="mt-1 pb-4">Conectando memórias angolanas a melodias de estúdio profissionais.</p>
      </footer>
    </div>
  );
}
