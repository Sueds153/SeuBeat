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
    <div className="bg-[#181818] rounded-2xl border border-white/5 p-5 md:p-6 space-y-5">

      {/* Mode badge */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#b3b3b3] font-medium">
          {songTitle || `A canção de ${recipientName}`}
        </span>
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isFullUnlocked
            ? 'bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20'
            : 'bg-white/5 text-[#b3b3b3] border border-white/10'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isFullUnlocked ? 'bg-[#1DB954] animate-pulse' : 'bg-[#b3b3b3]'}`} />
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
                  ? 'bg-white'
                  : isPast
                  ? 'bg-[#1DB954]'
                  : 'bg-[#535353]'
              }`}
            />
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1 bg-[#535353] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1DB954] rounded-full transition-all"
            style={{ width: `${audioProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[#b3b3b3] font-mono">
          <span>{elapsedStr}</span>
          <span className="text-[#1DB954] text-[10px] font-medium">
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
          className="w-12 h-12 rounded-full bg-[#1DB954] hover:bg-[#1ed760] hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-[#1DB954]/20 flex-shrink-0 cursor-pointer"
        >
          {isPlaying
            ? <><Pause className="w-5 h-5 fill-black text-black" /><span className="sr-only">PAUSAR MÚSICA</span></>
            : <><Play className="w-5 h-5 fill-black text-black ml-0.5" /><span className="sr-only">{isFullUnlocked ? 'REPRODUZIR MÚSICA COMPLETA' : 'REPRODUZIR PREVIEW'}</span></>
          }
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          title="Silenciar"
        className="w-9 h-9 rounded-full bg-[#282828] hover:bg-[#333] flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors cursor-pointer flex-shrink-0"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <span className="text-[11px] text-[#b3b3b3] truncate flex-1 hidden sm:block">
          {whereItHappened ? `${recipientNick} · Gravado em ${whereItHappened}` : recipientNick || 'Uma dedicatória única'}
        </span>
      </div>

      {/* Download buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
        <button
          type="button"
          onClick={onDownloadMP3}
          disabled={!hasAudio || !isFullUnlocked}
          className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
            hasAudio && isFullUnlocked
              ? 'bg-[#282828] hover:bg-[#333] text-white cursor-pointer'
              : 'bg-[#1a1a1a] text-[#535353] cursor-not-allowed'
          }`}
        aria-label={isFullUnlocked ? 'Descarregar Áudio MP3' : 'Completa após pagamento aprovado'}
        >
          {hasAudio && isFullUnlocked
            ? <Download className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
            : <Lock className="w-3.5 h-3.5 shrink-0" />
          }
          <span className="hidden sm:inline">{isFullUnlocked ? 'Descarregar Áudio (MP3)' : 'Completa após pagamento aprovado'}</span>
          <span className="sm:hidden">{isFullUnlocked ? 'MP3' : 'Bloqueado'}</span>
        </button>

        <button
          type="button"
          onClick={onDownloadLyrics}
          className="py-2.5 px-3 bg-[#282828] hover:bg-[#333] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <FileText className="w-3.5 h-3.5 text-[#b3b3b3] shrink-0" />
          <span className="hidden sm:inline">Descarregar Letra (PDF/Texto)</span>
          <span className="sm:hidden">Letra</span>
        </button>
      </div>
    </div>
  );
});
