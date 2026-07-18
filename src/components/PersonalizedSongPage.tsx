import React, { useState, useRef } from 'react';
import {
  Heart, ArrowLeft, Sparkles,
  Upload, Image as ImageIcon
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
  const { isPlaying, isMuted, audioProgress, togglePlay, toggleMute } = useAudioPlayer({
    audioUrl: songDetails.audioUrl,
    textFallback: songDetails.letter || (songDetails.lyrics.length > 0 ? songDetails.lyrics.join(' ') : undefined),
  });

  const [likesCount, setLikesCount] = useState(382);
  const [hasLiked, setHasLiked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFullUnlocked = songDetails.status === 'delivered' || songDetails.status === 'approved';

  const handleLike = () => {
    if (hasLiked) {
      setLikesCount(prev => prev - 1);
      setHasLiked(false);
    } else {
      setLikesCount(prev => prev + 1);
      setHasLiked(true);
    }
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

  const handleDownloadMP3 = () => {
    if (!songDetails.audioUrl || !isFullUnlocked) return;
    const a = document.createElement("a");
    a.href = songDetails.audioUrl;
    a.target = "_blank";
    a.download = `${songDetails.recipientName.replace(/\s+/g, '_')}_SeuBeat_Completa.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadLyrics = () => {
    const text =
`================================================
DEDICATÓRIA DE AMOR SEUBEAT
Música: ${songDetails.recipientName} (Canção de Amor)
Género: ${capitalize(songDetails.musicStyle)}
Autor: ${songDetails.userNick}
Para: ${songDetails.recipientName} (${songDetails.recipientNick})
================================================

LETRA COMPLETA DA CANÇÃO:
${generateLyricsText().map((line, idx) => `[0:${(idx * 18).toString().padStart(2, '0')}] ${line}`).join('\n')}

------------------------------------------------
CARTA ESCRITA DO CORAÇÃO:
${songDetails.letter}
------------------------------------------------
Criado com ❤️ no estúdio SeuBeat (teusom.com)
Angola ${(new Date().getFullYear())}
================================================`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = `Letra_SeuBeat_${songDetails.recipientName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          <div className="pt-2">
            <WhatsAppHelp context="nao_encontrada" label="Preciso de ajuda" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090807] text-stone-100 flex flex-col justify-between selection:bg-amber-500/20 selection:text-amber-300 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] bg-rose-500/5 rounded-full filter blur-[130px] pointer-events-none" />
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      <header className="border-b border-stone-900 bg-stone-950/80 backdrop-blur sticky top-0 z-40 px-4 md:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoIcon size={32} />
            <button
              onClick={onBackToLanding}
              className="flex items-center gap-2 text-stone-400 hover:text-stone-100 text-xs font-mono transition-colors font-semibold group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>CRIA UMA PÁGINA ASSIM</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest font-bold">
              <span className="hidden sm:inline">PÁGINA DEDICADA EXCLUSIVA</span>
              <span className="sm:hidden">DEDICATÓRIA</span>
            </span>
          </div>
        </div>
      </header>

      {fetchError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 md:px-8 py-3">
          <p className="text-xs text-amber-400 text-center max-w-6xl mx-auto">
            Não foi possível carregar os dados mais recentes. A página pode mostrar informações limitadas.
          </p>
          <div className="flex justify-center mt-2">
            <WhatsAppHelp context="nao_encontrada" label="Preciso de ajuda" />
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-10 md:py-16 flex-grow flex flex-col justify-center space-y-12 relative z-10">

        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xxs font-mono uppercase tracking-widest font-bold animate-[pulse_2s_infinite]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Uma surpresa feita com a alma</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-6xl text-white font-black tracking-tight max-w-3xl mx-auto leading-none break-words">
            {songDetails.songTitle || `Música de ${songDetails.recipientName}`} 💝
          </h1>
          <p className="text-xs md:text-sm text-stone-400 font-mono tracking-wide uppercase">
            Criada poéticamente no estilo <span className="text-amber-400 font-bold">{capitalize(songDetails.musicStyle)}</span> por <span className="text-rose-400 font-bold">{songDetails.userNick}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 mt-1">
            {songDetails.occasion && (
              <span className="px-2 py-0.5 bg-stone-900 border border-stone-800 rounded-full text-[10px] font-mono text-stone-400">
                🎉 {capitalize(songDetails.occasion)}
              </span>
            )}
            {songDetails.relationship && (
              <span className="px-2 py-0.5 bg-stone-900 border border-stone-800 rounded-full text-[10px] font-mono text-stone-400">
                👤 {capitalize(songDetails.relationship)}
              </span>
            )}
            {songDetails.desiredEmotion && (
              <span className="px-2 py-0.5 bg-stone-900 border border-stone-800 rounded-full text-[10px] font-mono text-stone-400">
                💖 {capitalize(songDetails.desiredEmotion)}
              </span>
            )}
            {songDetails.voiceType && (
              <span className="px-2 py-0.5 bg-stone-900 border border-stone-800 rounded-full text-[10px] font-mono text-stone-400">
                🎤 {capitalize(songDetails.voiceType)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

          <div className="lg:col-span-5 bg-gradient-to-b from-stone-900/50 to-stone-950/80 rounded-[32px] p-6 border border-stone-850/60 flex flex-col justify-between items-center text-center space-y-8 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500 opacity-20" />

            <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 flex items-center justify-center">
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

              <motion.div
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ repeat: Infinity, ease: "linear", duration: 8 }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,#121110_0%,#1a1918_30%,#090909_100%)] rounded-full border-8 border-stone-950 flex items-center justify-center shadow-2xl relative"
              >
                <div className="absolute inset-6 rounded-full border border-stone-900/40" />
                <div className="absolute inset-12 rounded-full border border-stone-900/60" />
                <div className="absolute inset-20 rounded-full border border-stone-900/25" />

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

                  <div className="absolute inset-0 m-auto w-3 h-3 bg-[#090807] rounded-full border border-stone-900 flex items-center justify-center" />

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

            <div className="space-y-2">
              <span className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono rounded-full uppercase tracking-widest font-extrabold inline-block">
                {isFullUnlocked ? 'Completa • Qualidade HD (MP3)' : songDetails.status === 'lyrics_ready' ? 'Música será disponibilizada após confirmação do pagamento' : 'Completa após pagamento'}
              </span>
              <h3 className="font-serif text-xl font-bold text-stone-100">
                {songDetails.songTitle || `A canção de ${songDetails.recipientName}`}
              </h3>
            </div>

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

          <SongPlayer
            ref={fileInputRef}
            audioProgress={audioProgress}
            isPlaying={isPlaying}
            isMuted={isMuted}
            hasAudio={!!songDetails.audioUrl}
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

        </div>

        <SongLyrics lyrics={generateLyricsText()} audioProgress={audioProgress} />

        <SongLetter
          recipientName={songDetails.recipientName}
          recipientNick={songDetails.recipientNick}
          userNick={songDetails.userNick}
          memory={songDetails.memory}
          whereItHappened={songDetails.whereItHappened}
          letter={songDetails.letter}
        />

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

      </main>

      <footer className="border-t border-stone-900 py-8 text-center bg-stone-950 text-stone-550 text-xxs font-mono">
        <p>© {new Date().getFullYear()} SeuBeat Estúdio Angola • Todos os direitos reservados.</p>
        <p className="mt-1 pb-4">Conectando memórias angolanas a melodias de estúdio profissionais.</p>
      </footer>
    </div>
  );
}
