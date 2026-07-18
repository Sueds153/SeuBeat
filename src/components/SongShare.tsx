import { useState } from 'react';
import { Share2, Check, Link } from 'lucide-react';

interface SongShareProps {
  songId: string;
  recipientName: string;
  recipientNick: string;
  userNick: string;
  musicStyle: string;
  memory: string;
  whereItHappened: string;
  letter: string;
}

export default function SongShare(props: SongShareProps) {
  const [copiedType, setCopiedType] = useState<'link' | null>(null);

  const getShareUrl = () => {
    const slug = props.recipientName.toLowerCase().replace(/\s+/g, '-');
    return `${window.location.origin}/song/${encodeURIComponent(slug)}?id=${props.songId}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopiedType('link');
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="bg-[#181818] rounded-2xl border border-white/5 p-6 md:p-8 space-y-5 text-center">
      <div className="space-y-2">
        <div className="w-10 h-10 rounded-full bg-[#1DB954]/10 flex items-center justify-center mx-auto">
          <Share2 className="w-5 h-5 text-[#1DB954]" />
        </div>
        <h3 className="text-lg font-bold text-white">Partilha esta dedicatória 💍</h3>
        <p className="text-sm text-[#b3b3b3] max-w-sm mx-auto">
          Envia o link para <span className="text-white font-semibold">{props.recipientName}</span> ouvir a música criada especialmente para ela.
        </p>
      </div>

      {/* Share URL preview */}
      <div className="flex items-center gap-2 bg-[#121212] border border-white/10 rounded-lg px-3 py-2.5 max-w-md mx-auto text-left">
        <Link className="w-3.5 h-3.5 text-[#535353] flex-shrink-0" />
        <span className="text-[11px] text-[#b3b3b3] font-mono truncate flex-1">
          seubeat.onrender.com/song/{props.recipientName.toLowerCase().replace(/\s+/g, '-')}
        </span>
      </div>

      <button
        onClick={copyToClipboard}
        className={`inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${
          copiedType === 'link'
            ? 'bg-[#1DB954] text-black scale-95'
            : 'bg-white text-black hover:scale-105 hover:bg-[#f0f0f0]'
        }`}
      >
        {copiedType === 'link' ? (
          <><Check className="w-4 h-4" /> Link Copiado!</>
        ) : (
          <><Share2 className="w-4 h-4" /> Copiar Link</>
        )}
      </button>
    </div>
  );
}
