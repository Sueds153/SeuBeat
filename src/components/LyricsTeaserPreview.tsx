import React from 'react';
import { Lock, Music, Clock, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { LyricsTeaser } from '../lib/lyricsTeaser';

interface LyricsTeaserPreviewProps {
  teaser: LyricsTeaser;
  onUnlockClick?: () => void;
}

export function LyricsTeaserPreview({ teaser, onUnlockClick }: LyricsTeaserPreviewProps) {
  const totalHiddenLines = teaser.hiddenSections.reduce((sum, s) => sum + s.lines.length, 0);
  const firstVisible = teaser.visibleSections[0];
  const secondVisible = teaser.visibleSections[1];
  const sneakPeek = teaser.hiddenSections[0];

  if (!firstVisible) return null;

  return (
    <div className="space-y-3">
      {/* Banner de urgencia */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
        <Clock className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] font-mono text-amber-400">
          Letra reservada por tempo limitado
        </span>
      </div>

      {/* Primeira secção — como poesia */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-6 px-5 bg-stone-900/40 rounded-2xl border border-stone-800"
      >
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500/70 uppercase tracking-widest mb-3">
          <Music className="w-3 h-3" /> {firstVisible.label}
        </span>
        <div className="space-y-2">
          {firstVisible.lines.map((line, i) => (
            <p key={i} className="text-stone-200 text-base md:text-lg font-serif leading-relaxed italic">
              {line}
            </p>
          ))}
        </div>
      </motion.div>

      {/* Segunda secção — sneak peek parcial */}
      {secondVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-center py-5 px-5 bg-stone-900/20 rounded-2xl border border-stone-800/50"
        >
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-2">
            <Music className="w-3 h-3" /> {secondVisible.label}
          </span>
          <div className="space-y-1.5">
            {secondVisible.lines.map((line, i) => (
              <p key={i} className="text-stone-300 text-sm md:text-base font-serif leading-relaxed italic">
                {line}
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* Cortina gradiente + mini-preview de uma 3ª secção */}
      <div className="relative">
        <div className="h-24 bg-gradient-to-b from-stone-900/40 via-stone-900/80 to-[#151210] rounded-xl" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          {sneakPeek && (
            <div className="space-y-0.5 opacity-30 max-w-[70%]">
              <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">{sneakPeek.label}</span>
              {sneakPeek.lines.slice(0, 2).map((line, i) => (
                <p key={i} className="text-stone-400 text-xs font-serif italic text-center truncate">
                  {line}
                </p>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <ChevronDown className="w-3 h-3 text-stone-500 animate-bounce" />
            <span className="text-stone-400 text-[11px] font-mono font-medium">
              +{teaser.hiddenSections.length} secções por desvendar
            </span>
            <ChevronDown className="w-3 h-3 text-stone-500 animate-bounce" />
          </div>
        </div>
      </div>

      {/* CTA persuasivo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
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
