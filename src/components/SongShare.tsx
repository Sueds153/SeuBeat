import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface SongShareProps {
  recipientName: string;
  recipientNick: string;
  userNick: string;
  musicStyle: string;
  memory: string;
  whereItHappened: string;
  letter: string;
}

function getFullComposedLetter(props: Pick<SongShareProps, 'recipientName' | 'recipientNick' | 'userNick' | 'memory' | 'whereItHappened' | 'letter'>): string {
  if (props.letter) return props.letter;
  return `Querido(a) ${props.recipientName} (${props.recipientNick}),\n\nEscrevo estas palavras com o coração totalmente aberto e transbordando de carinho. Há momentos na vida que ficam gravados para sempre na alma, e um deles é, sem dúvida, ${props.memory || 'tudo o que partilhámos juntos'} que aconteceu em ${props.whereItHappened || 'Angola'}.\n\nCom todo o amor do mundo,\n${props.userNick}`;
}

export default function SongShare(props: SongShareProps) {
  const [copiedType, setCopiedType] = useState<'link' | 'share' | null>(null);

  const getShareUrl = () => {
    const p = new URLSearchParams();
    p.set('recipientName', props.recipientName);
    p.set('recipientNick', props.recipientNick);
    p.set('userNick', props.userNick);
    p.set('musicStyle', props.musicStyle);
    p.set('memory', props.memory);
    p.set('whereItHappened', props.whereItHappened);
    p.set('letter', getFullComposedLetter(props));

    return `${window.location.origin}/song/${encodeURIComponent(
      props.recipientName.toLowerCase().replace(/\s+/g, '-')
    )}?${p.toString()}`;
  };

  const copyToClipboard = (type: 'link' | 'share') => {
    navigator.clipboard.writeText(getShareUrl());
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="bg-stone-900/10 rounded-[32px] p-6 md:p-8 border border-stone-850/60 text-center space-y-6">
      <div className="max-w-md mx-auto space-y-2">
        <h3 className="font-serif text-xl font-bold text-stone-100">Partilhe esta página de Dedicatória Especial 💍</h3>
        <p className="text-xs text-stone-400">
          Copie o link individual da página para que o destinatário ouça a sua composição com todo o romance merecido.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-xl mx-auto">
        <button
          onClick={() => copyToClipboard('link')}
          className="w-full sm:w-auto px-6 py-3.5 bg-stone-900 hover:bg-stone-850 text-stone-100 font-bold text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 border border-stone-800 cursor-pointer transition-colors uppercase tracking-wider"
        >
          {copiedType === 'link' ? (
            <><Check className="w-4 h-4 text-emerald-400" /><span>Link Copiado!</span></>
          ) : (
            <><Share2 className="w-4 h-4 text-amber-500" /><span>Copiar Link Dedicatória</span></>
          )}
        </button>
      </div>
    </div>
  );
}
