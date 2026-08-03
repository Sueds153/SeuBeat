import React, { useState, useEffect } from 'react';
import { Edit2, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  LyricsTeaser, 
  LyricSection, 
  loadTeaserEdits, 
  saveTeaserEdits, 
  getTeaserStorageKey,
  clearTeaserEdits,
  isTeaserEnabled 
} from '../lib/lyricsTeaser';

interface LyricsTeaserPreviewProps {
  teaser: LyricsTeaser;
  requestId: string;
  onEditChange?: (sectionLabel: string, lines: string[]) => void;
  onUnlockClick?: () => void;
}

export function LyricsTeaserPreview({ 
  teaser, 
  requestId, 
  onEditChange, 
  onUnlockClick 
}: LyricsTeaserPreviewProps) {
  const [edits, setEdits] = useState<Record<string, string[]>>(() => 
    loadTeaserEdits(requestId)
  );
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    const saved = loadTeaserEdits(requestId);
    setEdits(saved);
  }, [requestId]);

  const handleLineChange = (section: LyricSection, lineIndex: number, value: string) => {
    const currentSectionEdits = edits[section.label] || [...section.lines];
    const newLines = [...currentSectionEdits];
    newLines[lineIndex] = value;
    const updatedEdits = { ...edits, [section.label]: newLines };
    setEdits(updatedEdits);
    saveTeaserEdits(requestId, updatedEdits);
    onEditChange?.(section.label, newLines);
  };

  const renderSection = (section: LyricSection, isVisible: boolean) => {
    const sectionEdits = edits[section.label] || section.lines;
    
    return (
      <motion.div
        key={section.label}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`space-y-2 p-4 rounded-xl border transition-all ${
          isVisible 
            ? 'bg-stone-900/50 border-stone-800' 
            : 'bg-stone-950/30 border-stone-850/50 opacity-70'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-amber-500 uppercase tracking-wider">
            {section.type === 'chorus' ? '🎵' : '📝'} {section.label}
          </span>
          {!isVisible && (
            <span className="text-[10px] text-stone-500 font-mono px-2 py-0.5 rounded bg-stone-800">
              BLOQUEADO
            </span>
          )}
        </div>

        {isVisible ? (
          <div className="space-y-2">
            {sectionEdits.map((line, idx) => (
              <div key={idx} className="relative">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => handleLineChange(section, idx, e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-lg text-stone-100 outline-none text-sm font-medium transition-colors placeholder-stone-500"
                  placeholder={isVisible ? undefined : 'Desbloqueie para ver e editar...'}
                  disabled={!isVisible}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {section.lines.map((line, idx) => (
              <div key={idx} className="relative">
                <div className="w-full px-3 py-2 bg-stone-950 border border-stone-850 rounded-lg text-stone-500 text-sm font-medium">
                  <span className="blur-sm select-none">{'█'.repeat(Math.min(line.length, 60))}</span>
                  <span className="text-[10px] text-stone-600 ml-2">({line.length} caracteres)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  const totalHiddenLines = teaser.hiddenSections.reduce((sum, s) => sum + s.lines.length, 0);

  return (
    <div className="space-y-4">
      {/* Visible/editable sections */}
      <div className="space-y-3">
        {teaser.visibleSections.map(section => renderSection(section, true))}
      </div>

      {/* Hidden sections preview */}
      {teaser.hiddenSections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-t border-stone-850">
            <span className="text-xs font-mono text-stone-500">
              {teaser.hiddenSections.length} secções bloqueadas · {totalHiddenLines} linhas
            </span>
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="text-[10px] font-mono text-amber-500 hover:text-amber-400 flex items-center gap-1"
            >
              {showHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showHidden ? 'Ocultar' : 'Ver estrutura'}
            </button>
          </div>

          {showHidden && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 mt-2"
            >
              {teaser.hiddenSections.map(section => renderSection(section, false))}
            </motion.div>
          )}
        </div>
      )}

      {/* Unlock CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 p-4 bg-gradient-to-r from-amber-500/10 to-rose-600/10 border border-amber-500/20 rounded-xl text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span className="text-xs font-mono text-amber-500 uppercase tracking-wider">
            Desbloquear Letra Completa + Áudio
          </span>
        </div>
        <p className="text-stone-400 text-xs mb-3 max-w-md mx-auto">
          Aceda à letra completa, edite todas as secções e receba o áudio personalizado na sua caixa de email.
        </p>
        <button
          onClick={onUnlockClick}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-xs rounded-xl hover:from-amber-400 hover:to-rose-500 transition-all shadow-lg shadow-amber-500/20"
        >
          <Lock className="w-4 h-4" />
          Confirmar Plano e Desbloquear
        </button>
      </motion.div>
    </div>
  );
}

export default LyricsTeaserPreview;