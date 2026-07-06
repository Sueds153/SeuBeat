import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Heart, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import LogoIcon from './LogoIcon';
import { DEMO_SONGS } from '../constants/demoSongs';
import type { DemoSong } from '../constants/demoSongs';

export default function AudioDemo() {
  const [selectedSong, setSelectedSong] = useState<DemoSong>(DEMO_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lyricIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop and clean up audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (lyricIntervalRef.current) {
      clearInterval(lyricIntervalRef.current);
      lyricIntervalRef.current = null;
    }
    setProgress(0);
    setCurrentLyricIndex(0);
  };

  // Play selected song
  const playSong = async (song: DemoSong) => {
    stopAudio();
    if (!song.audioUrl) return;

    const audio = new Audio(song.audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (isMuted) audio.muted = true;
      audio.play().catch(() => setIsPlaying(false));
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentLyricIndex(0);
      setProgress(100);
    };

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    setCurrentLyricIndex(0);
    setIsPlaying(true);

    // Cycle lyrics while playing
    lyricIntervalRef.current = setInterval(() => {
      setCurrentLyricIndex((prev) => {
        const next = prev + 1;
        return next >= song.lyrics.length ? 0 : next;
      });
    }, 4000);
  };

  // Pause current audio
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle play/pause toggle
  const handlePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      if (!audioRef.current) {
        playSong(selectedSong);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  // Handle song selection
  const selectSong = (song: DemoSong) => {
    stopAudio();
    setSelectedSong(song);
    setIsPlaying(false);
  };

  // Cleanup on unmount or song change
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  return (
    <div id="audio-demo-section" className="bg-gradient-to-br from-stone-900/40 to-amber-950/20 rounded-3xl p-6 md:p-10 border border-amber-900/20 shadow-2xl backdrop-blur-md relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        <div className="lg:col-span-5 space-y-6">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Experimente Ouvir</span>
            </div>
            <h3 className="font-serif text-3xl md:text-4xl text-stone-100 tracking-tight leading-tight">
              Sinta a emoção de uma música <span className="text-amber-400 font-semibold italic inline-flex items-center gap-1"><LogoIcon size={20} /> SeuBeat</span>
            </h3>
            <p className="text-stone-400 text-sm mt-3 leading-relaxed">
              Diferentes estilos e vozes carregados de sentimentos reais. Clique para ouvir o resultado final de histórias transformadas em canções.
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-stone-950/50 p-1.5 rounded-2xl border border-stone-800">
            {DEMO_SONGS.map((song) => {
              const active = selectedSong.id === song.id;
              return (
                <button
                  id={`song-tab-${song.id}`}
                  key={song.id}
                  onClick={() => selectSong(song)}
                  aria-pressed={active}
                  aria-label={`Selecionar demo ${song.title}`} 
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${
                    active
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-100'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/45'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${active ? 'bg-amber-500/20 text-amber-300' : 'bg-stone-900 text-stone-500'}`}>
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-amber-500/80 mb-0.5">{song.style}</p>
                      <h4 className="text-sm font-medium text-stone-200">{song.title}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="hidden sm:block text-xxs text-stone-500 font-mono">Dedicado a</span>
                    <span className="text-xs font-serif text-amber-400/90">{song.recipient.split(' ')[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col h-full bg-stone-950/80 rounded-2xl border border-amber-900/10 p-5 md:p-6 shadow-xl relative min-h-[380px] justify-between">
          
          <div className="flex items-center justify-between pb-4 border-b border-stone-900">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-tr from-rose-950 to-amber-900 rounded-lg flex items-center justify-center border border-amber-600/30 relative overflow-hidden group">
                <div className="absolute inset-0 bg-stone-950/20 mix-blend-overlay"></div>
                <Music className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-serif text-stone-100 font-medium tracking-wide">
                  {selectedSong.title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-1.5 py-0.5 bg-stone-900 rounded text-[10px] font-mono text-amber-500 uppercase tracking-wider">
                    {selectedSong.style}
                  </span>
                  <span className="text-xs text-stone-400">
                    para {selectedSong.recipient}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              id="like-song-demo-btn"
              aria-label="Favoritar exemplo"
              className="w-9 h-9 rounded-full bg-stone-900 flex items-center justify-center text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition-colors"
              title="Favoritar"
            >
              <Heart className="w-4 h-4" />
            </button>
          </div>

          <div className="my-6 space-y-3 max-h-[160px] overflow-y-auto no-scrollbar py-2 px-1 text-center">
            {selectedSong.lyrics.map((line, idx) => {
              const isActive = idx === currentLyricIndex;
              const isPast = idx < currentLyricIndex;
              return (
                <motion.p
                  key={idx}
                  animate={{
                    scale: isActive ? 1.05 : 1.0,
                    opacity: isActive ? 1 : isPast ? 0.5 : 0.25,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`text-sm md:text-base transition-colors leading-relaxed font-serif ${
                    isActive 
                      ? 'text-amber-400 font-medium filter drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]' 
                      : 'text-stone-300'
                  }`}
                >
                  {line}
                </motion.p>
              );
            })}
          </div>

          <div className="flex items-end justify-center gap-0.5 sm:gap-1.5 h-10 mb-4 px-2 sm:px-10">
            {Array.from({ length: 28 }).map((_, i) => {
              const randomHeight = isPlaying 
                ? [20, 60, 40, 80, 50, 95, 30, 70, 20][(i + i * 3) % 9] 
                : 15;
              return (
                <motion.div
                  key={i}
                  animate={{ height: isPlaying ? `${randomHeight}%` : '15%' }}
                  transition={{
                    repeat: Infinity,
                    repeatType: 'reverse',
                    duration: isPlaying ? 0.4 + (i % 5) * 0.1 : 0.5,
                  }}
                  className={`w-[3px] rounded-full ${
                    i % 3 === 0 
                      ? 'bg-amber-400' 
                      : i % 3 === 1 
                      ? 'bg-rose-500' 
                      : 'bg-amber-600/70'
                  }`}
                />
              );
            })}
          </div>

          <div className="space-y-3 bg-stone-900/80 p-3.5 rounded-xl border border-stone-800">
            <div className="flex items-center gap-3 text-xs text-stone-500 font-mono">
              <span>
                {Math.floor((progress / 100) * 185 / 60)}:
                {String(Math.floor((progress / 100) * 185 % 60)).padStart(2, '0')}
              </span>
              <div id="player-progress-bar-container" className="flex-1 h-1 bg-stone-800 rounded-full overflow-hidden relative cursor-pointer group">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-300 relative" 
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <span>{selectedSong.duration}</span>
            </div>

            <div className="flex items-center justify-between">
              <button
                id="volume-control-demo"
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (audioRef.current) {
                    audioRef.current.muted = !isMuted;
                  }
                }}
                aria-pressed={isMuted}
                aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                title={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
              </button>

              <button
                id="toggle-demo-play-btn"
                onClick={handlePlayPause}
                aria-pressed={isPlaying}
                aria-label={isPlaying ? 'Pausar reprodução' : 'Reproduzir demo'}
                className="w-11 h-11 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-450 rounded-full flex items-center justify-center text-stone-950 focus:outline-none shadow-lg transform active:scale-95 transition-all text-center self-center"
              >
                {isPlaying ? (
                  <Pause className="w-5.5 h-5.5 fill-current" />
                ) : (
                  <Play className="w-5.5 h-5.5 fill-current ml-1" />
                )}
              </button>

              <div className="text-[10px] text-amber-500 font-mono tracking-wider flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded whitespace-nowrap">
                <span className="hidden sm:inline w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                <span>EXEMPLO REAL</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}