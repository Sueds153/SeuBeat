interface SongLetterProps {
  recipientName: string;
  recipientNick: string;
  userNick: string;
  memory: string;
  whereItHappened: string;
  letter: string;
}

function getFullComposedLetter(props: SongLetterProps): string {
  const { recipientName, recipientNick, userNick, memory, whereItHappened, letter } = props;
  if (letter) return letter;
  return `Querido(a) ${recipientName} (${recipientNick}),\n\nEscrevo estas palavras com o coração totalmente aberto e transbordando de carinho. Há momentos na vida que ficam gravados para sempre na alma, e um deles é, sem dúvida, ${memory || 'tudo o que partilhámos juntos'} que aconteceu em ${whereItHappened || 'Angola'}.\n\nQuero que saibas que o teu sorriso ilumina os meus dias mais cinzentos e que a tua presença traz uma paz inigualável. Criar esta canção personalizada no estúdio SeuBeat foi a forma mais profunda e sincera que encontrei de eternizar o nosso companheirismo e declarar o meu carinho inabalável por ti.\n\nCom todo o amor do mundo,\n${userNick}`;
}

export default function SongLetter(props: SongLetterProps) {
  return (
    <div className="bg-[#181818] rounded-2xl border border-white/5 p-6 md:p-8 space-y-5">

      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1DB954]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-base">✍️</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-[#1DB954] uppercase tracking-widest block">Carta Dedicatória</span>
          <h2 className="text-base font-bold text-white">Palavras do Coração</h2>
        </div>
      </div>

      <div className="relative">
        {/* Decorative quote mark */}
        <span className="absolute -top-2 -left-1 text-5xl text-[#1DB954]/10 font-serif leading-none select-none">"</span>
        <div className="bg-[#121212] rounded-xl border border-white/5 p-5 md:p-6 font-serif text-sm md:text-base leading-relaxed text-[#b3b3b3] whitespace-pre-wrap italic pl-6">
          {getFullComposedLetter(props)}
        </div>
        <span className="absolute -bottom-3 right-2 text-5xl text-[#1DB954]/10 font-serif leading-none select-none rotate-180">"</span>
      </div>
    </div>
  );
}
