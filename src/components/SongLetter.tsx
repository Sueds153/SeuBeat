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

  return `Minha querida ${recipientName} (${recipientNick}),\n\nEscrevo estas palavras com o coração totalmente aberto e transbordando de carinho. Há momentos na vida que ficam gravados para sempre na alma, e um deles é, sem dúvida, ${memory || 'tudo o que partilhámos juntos'} que aconteceu em ${whereItHappened || 'Angola'}.\n\nQuero que saibas que o teu sorriso ilumina os meus dias mais cinzentos e que a tua presença traz uma paz inigualável. Criar esta canção personalizada no estúdio SeuBeat foi a forma mais profunda e sincera que encontrei de eternizar o nosso companheirismo e declarar o meu carinho inabalável por ti.\n\nCom todo o amor do mundo,\n${userNick}`;
}

export default function SongLetter(props: SongLetterProps) {
  return (
    <div className="bg-gradient-to-b from-stone-900/30 to-stone-950/80 rounded-[32px] p-6 md:p-10 border border-stone-850/60 space-y-6 text-left relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full filter blur-[50px]" />

      <div className="border-b border-stone-850/60 pb-4">
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold">A Carta Dedicatória Escrita do Coração</span>
        <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-stone-100 mt-1">Palavras De Sentimento Verdadeiro ✍️</h2>
      </div>

      <div className="bg-stone-950 p-6 md:p-8 rounded-2xl border border-stone-850 font-serif text-sm md:text-base leading-relaxed text-stone-300 max-w-3xl whitespace-pre-wrap italic">
        {getFullComposedLetter(props)}
      </div>
    </div>
  );
}
