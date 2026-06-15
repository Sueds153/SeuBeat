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
              <video
                ref={videoRef}
                playsInline
                loop
                referrerPolicy="no-referrer"
                src={videoSrc}
                className="absolute inset-0 w-full h-full object-cover z-0"
                onError={() => {
                  if (!isCustomLoaded) {
                    console.log("Could not load /assets/prova_social.mp4, using fallback description/state");
                    setVideoError(true);
                  }
                }}
              />

              {/* Error state / Fallback placeholder when video file is not yet uploaded */}
              {videoError && (
                <div className="absolute inset-0 z-5 bg-gradient-to-b from-stone-900/80 via-stone-950 to-stone-900 flex flex-col items-center justify-center p-5 text-center space-y-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
                    <Heart className="w-7 h-7 text-rose-500 fill-rose-500 animate-[pulse_1.5s_infinite]" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9.5px] font-mono text-amber-500 font-bold uppercase tracking-widest block">VÍDEO DE PROVA SOCIAL</span>
                    <h4 className="text-stone-150 font-bold text-sm leading-tight">Rosa Emociona-se com a Música</h4>
                    <p className="text-stone-400 text-[10px] leading-relaxed max-w-[240px] mx-auto">
                      Como o ficheiro de vídeo não existe no servidor, pode selecioná-lo diretamente do seu dispositivo para ver a reprodução real integrada!
                    </p>
                  </div>
                  
                  {/* Client-side File Loader Button */}
                  <label 
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-90 text-stone-950 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all shadow-md shadow-amber-500/15"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Carregar o seu Vídeo (.mp4)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const fileUrl = URL.createObjectURL(e.target.files[0]);
                          setVideoSrc(fileUrl);
                          setIsCustomLoaded(true);
                          setVideoError(false);
                          setTimeout(() => {
                            if (videoRef.current) {
                              videoRef.current.play().then(() => setIsPlaying(true)).catch(err => console.log(err));
                            }
                          }, 150);
                        }
                      }}
                    />
                  </label>

                  <div className="bg-stone-950/80 px-3 py-1.5 rounded-xl text-[10px] text-stone-500 font-mono border border-stone-850 leading-normal text-left max-w-[240px]">
                    ✍️ Letra ouvida no vídeo:<br />
                    <span className="text-stone-300 italic">"Rosa, mulher da minha vida, desde o Huambo até aqui, 30 anos ao teu lado..."</span>
                  </div>
                </div>
              )}

              {/* TikTok visual overlay watermark */}
              <div className="absolute top-12 left-4 z-10 flex items-center gap-1.5 opacity-90">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 animate-[ping_1.5s_infinite]" />
                <span className="text-[9.5px] font-mono font-bold tracking-widest bg-stone-950/60 backdrop-blur text-stone-200 px-2.5 py-0.5 rounded-full border border-stone-800">
                  REPRODUZINDO • REAÇÃO REAL
                </span>
              </div>

              {/* Floating control buttons inside the video */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-5">
                {/* Hearts / Likes */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer group/icon bg-stone-950/40 p-2 rounded-full hover:bg-stone-900/60 backdrop-blur"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all">
                    <Heart className={`w-5.5 h-5.5 transition-all ${hasLiked ? 'text-rose-500 fill-rose-500 scale-120' : 'text-stone-300 group-hover/icon:text-rose-400'}`} />
                  </div>
                  <span className="text-[10px] font-mono text-stone-200 font-semibold">{likesCount}</span>
                </button>

                {/* Shares */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    alert("Link de partilha copiado com sucesso!");
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer bg-stone-950/40 p-2 rounded-full hover:bg-stone-900/60 backdrop-blur"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-stone-200 font-semibold">184</span>
                </button>

                {/* Comments */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer bg-stone-950/40 p-2 rounded-full hover:bg-stone-900/60 backdrop-blur"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-stone-200 font-semibold">92</span>
                </button>
              </div>

              {/* Subtitles Overlay simulated timeline captions */}
              <div className="absolute bottom-16 inset-x-4 z-10 bg-gradient-to-t from-stone-950/95 via-stone-950/70 to-transparent p-4 rounded-b-[24px] text-left space-y-1.5 pointer-events-none">
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

              {/* Big play button centered when paused */}
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center z-15 bg-black/20 pointer-events-none"
                  >
                    <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-rose-600 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/30">
                      <Play className="w-7 h-7 text-stone-950 fill-stone-950 translate-x-0.5" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Custom micro control bar at the absolute bottom */}
              <div className="absolute bottom-0 inset-x-0 h-10 bg-stone-950 z-20 flex items-center justify-between px-4 border-t border-stone-900">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="text-stone-400 hover:text-white transition-colors p-1"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </button>

                {/* Progress track */}
                <div className="flex-grow mx-3 bg-stone-850 h-1 rounded-full overflow-hidden relative">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="text-stone-400 hover:text-white transition-colors p-1"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
