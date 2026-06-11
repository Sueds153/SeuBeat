import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Heart, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { DEMO_SONGS, DemoSong } from '../types';

export default function AudioDemo() {
  const [selectedSong, setSelectedSong] = useState<DemoSong>(DEMO_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35); // Initial placeholder progress
  const [isMuted, setIsMuted] = useState(false);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(2);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto progression mock when playing
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 35; // Reset to start style
          }
          const nextProg = prev + 1;
          // Calculate active lyric based on progress
          const lyricCount = selectedSong.lyrics.length;
          const index = Math.min(
            Math.floor((nextProg / 100) * lyricCount),
            lyricCount - 1
          );
          setCurrentLyricIndex(index);
          return nextProg;
        });
      }, 350); // advance mock progress
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, selectedSong]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const selectSong = (song: DemoSong) => {
    setSelectedSong(song);
    setIsPlaying(false);
    setProgress(0);
    setCurrentLyricIndex(0);
  };

  return (
    <div id="audio-demo-section" className="bg-gradient-to-br from-stone-900/40 to-amber-950/20 rounded-3xl p-6 md:p-10 border border-amber-900/20 shadow-2xl backdrop-blur-md relative overflow-hidden">
      {/* Decorative ambient gold glow in background */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left Column: Song selector & visual player card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Experimente Ouvir</span>
            </div>
            <h3 className="font-serif text-3xl md:text-4xl text-stone-100 tracking-tight leading-tight">
              Sinta a emoção de uma música <span className="text-amber-400 font-semibold italic">SeuBeat</span>
            </h3>
            <p className="text-stone-400 text-sm mt-3 leading-relaxed">
              Diferentes estilos e vozes carregados de sentimentos reais. Clique para ouvir o resultado final de histórias transformadas em canções.
            </p>
          </div>

          {/* Quick tab switchers */}
          <div className="flex flex-col gap-2 bg-stone-950/50 p-1.5 rounded-2xl border border-stone-800">
            {DEMO_SONGS.map((song) => {
              const active = selectedSong.id === song.id;
              return (
                <button
                  id={`song-tab-${song.id}`}
                  key={song.id}
                  onClick={() => selectSong(song)}
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
                    <span className="text-xxs text-stone-500 block font-mono">Dedicado a</span>
                    <span className="text-xs font-serif text-amber-400/90">{song.recipient.split(' ')[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Embedded interactive audio player and synced lyrics */}
        <div className="lg:col-span-7 flex flex-col h-full bg-stone-950/80 rounded-2xl border border-amber-900/10 p-5 md:p-6 shadow-xl relative min-h-[380px] justify-between">
          
          {/* Top Player Details */}
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
              className="w-9 h-9 rounded-full bg-stone-900 flex items-center justify-center text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition-colors"
              title="Favoritar"
            >
              <Heart className="w-4 h-4" />
            </button>
          </div>

          {/* Scrolling Lyrics Screen */}
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

          {/* Equalizer Visualizer Animations */}
          <div className="flex items-end justify-center gap-1.5 h-10 mb-4 px-10">
            {Array.from({ length: 28 }).map((_, i) => {
              // Create dynamic animation delays
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

          {/* Player controls */}
          <div className="space-y-3 bg-stone-900/80 p-3.5 rounded-xl border border-stone-800">
            {/* Progress Slider Bar */}
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

            {/* Core buttons */}
            <div className="flex items-center justify-between">
              <button
                id="volume-control-demo"
                onClick={() => setIsMuted(!isMuted)}
                className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                title={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
              </button>

              <button
                id="toggle-demo-play-btn"
                onClick={handlePlayPause}
                className="w-11 h-11 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-450 rounded-full flex items-center justify-center text-stone-950 focus:outline-none shadow-lg transform active:scale-95 transition-all text-center self-center"
              >
                {isPlaying ? (
                  <Pause className="w-5.5 h-5.5 fill-current" />
                ) : (
                  <Play className="w-5.5 h-5.5 fill-current ml-1" />
                )}
              </button>

              <div className="text-[10px] text-amber-500 font-mono tracking-wider flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                <span>EXEMPLO REAL</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
