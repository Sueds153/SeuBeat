import React from 'react';
import { Lock, Music, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { LyricsTeaser } from '../lib/lyricsTeaser';

interface LyricsTeaserPreviewProps {
  teaser: LyricsTeaser;
  onUnlockClick?: () => void;
}

export function LyricsTeaserPreview({ teaser, onUnlockClick }: LyricsTeaserPreviewProps) {
  const totalHiddenLines = teaser.hiddenSections.reduce((sum, s) => sum + s.lines.length, 0);
  const visibleSection = teaser.visibleSections[0];

  if (!visibleSection) return null;

  return (
    <div className="space-y-4">
      {/* Banner de urgencia subtil */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
        <Clock className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] font-mono text-amber-400">
          Letra reservada por tempo limitado
        </span>
      </div>

      {/* Seccao emocional — como poesia */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-8 px-6 bg-stone-900/40 rounded-2xl border border-stone-800"
      >
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500/70 uppercase tracking-widest mb-4">
          <Music className="w-3 h-3" /> {visibleSection.label}
        </span>

        <div className="space-y-2">
          {visibleSection.lines.map((line, i) => (
            <p key={i} className="text-stone-200 text-base md:text-lg font-serif leading-relaxed italic">
              {line}
            </p>
          ))}
        </div>
      </motion.div>

      {/* Cortina gradiente + contador de seccoes bloqueadas */}
      <div className="relative">
        <div className="h-16 bg-gradient-to-b from-stone-900/60 to-[#151210] rounded-xl" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-stone-600 text-xs font-mono">
            +{teaser.hiddenSections.length} secções bloqueadas · {totalHiddenLines} linhas
          </span>
        </div>
      </div>

      {/* CTA persuasivo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-2"
      >
        <button
          onClick={onUnlockClick}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-xs rounded-xl hover:from-amber-400 hover:to-rose-500 transition-all shadow-lg shadow-amber-500/20"
        >
          <Lock className="w-4 h-4" />
          Garantir a Minha Música
        </button>
        <p className="text-stone-500 text-[10px]">
          Aceda à letra completa e valide antes de gerarmos a música.
        </p>
      </motion.div>
    </div>
  );
}

export default LyricsTeaserPreview;
