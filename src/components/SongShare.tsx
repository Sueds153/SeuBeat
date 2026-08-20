import { useState } from 'react';
import { Share2, Check, Link, MessageCircle, Instagram, Sparkles, X, Music } from 'lucide-react';

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
  const [copiedType, setCopiedType] = useState<'link' | 'story' | null>(null);
  const [showStoryModal, setShowStoryModal] = useState(false);

  const getShareUrl = () => {
    const slug = props.recipientName.toLowerCase().replace(/\s+/g, '-');
    return `${window.location.origin}/song/${encodeURIComponent(slug)}?id=${props.songId}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopiedType('link');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const shareWhatsApp = () => {
    const message = `🎵 Fiz uma música personalizada especialmente para a ${props.recipientName}! Ouve aqui: ${getShareUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const copyStoryCaption = () => {
    const caption = `🎵 Fiz uma música personalizada exclusiva para a ${props.recipientName} no SeuBeat! ❤️\n\nEstilo: ${props.musicStyle}\nOuve e sente esta emoção: ${getShareUrl()}`;
    navigator.clipboard.writeText(caption);
    setCopiedType('story');
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="bg-[#181818] rounded-2xl border border-white/5 p-6 md:p-8 space-y-6 text-center shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="space-y-2 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
          <Share2 className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">Partilha esta dedicatória</h3>
        <p className="text-sm text-[#b3b3b3] max-w-sm mx-auto">
          Envia o link para <span className="text-white font-semibold">{props.recipientName}</span> ouvir a música criada especialmente para ela.
        </p>
      </div>

      {/* Share URL preview */}
      <div className="flex items-center gap-2 bg-[#121212] border border-white/10 rounded-xl px-3.5 py-3 max-w-md mx-auto text-left relative z-10">
        <Link className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-[#b3b3b3] font-mono truncate flex-1">
          {getShareUrl()}
        </span>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
        <button
          onClick={copyToClipboard}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
            copiedType === 'link'
              ? 'bg-amber-500 text-stone-950 scale-95 shadow-lg shadow-amber-500/30'
              : 'bg-stone-800 text-white hover:bg-stone-700 border border-white/10 hover:scale-105'
          }`}
        >
          {copiedType === 'link' ? (
            <><Check className="w-4 h-4" /> Link Copiado!</>
          ) : (
            <><Share2 className="w-4 h-4" /> Copiar Link</>
          )}
        </button>

        <button
          onClick={shareWhatsApp}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs md:text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all hover:scale-105 shadow-lg shadow-emerald-600/20 cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </button>

        <button
          onClick={() => setShowStoryModal(true)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs md:text-sm bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white transition-all hover:scale-105 shadow-lg shadow-rose-500/20 cursor-pointer"
        >
          <Instagram className="w-4 h-4" /> Cartão Stories
        </button>
      </div>

      {/* Stories Modal */}
      {showStoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm bg-gradient-to-b from-stone-900 via-stone-950 to-black rounded-3xl border border-amber-500/30 p-6 shadow-2xl space-y-6 text-center">
            <button
              onClick={() => setShowStoryModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-full bg-stone-800/50 hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Vinyl Card Preview (Vertical 9:16 ratio style) */}
            <div className="bg-gradient-to-b from-stone-900 via-[#181818] to-stone-950 rounded-2xl border border-white/10 p-6 space-y-4 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="w-20 h-20 mx-auto rounded-full bg-stone-950 border-4 border-amber-500/40 flex items-center justify-center shadow-xl animate-spin-slow">
                <Music className="w-8 h-8 text-amber-400" />
              </div>

              <div className="space-y-1">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  {props.musicStyle || 'Música Especial'}
                </span>
                <h4 className="text-lg font-black text-white tracking-tight">
                  Para: {props.recipientName}
                </h4>
                <p className="text-xs text-stone-400">De: {props.userNick || 'Alguém especial'}</p>
              </div>

              <div className="p-3 bg-stone-900/80 rounded-xl border border-white/5 text-xs text-stone-300 italic line-clamp-3">
                "{props.letter ? props.letter.slice(0, 120) + '...' : 'Uma declaração em forma de música criada exclusivamente.'}"
              </div>

              <div className="pt-2 flex items-center justify-between text-[10px] text-stone-500 font-mono border-t border-white/5">
                <span className="font-bold tracking-wider text-amber-400">SEUBEAT.COM</span>
                <span>🎵 Exclusivo</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="space-y-3">
              <button
                onClick={copyStoryCaption}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {copiedType === 'story' ? (
                  <><Check className="w-4 h-4" /> Texto Copiado para os Stories!</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Copiar Legenda & Link para Stories</>
                )}
              </button>
              <p className="text-[11px] text-stone-400">
                Copie o texto acima, tire print do cartão e cole nos seus Stories do Instagram ou WhatsApp!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
