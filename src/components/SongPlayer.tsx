import { forwardRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, FileText } from 'lucide-react';

interface SongPlayerProps {
  audioProgress: number;
  isPlaying: boolean;
  isMuted: boolean;
  hasAudio: boolean;
  isFullUnlocked: boolean;
  songTitle: string;
  recipientName: string;
  recipientNick: string;
  whereItHappened: string;
  onPlayPause: () => void;
  onToggleMute: () => void;
  onDownloadMP3: () => void;
  onDownloadLyrics: () => void;
}

export default forwardRef<HTMLInputElement, SongPlayerProps>(function SongPlayer(props, _ref) {
  const {
    audioProgress, isPlaying, isMuted, hasAudio, isFullUnlocked,
    songTitle, recipientName, recipientNick, whereItHappened,
    onPlayPause, onToggleMute, onDownloadMP3, onDownloadLyrics,
  } = props;
  const durationSeconds = isFullUnlocked ? 185 : 30;
  const displayMode = isFullUnlocked ? 'MÚSICA COMPLETA' : 'PREVIEW 30S';

  return (
    <div className="lg:col-span-7 bg-stone-900/15 rounded-[32px] p-6 md:p-8 border border-stone-850/60 flex flex-col justify-between space-y-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full filter blur-[50px]" />

      <div className="bg-stone-950 rounded-2xl p-5 md:p-6 border border-stone-850/80 space-y-4">
        <div className="flex justify-between items-center">
          <span className="hidden sm:inline text-[10px] text-stone-500 font-mono uppercase tracking-widest">AUDIO PLAYER INTEGRADO</span>
          <span className="text-[10px] text-rose-500 font-mono tracking-widest uppercase font-bold flex items-center gap-1.5 p-1 bg-rose-500/5 rounded border border-rose-500/10">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" /> {displayMode}
          </span>
        </div>

        <div className="h-14 flex items-end gap-0.5 sm:gap-1.5 px-3 pt-3">
          {Array.from({ length: 40 }).map((_, idx) => {
            const heights = [20, 35, 12, 45, 60, 20, 75, 40, 50, 65, 15, 42, 55, 30, 65, 45, 25, 55, 70, 40, 80, 22, 50, 60, 30, 68, 48, 20, 38, 55, 12, 35, 45, 20, 58, 38, 14, 25, 42, 55];
            const activeStep = Math.floor((audioProgress / 100) * 40);
            const isPast = idx < activeStep;
            const isActive = idx === activeStep;
            return (
              <div
                key={idx}
                style={{ height: `${heights[idx]}%` }}
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

        <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono px-1">
          <span>
            {Math.floor((audioProgress / 100) * durationSeconds / 60)}:
            {String(Math.floor((audioProgress / 100) * durationSeconds % 60)).padStart(2, '0')}
          </span>
          <span className="text-amber-400 font-medium">
            {isFullUnlocked ? 'Ficheiro completo desbloqueado' : 'Preview liberado antes do pagamento'}
          </span>
          <span>{isFullUnlocked ? '3:05' : '0:30'}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPlayPause}
            className="flex-grow py-3.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-stone-950 font-black text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer active:scale-[0.99] transition-transform"
          >
            {isPlaying ? (
              <><Pause className="w-4 h-4 fill-stone-950 text-stone-950 shrink-0" /><span className="sm:inline hidden">PAUSAR MÚSICA</span><span className="sm:hidden">PAUSAR</span></>
            ) : (
              <><Play className="w-4 h-4 fill-stone-950 text-stone-950 shrink-0" /><span className="sm:inline hidden">{isFullUnlocked ? 'REPRODUZIR MÚSICA COMPLETA' : 'OUVIR PREVIEW 30S'}</span><span className="sm:hidden">{isFullUnlocked ? 'REPRODUZIR' : 'PREVIEW'}</span></>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="p-3 bg-stone-900 hover:bg-stone-850 hover:text-white rounded-xl border border-stone-850 text-stone-400 cursor-pointer transition-colors"
            title="Silenciar"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={onDownloadMP3}
          disabled={!hasAudio || !isFullUnlocked}
          className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 border text-xs font-semibold transition-all ${
            hasAudio && isFullUnlocked
              ? 'bg-stone-900 hover:bg-stone-850 text-stone-200 hover:text-white border-stone-800 cursor-pointer'
              : 'bg-stone-950 text-stone-600 border-stone-900 cursor-not-allowed'
          }`}
        >
          <Download className={`w-4 h-4 shrink-0 ${hasAudio && isFullUnlocked ? 'text-emerald-400' : 'text-stone-700'}`} />
          <span className="sm:inline hidden">{isFullUnlocked ? 'Descarregar Áudio (MP3)' : 'Completa após pagamento aprovado'}</span>
          <span className="sm:hidden">{isFullUnlocked ? 'MP3' : 'Bloqueado'}</span>
        </button>

        <button
          type="button"
          onClick={onDownloadLyrics}
          className="py-3 px-4 bg-stone-900 hover:bg-stone-850 text-stone-200 hover:text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-stone-800 cursor-pointer transition-all"
        >
          <FileText className="w-4 h-4 shrink-0 text-amber-500" />
          <span className="sm:inline hidden">Descarregar Letra (PDF/Texto)</span>
          <span className="sm:hidden">Letra</span>
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="font-serif text-xl font-bold text-stone-100">
          {songTitle || `A canção de ${recipientName}`}
        </h3>
        <p className="text-xs text-stone-500 font-mono tracking-tight leading-relaxed max-w-xs mx-auto">
          Eternizando rimas sinceras sobre {recipientNick} em {whereItHappened || 'Angola'}.
        </p>
      </div>
    </div>
  );
});
