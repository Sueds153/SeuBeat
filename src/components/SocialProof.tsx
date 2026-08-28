import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music } from 'lucide-react';
import { useSocialProof, formatMinutesAgo } from '../lib/socialProof';

const STYLE_COLORS: Record<string, string> = {
  kizomba: 'bg-pink-500',
  semba: 'bg-orange-500',
  'r&b': 'bg-purple-500',
  gospel: 'bg-yellow-500',
  'romantic pop': 'bg-red-500',
  zouk: 'bg-cyan-500',
  kuduro: 'bg-green-500',
  rap: 'bg-gray-500',
  afrobeat: 'bg-emerald-500',
  reggae: 'bg-lime-500',
  acoustic: 'bg-amber-500',
  samba: 'bg-rose-500',
  'hino': 'bg-indigo-500',
};

const STYLE_LABELS: Record<string, string> = {
  'r&b': 'R&B',
  'romantic pop': 'Pop Romântico',
  'hino': 'Hino',
};

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() ?? '?';
}

function getStyleColor(style: string | null): string {
  if (!style) return 'bg-amber-500';
  return STYLE_COLORS[style.toLowerCase()] ?? 'bg-amber-500';
}

function getStyleLabel(style: string | null): string {
  if (!style) return '';
  return STYLE_LABELS[style.toLowerCase()] ?? style.charAt(0).toUpperCase() + style.slice(1);
}

interface ProofMessage {
  id: string;
  name: string | null;
  initials: string;
  colorClass: string;
  action: string;
  styleLabel: string;
  minutesAgo: number;
  timeLabel: string;
}

export default function SocialProof() {
  const proof = useSocialProof(30_000);
  const [current, setCurrent] = useState<ProofMessage | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const buildMessages = useCallback((): ProofMessage[] => {
    const msgs: ProofMessage[] = [];
    if (proof.lastPayment?.firstName) {
      const s = proof.lastPayment.style;
      msgs.push({
        id: `pay-${proof.lastPayment.minutesAgo}`,
        name: proof.lastPayment.firstName,
        initials: getInitials(proof.lastPayment.firstName),
        colorClass: getStyleColor(s),
        action: 'comprou uma música',
        styleLabel: getStyleLabel(s),
        minutesAgo: proof.lastPayment.minutesAgo,
        timeLabel: formatMinutesAgo(proof.lastPayment.minutesAgo),
      });
    }
    if (proof.lastActivity?.firstName) {
      const s = proof.lastActivity.style;
      msgs.push({
        id: `act-${proof.lastActivity.minutesAgo}`,
        name: proof.lastActivity.firstName,
        initials: getInitials(proof.lastActivity.firstName),
        colorClass: getStyleColor(s),
        action: 'está a criar uma música',
        styleLabel: getStyleLabel(s),
        minutesAgo: proof.lastActivity.minutesAgo,
        timeLabel: formatMinutesAgo(proof.lastActivity.minutesAgo),
      });
    }
    return msgs;
  }, [proof]);

  useEffect(() => {
    const msgs = buildMessages();
    if (msgs.length === 0) return;

    let alive = true;
    let idx = 0;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const show = () => {
      if (!alive) return;
      const msg = msgs[idx % msgs.length];
      setCurrent(msg);
      setIsVisible(true);
      hideTimer = setTimeout(() => {
        if (!alive) return;
        setIsVisible(false);
        showTimer = setTimeout(() => {
          idx++;
          show();
        }, 15_000);
      }, 8_000);
    };

    const initial = setTimeout(() => show(), 4_000);

    return () => {
      alive = false;
      clearTimeout(initial);
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [buildMessages]);

  return (
    <div className="fixed bottom-4 left-4 z-50 pointer-events-none max-w-xs w-[calc(100vw-2rem)] sm:w-auto">
      <AnimatePresence>
        {isVisible && current && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="pointer-events-auto bg-stone-900/95 backdrop-blur-md border border-stone-800 rounded-2xl p-3 shadow-2xl flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-full ${current.colorClass} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
              {current.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-stone-100 leading-snug truncate">
                {current.name} {current.action}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {current.styleLabel && (
                  <>
                    <Music className="w-3 h-3 text-stone-500 shrink-0" />
                    <span className="text-[10px] text-stone-400 truncate">{current.styleLabel}</span>
                    <span className="text-stone-600 text-[10px]">·</span>
                  </>
                )}
                <span className="text-[10px] text-stone-500 whitespace-nowrap">{current.timeLabel}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                <span className="text-[8px] text-stone-600 uppercase tracking-widest font-mono">Em tempo real</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
