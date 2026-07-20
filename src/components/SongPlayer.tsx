import { forwardRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, FileText, Lock } from 'lucide-react';

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
  const elapsed = Math.floor((audioProgress / 100) * durationSeconds);
  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const totalStr = isFullUnlocked ? '3:05' : '0:30';

  const heights = [20,35,12,45,60,20,75,40,50,65,15,42,55,30,65,45,25,55,70,40,80,22,50,60,30,68,48,20,38,55,12,35,45,20,58,38,14,25,42,55];

  return (
    <div className="bg-stone-900/40 rounded-2xl border border-stone-800/60 p-5 md:p-6 space-y-5">

      {/* Mode badge */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-stone-400 font-medium truncate max-w-[70%] md:max-w-[60%]">
          {songTitle || `A canção de ${recipientName}`}
        </span>
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isFullUnlocked
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            : 'bg-stone-800 text-stone-400 border border-stone-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isFullUnlocked ? 'bg-amber-500 animate-pulse' : 'bg-stone-500'}`} />
          {isFullUnlocked ? 'MÚSICA COMPLETA' : 'PREVIEW 30S'}
        </span>
      </div>

      {/* Waveform */}
      <div className="h-12 flex items-end gap-[2px] px-1">
        {heights.map((h, idx) => {
          const activeStep = Math.floor((audioProgress / 100) * heights.length);
          const isPast = idx < activeStep;
          const isActive = idx === activeStep;
          return (
            <div
              key={idx}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-sm transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-t from-amber-500 to-rose-500 animate-pulse'
                  : isPast
                  ? 'bg-amber-500/70'
                  : 'bg-stone-700/40'
              }`}
            />
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1 group/slider">
        <div className="relative h-0.5 bg-stone-800 rounded-full cursor-pointer">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all relative"
            style={{ width: `${audioProgress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400 shadow-md shadow-amber-500/40 opacity-0 group-hover/slider:opacity-100 transition-all scale-0 group-hover/slider:scale-100" />
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
          <span>{elapsedStr}</span>
          <span className="text-amber-400 text-[10px] font-medium">
            {isFullUnlocked ? 'Áudio completo desbloqueado' : 'Preview antes do pagamento'}
          </span>
          <span>{totalStr}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPlayPause}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-amber-500/30 flex-shrink-0 cursor-pointer"
        >
          {isPlaying
            ? <><Pause className="w-5 h-5 fill-stone-950 text-stone-950" /><span className="sr-only">PAUSAR MÚSICA</span></>
            : <><Play className="w-5 h-5 fill-stone-950 text-stone-950 ml-0.5" /><span className="sr-only">{isFullUnlocked ? 'REPRODUZIR MÚSICA COMPLETA' : 'REPRODUZIR PREVIEW'}</span></>
          }
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          title="Silenciar"
          className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors cursor-pointer flex-shrink-0"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <span className="text-[11px] text-stone-500 truncate flex-1 hidden sm:block">
          {whereItHappened ? `${recipientNick} · Gravado em ${whereItHappened}` : recipientNick || 'Uma dedicatória única'}
        </span>
      </div>

      {/* Download buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-stone-800/60">
        <button
          type="button"
          onClick={onDownloadMP3}
          disabled={!hasAudio || !isFullUnlocked}
          aria-label={isFullUnlocked ? 'Descarregar Áudio MP3' : 'Completa após pagamento aprovado'}
          className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
            hasAudio && isFullUnlocked
              ? 'bg-stone-800 hover:bg-stone-700 text-stone-100 cursor-pointer'
              : 'bg-stone-900 text-stone-600 cursor-not-allowed'
          }`}
        >
          {hasAudio && isFullUnlocked
            ? <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            : <Lock className="w-3.5 h-3.5 shrink-0" />
          }
          <span className="hidden sm:inline">{isFullUnlocked ? 'Descarregar Áudio (MP3)' : 'Completa após pagamento aprovado'}</span>
          <span className="sm:hidden">{isFullUnlocked ? 'MP3' : 'Bloqueado'}</span>
        </button>

        <button
          type="button"
          onClick={onDownloadLyrics}
          className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="hidden sm:inline">Descarregar Letra (PDF/Texto)</span>
          <span className="sm:hidden">Letra</span>
        </button>
      </div>
    </div>
  );
});
