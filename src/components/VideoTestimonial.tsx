import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Heart, Share2, MessageCircle, Sparkles, Star, Quote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TESTIMONIALS = [
  {
    quote: "Não consegui conter as lágrimas. Ver a nossa vida inteira cantada de forma tão digna e poética foi o presente mais lindo que já recebi!",
    author: "Rosa dos Santos",
    location: "Luanda",
    type: "Esposa",
    style: "Kizomba Romântica",
    rating: 5
  },
  {
    quote: "Ofereci ao meu pai no aniversário dele. Ele nunca tinha recebido nada tão emocionante. A música captou cada momento da nossa história.",
    author: "Miguel Domingos",
    location: "Benguela",
    type: "Filho",
    style: "Semba",
    rating: 5
  },
  {
    quote: "A minha namorada chorou de alegria quando ouviu. Disseram que era impossível transformar sentimentos em música, mas o SeuBeat fez magia.",
    author: "Yuri Afonso",
    location: "Huambo",
    type: "Namorado",
    style: "Afrobeat",
    rating: 5
  }
];

export default function VideoTestimonial() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [likesCount, setLikesCount] = useState(1420);
  const [hasLiked, setHasLiked] = useState(false);
  const [isCustomLoaded, setIsCustomLoaded] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>('/assets/SeuBeat.mp4');
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    if (isCustomLoaded) return;
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [isCustomLoaded]);

  const togglePlay = () => {
    if (!videoRef.current || !videoSrc) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !videoRef.current.muted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      if (video.duration) setProgress((video.currentTime / video.duration) * 100);
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [videoSrc]);

  const handleLike = () => {
    if (hasLiked) { setLikesCount(prev => prev - 1); setHasLiked(false); }
    else { setLikesCount(prev => prev + 1); setHasLiked(true); }
  };

  const t = TESTIMONIALS[currentTestimonial];

  return (
    <section id="video-proof-section" className="py-20 border-t border-stone-900 bg-stone-950 px-4 md:px-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        <div className="lg:col-span-7 space-y-8 text-left">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-300 text-xxs font-semibold uppercase tracking-wider font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Prova Social Real</span>
            </div>
            
            <h2 className="font-serif text-3xl md:text-5xl text-stone-100 font-extrabold tracking-tight leading-[1.15]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-500">Histórias reais</span> de quem já emocionou alguém especial
            </h2>
            
            <p className="text-stone-300 text-sm md:text-base leading-relaxed font-sans font-light">
              Centenas de angolanos já eternizaram momentos inesquecíveis com uma música personalizada SeuBeat.
            </p>
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

            <div className="bg-stone-900/40 border border-stone-850/80 px-4 py-3.5 rounded-2xl flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <span className="text-xs font-bold text-stone-200 block">4.9/5 Estrelas</span>
                <span className="text-[10px] text-stone-500 font-mono uppercase">+200 avaliações positivas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[340px] aspect-[9/16] bg-gradient-to-b from-stone-900 to-stone-950 rounded-[40px] p-2.5 shadow-2xl border-4 border-stone-800 ring-1 ring-stone-900 flex flex-col justify-center overflow-hidden">
            
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-stone-950 rounded-full z-30 flex items-center justify-center">
              <div className="w-10 h-1 bg-stone-800 rounded-full" />
              <div className="w-2 h-2 bg-stone-900 rounded-full ml-3" />
            </div>

            <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-gradient-to-br from-stone-900 via-stone-950 to-amber-950/30 flex flex-col items-center justify-center p-5">
              {/* Video player if custom video loaded */}
              {videoSrc && !videoError && (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    loop
                    muted={isMuted}
                    src={videoSrc}
                    onError={() => setVideoError(true)}
                    preload="metadata"
                    poster="/assets/seubeat_card.svg"
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />
                  <div className="absolute bottom-0 inset-x-0 h-10 bg-stone-950/80 z-20 flex items-center justify-between px-4 border-t border-stone-900">
                    <button aria-label={isPlaying ? 'Pausar' : 'Reproduzir'} onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <div className="flex-grow mx-3 bg-stone-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <button aria-label={isMuted ? 'Ativar som' : 'Silenciar'} onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => { setVideoSrc(null); setIsCustomLoaded(false); setVideoError(false); }}
                    className="absolute top-12 right-3 z-20 bg-stone-950/70 text-stone-400 text-xs px-2 py-1 rounded-full cursor-pointer"
                  >
                    Remover
                  </button>
                </>
              )}

              {/* Testimonial card (shown when no custom video or video error) */}
              {(!videoSrc || videoError) && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTestimonial}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center text-center space-y-4 z-10"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-rose-500/20 rounded-full flex items-center justify-center border border-amber-500/20">
                      <Quote className="w-7 h-7 text-amber-400" />
                    </div>

                    <p className="text-stone-200 text-sm leading-relaxed italic font-serif px-2">
                      "{t.quote}"
                    </p>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>

                    <div>
                      <p className="text-amber-400 font-bold text-sm">{t.author}</p>
                      <p className="text-stone-500 text-xs font-mono">{t.location} • {t.type}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                        {t.style}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button aria-label="Gostar" onClick={handleLike} className="flex flex-col items-center cursor-pointer">
                        <Heart className={`w-5 h-5 ${hasLiked ? 'text-rose-500 fill-rose-500' : 'text-stone-400'}`} />
                        <span className="text-[10px] font-mono text-stone-500 mt-0.5">{likesCount}</span>
                      </button>
                      <button aria-label="Partilhar" className="flex flex-col items-center cursor-pointer">
                        <Share2 className="w-5 h-5 text-stone-400" />
                        <span className="text-[10px] font-mono text-stone-500 mt-0.5">184</span>
                      </button>
                      <button aria-label="Comentar" className="flex flex-col items-center cursor-pointer">
                        <MessageCircle className="w-5 h-5 text-stone-400" />
                        <span className="text-[10px] font-mono text-stone-500 mt-0.5">92</span>
                      </button>
                    </div>

                    {/* Dots navigation */}
                    <div className="flex items-center gap-2 mt-2">
                      {TESTIMONIALS.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentTestimonial(idx)}
                          className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                            idx === currentTestimonial ? 'bg-amber-400 w-4' : 'bg-stone-700'
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Upload button */}
              {(!videoSrc || videoError) && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-stone-800/80 hover:bg-stone-700/80 text-stone-400 rounded-xl text-[10px] font-mono transition-all border border-stone-700/50 cursor-pointer"
                >
                  Carregar vídeo real (.mp4)
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
                  const url = URL.createObjectURL(file);
                  blobUrlRef.current = url;
                  setVideoSrc(url);
                  setIsCustomLoaded(true);
                  setVideoError(false);
                  setTimeout(() => {
                    if (videoRef.current) videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                  }, 150);
                }}
              />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}