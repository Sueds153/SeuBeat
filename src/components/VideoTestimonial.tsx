import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Heart, Share2, MessageCircle, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function VideoTestimonial() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [likesCount, setLikesCount] = useState(1420);
  const [hasLiked, setHasLiked] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoSrc, setVideoSrc] = useState('/assets/prova_social.mp4');
  const [isCustomLoaded, setIsCustomLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setVideoError(false);
      }).catch((err) => {
        console.log("Playback error:", err);
        // Playback might be blocked without user interaction first, or source isn't ready
        setIsPlaying(false);
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Simulating small visual timeline tracker for custom-drawn bar
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  const handleLike = () => {
    if (hasLiked) {
      setLikesCount(prev => prev - 1);
      setHasLiked(false);
    } else {
      setLikesCount(prev => prev + 1);
      setHasLiked(true);
    }
  };

  return (
    <section id="video-proof-section" className="py-20 border-t border-stone-900 bg-stone-950 px-4 md:px-8 relative overflow-hidden">
      {/* Absolute background visual glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Side: Editorial emotional presentation */}
        <div className="lg:col-span-7 space-y-8 text-left">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-300 text-xxs font-semibold uppercase tracking-wider font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-[spin_5s_linear_infinite]" />
              <span>Prova Social Real • Inesquecível</span>
            </div>
            
            <h2 className="font-serif text-3xl md:text-5xl text-stone-100 font-extrabold tracking-tight leading-[1.15]">
              "Esposa achou que ele tinha esquecido o aniversário, mas <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-500">ele planejou isto</span>" ❤️
            </h2>
            
            <p className="text-stone-300 text-sm md:text-base leading-relaxed font-sans font-light">
              Este é o momento exato em que a <strong>Rosa</strong> ouviu a música personalizada que o marido, o <strong>Rui dos Santos</strong> (Luanda), planeou com o estúdio <strong>SeuBeat</strong> para celebrar os seus 30 anos de casamento e amor inabalável.
            </p>
          </div>

          {/* Emotional Timeline Storytelling */}
          <div className="space-y-4 border-l-2 border-stone-850 pl-5 py-1">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest block font-bold">A Reação de Rosa</span>
              <p className="text-stone-400 text-xs md:text-sm">
                No início, ela achava que ele se tinha esquecido da data importante. De repente, a música começa a tocar... Uma Kizomba suave onde a letra cantava toda a história do casal, desde o primeiro encontro no Huambo até ao nascimento dos filhos no hospital.
              </p>
            </div>
            <div className="pt-2">
              <p className="text-stone-300 italic text-xs md:text-sm font-medium border-l border-amber-500/40 pl-3">
                "Não consegui conter as lágrimas. Ver a nossa vida inteira cantada de forma tão digna e poética foi o presente mais lindo que já recebi!" — Rosa dos Santos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="bg-stone-900/40 border border-stone-850/80 px-4 py-3.5 rounded-2xl flex items-center gap-3">
              <span className="text-2xl">😭</span>
              <div>
                <span className="text-xs font-bold text-stone-200 block">Lágrimas Garantidas</span>
                <span className="text-[10px] text-stone-500 font-mono uppercase">99% de eficácia emocional</span>
              </div>
            </div>

            <div className="bg-stone-900/40 border border-stone-850/80 px-4 py-3.5 rounded-2xl flex items-center gap-3">
              <span className="text-2xl">🇦🇴</span>
              <div>
                <span className="text-xs font-bold text-stone-200 block">Identidade Nacional</span>
                <span className="text-[10px] text-stone-500 font-mono uppercase">Compositores e vozes de Angola</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Smartphone TikTok Mockup containing the custom Video Player */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[340px] aspect-[9/16] bg-stone-950 rounded-[40px] p-2.5 shadow-2xl border-4 border-stone-800 ring-1 ring-stone-900 flex flex-col justify-center overflow-hidden">
            
            {/* Phone speaker & camera notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-stone-950 rounded-full z-30 flex items-center justify-center">
              <div className="w-10 h-1 bg-stone-800 rounded-full" />
              <div className="w-2 h-2 bg-stone-900 rounded-full ml-3" />
            </div>

            {/* Video container element */}
            <div 
              className="relative w-full h-full rounded-[30px] overflow-hidden bg-stone-950 flex flex-col justify-between group/player cursor-pointer"
              onClick={togglePlay}
            >
              <iframe
                src="https://www.youtube.com/embed/FeZmi3nRC6Q?autoplay=1&mute=1&loop=1&playlist=FeZmi3nRC6Q&controls=0&modestbranding=1&rel=0&playsinline=1"
                title="SeuBeat Social Proof"
                className="absolute inset-0 w-full h-full object-cover z-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />

              {/* TikTok visual overlay watermark */}
              <div className="absolute top-12 left-4 z-10 flex items-center gap-1.5 opacity-90 pointer-events-none">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 animate-[ping_1.5s_infinite]" />
                <span className="text-[9.5px] font-mono font-bold tracking-widest bg-stone-950/60 backdrop-blur text-stone-200 px-2.5 py-0.5 rounded-full border border-stone-800">
                  REPRODUZINDO • REAÇÃO REAL
                </span>
              </div>

              {/* Floating control buttons inside the video */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-5 pointer-events-none">
                {/* Hearts / Likes */}
                <button
                  type="button"
                  className="flex flex-col items-center gap-1 cursor-pointer group/icon bg-stone-950/40 p-2 rounded-full hover:bg-stone-900/60 backdrop-blur pointer-events-auto"
                  onClick={(e) => { e.stopPropagation(); handleLike(); }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all">
                    <Heart className={`w-5.5 h-5.5 transition-all ${hasLiked ? 'text-rose-500 fill-rose-500 scale-120' : 'text-stone-300 group-hover/icon:text-rose-400'}`} />
                  </div>
                  <span className="text-[10px] font-mono text-stone-200 font-semibold">{likesCount}</span>
                </button>

                {/* Shares */}
                <button
                  type="button"
                  className="flex flex-col items-center gap-1 cursor-pointer bg-stone-950/40 p-2 rounded-full hover:bg-stone-900/60 backdrop-blur pointer-events-auto"
                  onClick={(e) => { e.stopPropagation(); alert("Link de partilha copiado com sucesso!"); }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-stone-200 font-semibold">184</span>
                </button>

                {/* Comments */}
                <button
                  type="button"
                  className="flex flex-col items-center gap-1 cursor-pointer bg-stone-950/40 p-2 rounded-full hover:bg-stone-900/60 backdrop-blur pointer-events-auto"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-stone-200 font-semibold">92</span>
                </button>
              </div>

              {/* Subtitles Overlay simulated timeline captions */}
              <div className="absolute bottom-6 inset-x-4 z-10 bg-gradient-to-t from-stone-950/95 via-stone-950/70 to-transparent p-4 rounded-[24px] text-left space-y-1.5 pointer-events-none">
                <span className="text-[9px] font-mono text-amber-500 tracking-wider font-extrabold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-block">
                  @seubeat
                </span>
                
                <p className="text-xs text-stone-100 leading-normal font-sans font-medium">
                  Esposa achou que ele tinha esquecido o aniversário, mas ele planejou ISSO ❤️
                </p>

                <p className="text-[10px] text-stone-400 leading-normal font-mono">
                  🎵 Rosa (Kizomba Romântica) - Composição Original SeuBeat
                </p>
              </div>

            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
