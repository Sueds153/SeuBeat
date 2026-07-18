interface SongLyricsProps {
  lyrics: string[];
  audioProgress: number;
}

export default function SongLyrics({ lyrics, audioProgress }: SongLyricsProps) {
  const lines = lyrics.length > 0 ? lyrics : [
    'Desde o dia em que te conheci, querido(a),',
    'O meu peito rebate no compasso de um ritmo profundo.',
    'Estávamos juntos em Angola, recordas-te meu bem?',
    'Aquele momento em que trocámos o nosso primeiro olhar sincero.',
    'O teu sorriso brilha mais que o luar na baía,',
    'Com o teu amor aqueces o meu peito de harmonia e alegria.',
    'Ao som deste Kizomba, declaro-te toda a minha afeição,',
    'És a eterna comandante do meu fiel coração.',
    'Prometo amar-te todos os dias, com alma e dignidade,',
    'Do teu companheiro dedicado de verdade.'
  ];

  return (
    <div className="bg-[#181818] rounded-2xl border border-white/5 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-xs font-bold text-white uppercase tracking-widest">Letra</span>
        <span className="text-[10px] text-[#b3b3b3] font-mono">Sincronizada com o áudio</span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#535353] scrollbar-track-transparent">
        {lines.map((line, idx) => {
          const currentIdx = Math.min(Math.floor((audioProgress / 100) * lines.length), lines.length - 1);
          const isCurrent = idx === currentIdx;
          const isPast = idx < currentIdx;

          // Section headers like [Refrão], [Verso 1] etc.
          const isHeader = /^\[.+\]$/.test(line.trim());

          if (isHeader) {
            return (
              <p key={idx} className="text-[10px] font-bold text-[#535353] uppercase tracking-widest mt-4 first:mt-0">
                {line.replace(/[\[\]]/g, '')}
              </p>
            );
          }

          return (
            <p
              key={idx}
              className={`text-sm font-medium leading-relaxed transition-all duration-300 ${
                isCurrent
                  ? 'text-white scale-[1.01] origin-left'
                  : isPast
                  ? 'text-[#535353]'
                  : 'text-[#b3b3b3]'
              }`}
            >
              {isCurrent && (
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2 mb-0.5 shadow-lg shadow-amber-500/40 animate-pulse" />
              )}
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}
