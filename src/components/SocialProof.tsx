import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

const NOTIFICATIONS = [
  { id: 1, text: '❤️ Mais uma canção foi criada para uma mãe', type: 'love' },
  { id: 2, text: '💕 Uma declaração de amor acabou de ser criada', type: 'romance' },
  { id: 3, text: '🎂 Uma música de aniversário foi criada há instantes', type: 'birthday' },
  { id: 4, text: '💍 Um pedido de casamento está a ser transformado em música', type: 'proposal' }
];

export default function SocialProof() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const show = () => {
      if (!alive) return;
      setIsVisible(true);
      setTimeout(() => {
        if (!alive) return;
        setIsVisible(false);
        setTimeout(() => {
          if (!alive) return;
          setCurrentIndex((prev) => (prev + 1) % NOTIFICATIONS.length);
        }, 500);
      }, 5000);
    };

    const initial = setTimeout(() => {
      show();
      intervalId = setInterval(() => { show(); }, 12000);
    }, 3000);

    return () => {
      alive = false;
      clearTimeout(initial);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  const current = NOTIFICATIONS[currentIndex];

  return (
    <div className="fixed bottom-4 left-4 z-50 pointer-events-none max-w-sm w-[calc(100vw-2rem)] sm:w-auto">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="pointer-events-auto bg-stone-900/90 backdrop-blur-md border border-stone-800 text-stone-100 rounded-2xl p-4 shadow-xl flex items-center gap-3 pr-5"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Sparkles className="w-4 h-4 text-amber-400 animate-[pulse_2s_infinite]" />
            </div>
            <div>
              <p className="text-xs sm:text-xs font-sans font-medium text-stone-200 leading-snug">
                {current.text}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                <span className="text-[9px] text-stone-500 uppercase tracking-widest font-mono">Em tempo real • Angola</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
