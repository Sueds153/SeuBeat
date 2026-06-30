interface SongLyricsProps {
  lyrics: string[];
  audioProgress: number;
}

export default function SongLyrics({ lyrics, audioProgress }: SongLyricsProps) {
  const lines = lyrics.length > 0 ? lyrics : [
    'Desde o dia em que te conheci, minha querida,',
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
    <div className="bg-stone-950/40 p-5 rounded-2xl border border-stone-850 text-center space-y-3">
      <span className="text-[9px] font-mono text-stone-550 tracking-widest uppercase block border-b border-stone-900 pb-1.5">
        LETRA COMPLICADA SÍNCRONA:
      </span>
      <div className="max-h-[140px] overflow-y-auto space-y-2 py-1 scrollbar-thin">
        {lines.map((line, idx) => {
          const currentIdx = Math.min(Math.floor((audioProgress / 100) * lines.length), lines.length - 1);
          const isCurrent = idx === currentIdx;
          const isPast = idx < currentIdx;

          return (
            <p
              key={idx}
              className={`text-xs md:text-sm font-serif transition-all duration-300 ${
                isCurrent
                  ? 'text-amber-400 font-bold scale-105 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.15)]'
                  : isPast
                  ? 'text-stone-500 font-light line-through decoration-stone-800'
                  : 'text-stone-300'
              }`}
            >
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}
