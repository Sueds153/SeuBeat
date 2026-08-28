import React, { useState, useRef } from 'react';
import {
  Heart, Sparkles, Upload, Image as ImageIcon, ArrowLeft, Music, PartyPopper, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSong } from '../hooks/useSong';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import SongPlayer from './SongPlayer';
import SongLyrics from './SongLyrics';
import SongLetter from './SongLetter';
import SongShare from './SongShare';
import WhatsAppHelp from './WhatsAppHelp';
import LogoIcon from './LogoIcon';

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface PersonalizedSongPageProps {
  onBackToLanding: () => void;
}

export default function PersonalizedSongPage({ onBackToLanding }: PersonalizedSongPageProps) {
  const { isLoading, notFound, fetchError, songDetails, setSongDetails } = useSong();
  const [selectedVersion, setSelectedVersion] = useState<'v1' | 'v2'>('v1');
  const activeAudioUrl = selectedVersion === 'v2' && songDetails.audioUrlV2
    ? songDetails.audioUrlV2
    : songDetails.audioUrl;
  const { isPlaying, isMuted, audioProgress, togglePlay, toggleMute } = useAudioPlayer({
    audioUrl: activeAudioUrl,
    textFallback: songDetails.letter || (songDetails.lyrics.length > 0 ? songDetails.lyrics.join(' ') : undefined),
  });

  const [likesCount, setLikesCount] = useState(382);
  const [hasLiked, setHasLiked] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFullUnlocked = songDetails.status === 'delivered' || songDetails.status === 'approved';

  // Reset photo error state when photo URL changes (e.g. user replaces photo)
  React.useEffect(() => {
    setPhotoLoadError(false);
  }, [songDetails.photoUrl]);

  const handleLike = () => {
    if (hasLiked) { setLikesCount(p => p - 1); setHasLiked(false); }
    else { setLikesCount(p => p + 1); setHasLiked(true); }
  };

  const generateLyricsText = () => {
    if (songDetails.lyrics.length > 0) return songDetails.lyrics;
    const { recipientNick, userNick, memory, whereItHappened } = songDetails;
    return [
      `Desde o dia em que te conheci, querido(a) ${recipientNick},`,
      `O meu peito rebate no compasso de um ritmo profundo.`,
      `Estávamos juntos em ${whereItHappened || 'Angola'}, recordas-te meu bem?`,
      `Aquele momento: ${memory || 'em que trocámos o nosso primeiro olhar sincero'}.`,
      `O teu sorriso brilha mais que o luar na baía,`,
      `Com o teu amor aqueces o meu peito de harmonia e alegria.`,
      `Ao som deste Kizomba, declaro-te toda a minha afeição,`,
      `És a eterna comandante do meu fiel coração.`,
      `Prometo amar-te todos os dias, com alma e dignidade,`,
      `Do teu companheiro dedicado de verdade: ${userNick}.`
    ];
  };

  const handleDownloadMP3 = async () => {
    if (!activeAudioUrl || !isFullUnlocked) return;
    try {
      const res = await fetch(activeAudioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${songDetails.recipientName.replace(/\s+/g, '_')}_SeuBeat_Completa${selectedVersion === 'v2' ? '_v2' : ''}.mp3`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.open(activeAudioUrl, '_blank');
    }
  };

  const handleDownloadLyrics = () => {
    const text = `================================================\nDEDICATÓRIA SEUBEAT\nMúsica: ${songDetails.recipientName}\nAutor: ${songDetails.userNick}\n================================================\n\n${generateLyricsText().join('\n')}\n\n${songDetails.letter}\n================================================`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = `Letra_SeuBeat_${songDetails.recipientName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const handleCustomPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (songDetails.photoUrl?.startsWith('blob:')) URL.revokeObjectURL(songDetails.photoUrl);
      const url = URL.createObjectURL(file);
      setSongDetails(prev => ({ ...prev, photoUrl: url }));
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') localStorage.setItem('seubeat_temp_photo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ─── LOADING ───────────────────────────────────────────────────────────────
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

  // ─── NOT FOUND ─────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-[#090807] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-stone-900 flex items-center justify-center">
            <Music className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-2xl text-white font-bold">Música não encontrada</h1>
          <p className="text-stone-400 text-sm">O link que abriste não é válido ou a música foi removida.</p>
          <a href="/" className="inline-block px-8 py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 rounded-full font-bold text-sm hover:scale-105 transition-transform">
            Criar a minha música
          </a>
          <div className="pt-2">
            <WhatsAppHelp context="nao_encontrada" label="Preciso de ajuda" />
          </div>
        </div>
      </div>
    );
  }

  const lyrics = generateLyricsText();

  // ─── MAIN ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#090807] text-white pb-16 sm:pb-32 selection:bg-amber-500/20 selection:text-amber-300">

      {/* Dynamic gradient hero background based on theme */}
      <div
        className="absolute top-0 inset-x-0 h-[250px] sm:h-[420px] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(245,158,11,0.2) 0%, rgba(9,8,7,0) 100%)'
        }}
      />

      {/* ── TOP NAV ── */}
      <header className="sticky top-0 z-40 bg-[#090807]/95 backdrop-blur-md border-b border-stone-900 px-4 md:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoIcon size={28} />
            <button
              onClick={onBackToLanding}
              className="flex items-center gap-1.5 text-stone-400 hover:text-stone-100 text-xs font-semibold transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">CRIA UMA PÁGINA ASSIM</span>
              <span className="sm:hidden">INÍCIO</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
              <span className="hidden sm:inline">PÁGINA DEDICADA EXCLUSIVA</span>
              <span className="sm:hidden">DEDICATÓRIA</span>
            </span>
          </div>
        </div>
      </header>

      {fetchError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-400">
          Não foi possível carregar os dados mais recentes.
          <WhatsAppHelp context="nao_encontrada" label="Preciso de ajuda" />
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 md:px-8 relative z-10">

        {/* ── HERO — album art + info ── */}
        <section className="flex flex-col sm:flex-row items-center sm:items-end gap-6 pt-10 pb-8">

          {/* Album Art */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex-shrink-0 group">
            <div className={`w-full h-full rounded-xl overflow-hidden shadow-2xl transition-shadow duration-700 ${
              isPlaying
                ? 'shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/50'
                : 'shadow-black/60 ring-1 ring-white/10'
            }`}>
              {songDetails.photoUrl && !photoLoadError ? (
                <img
                  src={songDetails.photoUrl}
                  alt="Capa"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setPhotoLoadError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-stone-800 to-stone-900 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-stone-600" />
                </div>
              )}
            </div>
            {/* Upload overlay */}
            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-xl gap-1">
              <Upload className="w-6 h-6 text-white" />
              <span className="text-[10px] font-bold text-white uppercase">Trocar foto</span>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomPhoto} />
            </label>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> Música Personalizada
            </span>
            <h1 className="font-bold text-2xl sm:text-3xl md:text-4xl text-white leading-tight line-clamp-3 sm:line-clamp-2">
              {songDetails.songTitle || `Música de ${songDetails.recipientName}`}
            </h1>
            {(() => {
              const isGenericAuthor = !songDetails.userNick || ['autor', 'seubeat', 'anónimo', 'anonimo', 'null', 'undefined'].includes(songDetails.userNick.trim().toLowerCase());
              const hasUniqueNick = !!songDetails.recipientNick && 
                songDetails.recipientNick.trim().toLowerCase() !== songDetails.recipientName.trim().toLowerCase() &&
                !['autor', 'seubeat', 'anónimo', 'anonimo'].includes(songDetails.recipientNick.trim().toLowerCase());
              
              return (
                <p className="text-stone-400 text-sm">
                  {!isGenericAuthor ? (
                    <>
                      Criada por <span className="text-white font-semibold">{songDetails.userNick}</span> para <span className="text-white font-semibold">{songDetails.recipientName}</span>
                    </>
                  ) : (
                    <>
                      Criada especialmente para <span className="text-white font-semibold">{songDetails.recipientName}</span>
                    </>
                  )}
                  {hasUniqueNick && <span className="text-stone-400"> ({songDetails.recipientNick})</span>}
                </p>
              );
            })()}
            <div className="flex flex-wrap gap-2">
              {songDetails.musicStyle && (
                <span className="px-3 py-1 bg-stone-900 border border-stone-800 rounded-full text-[11px] text-stone-300 font-medium inline-flex items-center gap-1">
                  <Music className="w-3 h-3 text-amber-400" /> {capitalize(songDetails.musicStyle)}
                </span>
              )}
              {songDetails.occasion && (
                <span className="px-3 py-1 bg-stone-900 border border-stone-800 rounded-full text-[11px] text-stone-300 font-medium inline-flex items-center gap-1">
                  <PartyPopper className="w-3 h-3 text-amber-400" /> {capitalize(songDetails.occasion)}
                </span>
              )}
              {songDetails.desiredEmotion && (
                <span className="px-3 py-1 bg-stone-900 border border-stone-800 rounded-full text-[11px] text-stone-300 font-medium inline-flex items-center gap-1">
                  <Heart className="w-3 h-3 text-amber-400" /> {capitalize(songDetails.desiredEmotion)}
                </span>
              )}
            </div>
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 text-xs font-semibold transition-colors ${hasLiked ? 'text-rose-400' : 'text-stone-400 hover:text-white'}`}
            >
              <Heart className={`w-5 h-5 transition-all ${hasLiked ? 'fill-rose-500 text-rose-500 scale-110' : ''}`} />
              {likesCount} gostos
            </button>
          </div>
        </section>

        {/* ── UPSELL BANNER (Only when approved/delivered) ── */}
        {isFullUnlocked && (
          <section className="mb-10 animate-fadeIn">
            <div className="bg-gradient-to-r from-stone-900 via-stone-900 to-stone-950 p-5 md:p-6 rounded-3xl border border-amber-500/20 shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center gap-6 group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-amber-500/10" />
              
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/50 border border-amber-500/30 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg relative z-10 backdrop-blur-sm">
                 <Video className="w-8 h-8 text-amber-400" />
                 <Sparkles className="w-4 h-4 text-rose-400 absolute -top-1.5 -right-1.5 animate-pulse" />
              </div>
              
              <div className="flex-1 text-center sm:text-left relative z-10">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">
                  NOVIDADE: ETERNIZE O MOMENTO
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-100 mb-2 leading-tight">
                  Quer um Videoclipe Emocional?
                </h3>
                <p className="text-xs text-stone-400 max-w-xl">
                  Transforme esta música num vídeo inesquecível! Criamos um slideshow dinâmico com as vossas melhores fotos e vídeos. O presente definitivo (Apenas <strong className="text-amber-400 font-mono text-[11px]">2.900 Kz</strong>).
                </p>
              </div>
              
              <div className="flex-shrink-0 relative z-10 w-full sm:w-auto">
                <a
                  href={`https://wa.me/244922058136?text=${encodeURIComponent(`Olá! Gostaria de transformar a minha música "${songDetails.songTitle || songDetails.recipientName}" num Videoclipe Emocional com fotos por 2.900 Kz. Como podemos avançar?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Pedir Vídeo no WhatsApp</span>
                </a>
              </div>
            </div>
          </section>
        )}

        {/* ── VERSION TOGGLE ── */}
        {isFullUnlocked && songDetails.audioUrlV2 && (
          <section className="mb-6">
            <div className="flex items-center justify-center gap-3">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Versão</span>
              <div className="flex bg-stone-900 border border-stone-800 rounded-full p-0.5">
                <button
                  onClick={() => setSelectedVersion('v1')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedVersion === 'v1'
                      ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/20'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => setSelectedVersion('v2')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedVersion === 'v2'
                      ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/20'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  B
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── PLAYER ── */}
        <SongPlayer
          ref={fileInputRef}
          audioProgress={audioProgress}
          isPlaying={isPlaying}
          isMuted={isMuted}
          hasAudio={!!activeAudioUrl}
          isFullUnlocked={isFullUnlocked}
          songTitle={songDetails.songTitle}
          recipientName={songDetails.recipientName}
          recipientNick={songDetails.recipientNick}
          whereItHappened={songDetails.whereItHappened}
          onPlayPause={togglePlay}
          onToggleMute={toggleMute}
          onDownloadMP3={handleDownloadMP3}
          onDownloadLyrics={handleDownloadLyrics}
        />

        {/* ── LYRICS ── */}
        <section className="mt-10">
          <SongLyrics lyrics={lyrics} audioProgress={audioProgress} />
        </section>

        {/* ── LETTER ── */}
        <section className="mt-8">
          <SongLetter
            recipientName={songDetails.recipientName}
            recipientNick={songDetails.recipientNick}
            userNick={songDetails.userNick}
            memory={songDetails.memory}
            whereItHappened={songDetails.whereItHappened}
            letter={songDetails.letter}
          />
        </section>

        {/* ── SHARE ── */}
        <section className="mt-8 mb-6">
          <SongShare
            songId={songDetails.id}
            recipientName={songDetails.recipientName}
            recipientNick={songDetails.recipientNick}
            userNick={songDetails.userNick}
            musicStyle={songDetails.musicStyle}
            memory={songDetails.memory}
            whereItHappened={songDetails.whereItHappened}
            letter={songDetails.letter}
          />
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-stone-900 py-6 text-center text-stone-600 text-[11px] font-mono mt-4">
        <p>© {new Date().getFullYear()} SeuBeat Estúdio Angola • Todos os direitos reservados.</p>
        <p className="mt-1">Conectando memórias angolanas a melodias de estúdio profissionais.</p>
      </footer>

      {/* Mini Now Playing */}
      <AnimatePresence>
        {isPlaying && songDetails.photoUrl && !photoLoadError && (
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full overflow-hidden shadow-xl shadow-amber-500/20 ring-2 ring-amber-500/50 hover:ring-amber-400 hover:shadow-amber-500/40 transition-all cursor-pointer"
            title="Ir para o topo"
          >
            <motion.img
              src={songDetails.photoUrl}
              alt="Now Playing"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: 'linear', duration: 8 }}
            />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
