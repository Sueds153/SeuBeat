import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Heart, Share2, 
  Download, ArrowLeft, Sparkles, Check,
  FileText, Upload, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MusicStyleType } from '../types';

interface PersonalizedSongPageProps {
  onBackToLanding: () => void;
}

export default function PersonalizedSongPage({ onBackToLanding }: PersonalizedSongPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [copiedType, setCopiedType] = useState<'link' | 'share' | null>(null);
  const [likesCount, setLikesCount] = useState(382);
  const [hasLiked, setHasLiked] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);

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
      lyrics: [] as string[],
      audioUrl: ''
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
        lyrics: parsedLyrics,
        audioUrl: ''
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
            lyrics: parsed.lyrics || [],
            audioUrl: ''
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
        .then(res => {
          if (res.status === 404) { setNotFound(true); throw new Error('Not found'); }
          return res.json();
        })
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
        .catch(err => {
          if (!notFound) setFetchError(true);
          console.error("Could not fetch song from Supabase:", err);
        })
        .finally(() => setIsLoading(false));
    } else {
      // Try to find last created song in localStorage as fallback
      const fallbackId = localStorage.getItem('seubeat_last_song_id');
      if (fallbackId) {
        fetch(`/api/song/${fallbackId}`)
          .then(res => {
            if (res.status === 404) { setNotFound(true); return null; }
            return res.json();
          })
          .then(data => {
            if (data && data.success && data.data) {
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
                photoUrl: dbRequest?.photo_url || prev.photoUrl
              }));
            }
          })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  // Sync real Suno audio playback and progress tracking
  useEffect(() => {
    return () => {
      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
        liveAudioRef.current = null;
      }
    };
  }, [songDetails.audioUrl]);

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

  // MP3 download helper
  const handleDownloadMP3 = () => {
    if (!songDetails.audioUrl) return;
    const element = document.createElement("a");
    element.href = songDetails.audioUrl;
    element.target = "_blank";
    element.download = `${songDetails.recipientName.replace(/\s+/g, '_')}_SeuBeat_Completa.mp3`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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
    URL.revokeObjectURL(element.href);
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

  const handleCustomPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (songDetails.photoUrl?.startsWith('blob:')) URL.revokeObjectURL(songDetails.photoUrl);
      const url = URL.createObjectURL(file);
      setSongDetails(prev => ({ ...prev, photoUrl: url }));
      // Also write base64 template to persist locally on reload
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          localStorage.setItem('seubeat_temp_photo', reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090807] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-400 font-mono">A carregar a tua dedicatória...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#090807] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
            <span className="text-3xl">🎵</span>
          </div>
          <h1 className="font-serif text-2xl text-stone-100 font-bold">Música não encontrada</h1>
          <p className="text-stone-400 text-sm">
            O link que abriste não é válido ou a música foi removida.
          </p>
          <a href="/" className="inline-block px-6 py-2 bg-amber-500 text-stone-950 rounded-xl font-bold text-sm hover:bg-amber-400">
            Criar a minha música
          </a>
        </div>
      </div>
    );
  }

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

      {fetchError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 md:px-8 py-3">
          <p className="text-xs text-amber-400 text-center max-w-6xl mx-auto">
            Não foi possível carregar os dados mais recentes. A página pode mostrar informações limitadas.
          </p>
        </div>
      )}

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
                  className="flex-grow py-3.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-stone-950 font-black text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer active:scale-[0.99] transition-transform"
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

            {/* Downloads column buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadMP3}
                disabled={!songDetails.audioUrl}
                className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 border text-xs font-semibold transition-all ${
                  songDetails.audioUrl
                    ? 'bg-stone-900 hover:bg-stone-850 text-stone-200 hover:text-white border-stone-800 cursor-pointer'
                    : 'bg-stone-950 text-stone-600 border-stone-900 cursor-not-allowed'
                }`}
              >
                <Download className={`w-4 h-4 ${songDetails.audioUrl ? 'text-emerald-400' : 'text-stone-700'}`} />
                <span>{songDetails.audioUrl ? 'Descarregar Áudio (MP3)' : 'Áudio em processamento...'}</span>
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
              Copie o link individual da página para que o destinatário ouça a sua composição com todo o romance merecido.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-xl mx-auto">
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
