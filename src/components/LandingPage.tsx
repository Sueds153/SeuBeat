import { ArrowRight, Sparkles, Check, Play, MessageCircle, Menu, X, Shield, Flame, Music2, Crown, Headphones, Trophy, Mic, Gem, Heart, Cake, HandHeart, HeartHandshake, Feather, Zap } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import LogoIcon from './LogoIcon';
import AudioDemo from './AudioDemo';
import Testimonials from './Testimonials';
import VideoTestimonial from './VideoTestimonial';
import { FAQ } from './FAQ';
import { PRICING_PLANS } from '../constants/pricing';
import { WHATSAPP_URL } from '../constants/whatsapp';
import { fbViewContent, parsePrice } from '../lib/metaPixel';
import { gaViewContent, gaInitiateCheckout } from '../lib/analytics';
import { useTypewriter } from '../hooks/useTypewriter';
import { useUtm } from '../hooks/useUtm';
import { useSocialProof } from '../lib/socialProof';
import { safeUUID } from '../lib/uuid';
import { CURRENCY } from '../constants/currency';

interface LandingPageProps {
  onStartWizard: () => void;
}

const NAV_LINKS = [
  { href: '#how-it-works-section', label: 'Como Funciona' },
  { href: '#occasions-section', label: 'Ocasiões' },
  { href: '#audio-demo-section', label: 'Demos' },
  { href: '#pricing-section', label: 'Preços' },
  { href: '#faq-section', label: 'Perguntas' },
];

const OCCASIONS = [
  { icon: Gem, label: 'Aniversário de Casamento', desc: 'Para quem partilha uma vida' },
  { icon: Heart, label: 'Declaração de Amor', desc: 'Diz o que sentes em música' },
  { icon: Cake, label: 'Aniversário', desc: 'Um presente eterno e único' },
  { icon: HandHeart, label: 'Para a Mãe', desc: 'A homenagem que ela merece' },
  { icon: HeartHandshake, label: 'Agradecimento', desc: 'Gratidão que toca a alma' },
  { icon: Feather, label: 'Em Memória', desc: 'Eterniza quem nunca esquecemos' },
];

const OCCASION_REPLIES: Record<string, { msg: string; style: string }> = {
  'Aniversário de Casamento': { msg: 'Uma vida partilhada merece uma banda sonora à altura.', style: 'Kizomba' },
  'Declaração de Amor': { msg: 'Nada diz "amo-te" como uma canção feita só para essa pessoa especial.', style: 'Semba' },
  'Aniversário': { msg: 'O melhor presente não se embrulha — ouve-se.', style: 'Pop' },
  'Para a Mãe': { msg: 'Mãe é única. A música também vai ser.', style: 'Gospel' },
  'Agradecimento': { msg: 'Gratidão que se canta, nunca se esquece.', style: 'Kizomba' },
  'Em Memória': { msg: 'Quem vive no coração nunca parte. Eterniza essa memória em música.', style: 'Semba' },
};

const HERO_VARIANTS = [
  'numa música inesquecível',
  'numa canção que emociona',
  'num presente que não se esquece',
];

function TypewriterQuote() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEnabled(true);
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fullText = '"Ela ouviu e não parou de chorar…\nfoi o melhor presente da minha vida."';
  const { displayed, isDone } = useTypewriter({ text: fullText, speed: 40, enabled });

  return (
    <div ref={ref}>
      <p className="font-serif text-lg md:text-xl text-stone-200 italic leading-snug whitespace-pre-line">
        {displayed.split('\n').map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {i === 1 ? (
              <span className="text-amber-400">{line}</span>
            ) : (
              line
            )}
          </span>
        ))}
        {!isDone && <span className="inline-block w-[2px] h-[1em] bg-amber-400/70 ml-0.5 animate-pulse align-middle" />}
      </p>
    </div>
  );
}

export default function LandingPage({ onStartWizard }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [isStudioOpening, setIsStudioOpening] = useState(false);
  const countRef = useRef<HTMLSpanElement>(null);
  const [showCount, setShowCount] = useState(false);
  const [animatedCount, setAnimatedCount] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);

  const handleStartWizard = () => {
    if (isStudioOpening) return;
    setIsStudioOpening(true);
    setTimeout(() => {
      onStartWizard();
      setIsStudioOpening(false);
    }, 380);
  };

  const socialProof = useSocialProof();
  const todayCount = socialProof.createdToday;

  useUtm();

  useEffect(() => {
    const el = countRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowCount(true);
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!showCount) return;
    const duration = 1500;
    const startTime = performance.now();
    let raf: number;
    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedCount(Math.floor(progress * todayCount));
      if (progress < 1) {
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [showCount, todayCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIdx(prev => (prev + 1) % HERO_VARIANTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight || 1;
      const docHeight = document.documentElement.scrollHeight;
      const nearBottom = docHeight - (scrollY + vh) < vh * 1.2;
      setShowStickyBar(scrollY > vh * 0.6 && !nearBottom);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    fbViewContent('landing', 0, CURRENCY, safeUUID());
    gaViewContent('landing');
  }, []);

  return (
    <div id="landing-page-root" className="relative min-h-screen overflow-x-clip bg-[#151210] text-stone-100 selection:bg-amber-500/30 selection:text-amber-200">
      <style>{`
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        details[open] > div.faq-body { animation: faq-open 0.25s ease-out; }
        @keyframes faq-open {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 500px; }
        }
      `}</style>

      {/* ─── PROMO BAR ─── */}
      <div className="w-full bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-stone-950 text-center py-2 max-sm:py-1.5 px-4 text-xs max-sm:text-[10px] max-sm:leading-tight font-bold tracking-wide z-50 relative">
        {todayCount > 0 ? (
          <><Flame className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />+{todayCount} músicas criadas hoje{'\u00A0'}·{' '}</>
        ) : (
          <>Músicas personalizadas criadas com amor{'\u00A0'}·{' '}</>
        )}
        <span className="underline underline-offset-2">Sem assinatura</span>{' '}
        <span className="max-sm:hidden">· paga apenas quando a letra te encantar</span>
        <span className="sm:hidden">· só pagas quando aprovares</span>
      </div>

      {/* Ambient Background */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-amber-950/15 via-rose-950/10 to-transparent pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[320px] h-[320px] md:w-[500px] md:h-[500px] bg-amber-500/5 rounded-full blur-[90px] md:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[360px] h-[360px] md:w-[600px] md:h-[600px] bg-rose-600/5 rounded-full blur-[100px] md:blur-[140px] pointer-events-none" />

      {/* ─── NAV ─── */}
      <header className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between sticky top-0 bg-stone-950/80 backdrop-blur-md z-40 border-b border-stone-900/40">
        <div className="flex items-center gap-3">
          <LogoIcon size={44} className="drop-shadow-[0_0_12px_rgba(245,158,11,0.4)] shrink-0" />
          <div>
            <span className="font-sans text-2xl font-black tracking-tight block leading-none">
              <span className="text-stone-100">Seu</span><span className="bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent">Beat</span>
            </span>
            <span className="text-[10px] text-stone-500 block tracking-[0.18em] font-mono uppercase mt-0.5">Sua Música. Seu Momento.</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-4 lg:gap-8 text-sm font-medium text-stone-400">
          {NAV_LINKS.slice(0, 3).map(l => (
            <a key={l.href} href={l.href} className="hover:text-amber-400 transition-colors whitespace-nowrap">{l.label}</a>
          ))}
          <span className="hidden lg:flex lg:gap-8">
            {NAV_LINKS.slice(3).map(l => (
              <a key={l.href} href={l.href} className="hover:text-amber-400 transition-colors whitespace-nowrap">{l.label}</a>
            ))}
          </span>
        </nav>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2.5 text-stone-400 hover:text-stone-100 transition-colors touch-target"
          aria-label="Abrir menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[100] md:hidden bg-stone-950 flex flex-col items-center justify-center p-8">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-6 right-6 p-2.5 text-stone-400 hover:text-stone-100 transition-colors touch-target"
              aria-label="Fechar menu"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center justify-center gap-8 w-full max-w-xs text-center">
              {NAV_LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-2xl font-serif text-stone-200 hover:text-amber-400 transition-colors py-3"
                >
                  {l.label}
                </a>
              ))}
              <button
                onClick={() => { setMobileMenuOpen(false); handleStartWizard(); }}
                className="mt-4 w-full py-4 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-lg rounded-full shadow-xl active:scale-95 transition-transform cursor-pointer"
              >
                Criar Minha Música
              </button>
            </div>
          </div>
        )}

        <button
          id="nav-cta-btn"
          onClick={onStartWizard}
          className="px-5 py-3 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 text-xs md:text-sm font-extrabold rounded-full shadow-lg shadow-amber-500/10 active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          Criar Música
        </button>
      </header>

      {/* ─── 1. HERO — SPLIT LAYOUT ─── */}
      <section className="relative max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-14 pb-14 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 lg:gap-12 items-center">

          {/* Intro + Headline */}
          <div className="space-y-5 md:space-y-8 text-left lg:col-start-1">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-stone-800/80 bg-stone-900/35 px-4 py-3 shadow-lg shadow-black/20">
              <LogoIcon size={44} className="shrink-0" />
              <div>
                <p className="text-[10px] font-sans font-bold uppercase tracking-[0.22em] text-amber-400">
                  SeuBeat Studio
                </p>
                <p className="text-xs text-stone-400">Sua Música. Seu Momento.</p>
              </div>
            </div>

            {/* Citation Quote — Emotional Hook with Typewriter */}
            <div className="inline-flex flex-col gap-1 pl-4 border-l-2 border-amber-500/60">
              <TypewriterQuote />
              <span className="text-xs text-stone-500 font-mono">— Rui M., Luanda · Kizomba para a Esposa</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-amber-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Lançamento Exclusivo em Angola</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-stone-100 tracking-tight leading-[1.3]">
                Flores murcham. Chocolates acabam.
              </h1>
              <p className="font-serif text-2xl sm:text-3xl md:text-4xl text-amber-400 tracking-tight leading-[1.3]">
                Uma música<span className="text-stone-100"> dura para sempre!</span>
              </p>
              <p className="text-stone-400 text-sm md:text-base max-w-lg leading-relaxed">
                Transforme a sua história{' '}
                <AnimatePresence mode="wait">
                  <motion.span
                    key={heroIdx}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gradient-to-r from-amber-400 via-rose-400 to-amber-500 bg-clip-text text-transparent italic"
                  >
                    {HERO_VARIANTS[heroIdx]}
                  </motion.span>
                </AnimatePresence>
              </p>

              {/* Interactive Gift Comparison Badge */}
              <div className="grid grid-cols-2 gap-2 bg-stone-950/70 p-1.5 rounded-2xl border border-stone-800/80 max-w-lg">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-900/40 border border-stone-800/50">
                  <span className="text-base">🥀</span>
                  <div>
                    <p className="text-[11px] font-semibold text-stone-400 line-through">Presente Comum</p>
                    <p className="text-[9px] text-stone-500 font-mono">Murcha em 3 dias</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/30 relative overflow-hidden shadow-inner">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-rose-500/5 animate-pulse" />
                  <span className="text-base animate-bounce">🎵</span>
                  <div className="relative z-10">
                    <p className="text-[11px] font-bold text-amber-400">Música SeuBeat</p>
                    <p className="text-[9px] text-amber-300/80 font-mono font-bold uppercase tracking-wider">Eterna · Para Sempre ✨</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 lg:col-start-1">
            <div className="flex flex-col items-start gap-1">
              <button
                id="hero-primary-cta"
                onClick={handleStartWizard}
                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-bold text-sm md:text-base rounded-full shadow-xl shadow-amber-500/20 hover:-translate-y-0.5 active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Criar Minha Música</span>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </button>
              <span className="flex items-center gap-1 text-[10px] text-amber-400/70 font-sans mt-1">
                <Shield className="w-3 h-3" /> 100% Satisfação Garantida ou Reembolso
              </span>
            </div>

            <a
              href="#audio-demo-section"
              className="px-8 py-4 bg-stone-900 hover:bg-stone-850 text-stone-200 font-medium text-sm md:text-base rounded-full border border-stone-800 hover:border-stone-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current text-amber-400 shrink-0" />
              <span>Ouvir Exemplos Reais</span>
            </a>
          </div>

          {/* Emotional Photo — mobile: após CTA, acima das trust badges; desktop: coluna direita */}
          <div className="relative flex justify-center lg:justify-end lg:col-start-2 lg:row-start-1 lg:row-span-full">
            <div className="relative w-full max-w-md">
              {/* Sound Ripples Ambient Animation behind photo */}
              <div className="absolute inset-0 -m-4 rounded-3xl pointer-events-none overflow-hidden">
                <motion.div
                  animate={{ scale: [1, 1.06, 1], opacity: [0.15, 0.35, 0.15] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-3xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 blur-xl"
                />
                <motion.div
                  animate={{ scale: [1.03, 1.12, 1.03], opacity: [0.1, 0.25, 0.1] }}
                  transition={{ repeat: Infinity, duration: 4, delay: 1.5, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-3xl bg-gradient-to-r from-rose-500/15 via-amber-500/15 to-rose-500/15 blur-2xl"
                />
              </div>

              {/* Main photo */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-amber-900/20 border border-stone-800/60">
                <img
                  src="/assets/hero_couple.png"
                  alt="Casal angolano emocionado ao ouvir música personalizada"
                  className="w-full h-auto object-cover"
                  loading="eager"
                />
                {/* Overlay gradient at bottom */}
                <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-stone-950/80 to-transparent" />
                {/* Floating tag over photo */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 bg-stone-950/80 backdrop-blur-md rounded-2xl p-3 border border-stone-800/60">
                  <LogoIcon size={36} className="shrink-0 shadow-lg shadow-amber-500/15" />
                  <div>
                    <p className="text-stone-200 text-xs font-semibold">"Chorámos juntos ao ouvir."</p>
                    <p className="text-stone-500 text-[10px] font-mono">Faustino · Benguela · Semba</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-stone-800/70 bg-black/70 px-4 py-3 shadow-xl shadow-black/30">
                <img
                  src="/assets/seubeat-logo-lockup-main.png"
                  alt="SeuBeat - Sua Música. Seu Momento."
                  className="mx-auto h-20 w-full object-contain"
                  loading="eager"
                />
              </div>

              {/* Floating badge top-right */}
              <div className="absolute -top-3.5 right-3 md:-right-2 bg-gradient-to-r from-amber-400 via-rose-500 to-amber-500 text-stone-950 rounded-full px-3.5 py-1.5 text-xs font-black shadow-xl shadow-amber-500/30 border border-amber-300/40 rotate-0 md:rotate-3 backdrop-blur-sm">
                <span className="inline-flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-extrabold">
                  <Zap className="w-3.5 h-3.5 fill-stone-950 text-stone-950 animate-pulse shrink-0" />
                  Entrega Imediata
                </span>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-3 text-xs font-sans text-stone-500 uppercase tracking-wider lg:col-start-1">
            {['Letras em Português Real', 'Kizomba · Semba · Gospel', 'Entrega por E-mail'].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-500" />
                <span>{t}</span>
              </div>
            ))}
          </div>

          {/* Social proof micro-stats */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-500 font-sans lg:col-start-1">
            <div className="flex items-center gap-1.5">
              <span ref={countRef} className="text-amber-400 font-bold text-base">+{showCount ? animatedCount : 0}</span>
              <span>músicas criadas</span>
            </div>
            <div className="w-px h-4 bg-stone-800" />
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 font-bold text-base">4.9★</span>
              <span>(118 avaliações)</span>
            </div>
            <div className="w-px h-4 bg-stone-800" />
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 font-bold text-base">100%</span>
              <span>personalizado</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. HOW IT WORKS — ROMAN NUMERALS ─── */}
      <section id="how-it-works-section" className="py-14 md:py-20 border-t border-stone-900/60 bg-stone-950/40 relative z-10 text-center">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-9 md:space-y-12">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-amber-500 text-xs font-sans font-bold uppercase tracking-[0.2em] block">Estúdio SeuBeat</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Como funciona o presente perfeito?
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Em três passos rápidos, convertemos as vossas memórias numa faixa de nível profissional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 lg:gap-10">
            {[
              { step: 'I', title: 'Conte a sua história', desc: 'Abra o estúdio e responda a perguntas simples e românticas. Conte alcunhas, piadas privadas e aquela viagem inesquecível ao Cabo Ledo.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { step: 'II', title: 'O Estúdio cria a música', desc: 'A nossa tecnologia transforma as tuas respostas numa letra emocionante com vozes naturais e instrumentação profissional — no ritmo de Kizomba, Semba ou Pop favorito.', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
              { step: 'III', title: 'Surpreenda alguém especial', desc: 'Receba uma página de dedicatória lindíssima com a letra sincronizada e leitor interativo. Prepare os lenços — as lágrimas são garantidas.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 1, y: 0 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: idx * 0.12, ease: 'easeOut' }}
                className="bg-stone-900/20 border border-stone-850 p-5 md:p-8 rounded-2xl space-y-3 md:space-y-4 text-left relative overflow-hidden group hover:border-stone-800 transition-colors"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-serif font-bold text-2xl border ${item.color}`}>
                  {item.step}
                </div>
                <h3 className="font-serif text-lg md:text-xl font-medium text-stone-200">{item.title}</h3>
                <p className="text-stone-400 text-xs md:text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Interactive Before & After Story Transformer Showcase */}
          <div className="max-w-3xl mx-auto mt-8 bg-gradient-to-r from-stone-900/60 via-stone-950/80 to-stone-900/60 border border-amber-500/20 rounded-3xl p-5 md:p-7 shadow-2xl relative overflow-hidden text-left">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Transformação em Tempo Real</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before */}
              <div className="bg-stone-950/80 border border-stone-850 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                  <span>1. O que você escreve</span>
                  <span className="text-stone-600">Ideia Bruta</span>
                </div>
                <p className="text-xs text-stone-300 italic font-serif leading-relaxed">
                  "Conhecemos-nos na praia da Mussulo num domingo de sol, ela estava a rir com as amigas e trocámos telefones..."
                </p>
              </div>

              {/* After */}
              <div className="bg-gradient-to-br from-amber-500/10 via-stone-900/90 to-rose-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1 font-bold"><Music2 className="w-3 h-3" /> 2. O que o SeuBeat canta</span>
                  <span className="bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300 font-bold">Kizomba</span>
                </div>
                <p className="text-xs text-amber-200 font-serif font-medium leading-relaxed drop-shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                  "♪ Naquele domingo no Mussulo, a brisa parou pra ver... Teu sorriso ao sol brilhou e o meu mundo começou a nascer... ♪"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AUTHORITY BAR ─── */}
      <div className="border-t border-stone-900/60 bg-stone-950/30 py-6">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-stone-500 font-sans">
          <span className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-stone-400" /> <span>Tecnologia de Áudio Profissional</span>
          </span>
          <span className="hidden sm:inline text-stone-800">|</span>
          <span className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-stone-400" /> <span>Recomendado por Músicos Angolanos</span>
          </span>
          <span className="hidden sm:inline text-stone-800">|</span>
          <span className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-stone-400" /> <span>Vozes Reais com Timbre Profissional</span>
          </span>
        </div>
      </div>

      {/* ─── 3. OCCASIONS GRID ─── */}
      <section id="occasions-section" className="py-14 md:py-20 border-t border-stone-900/60 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-9 md:space-y-12">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <span className="text-amber-500 text-xs font-sans font-bold uppercase tracking-[0.2em] block">Para Cada Momento</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Qual é a vossa ocasião especial?
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Cada canção é moldada para o momento exato que quer eternizar.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {OCCASIONS.map((occ, idx) => {
              const isSelected = selectedOccasion === occ.label;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedOccasion(occ.label);
                    document.getElementById('occasions-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`group rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center space-y-2.5 sm:space-y-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-2 border-amber-500 shadow-lg shadow-amber-500/10 -translate-y-1'
                      : selectedOccasion
                        ? 'bg-stone-900/15 border border-stone-800 opacity-40 hover:opacity-70 hover:bg-stone-900/30'
                        : 'bg-stone-900/30 hover:bg-stone-900/70 border border-stone-800 hover:border-amber-500/40 hover:-translate-y-1'
                  }`}
                >
                  <span className={`transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}>
                    <occ.icon className="w-8 h-8 text-amber-400/90" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-stone-200 text-xs font-semibold leading-tight">{occ.label}</p>
                    <p className="text-stone-500 text-[10px] mt-1 font-mono leading-tight">{occ.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Painel de Compromisso + Reciprocidade */}
          {selectedOccasion && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200, mass: 0.8 }}
              className="max-w-lg mx-auto text-center space-y-5 pt-2"
            >
              <div className="bg-gradient-to-br from-amber-500/10 via-stone-900/50 to-stone-900/30 border border-amber-500/20 rounded-2xl p-6 space-y-4">
                <p className="text-stone-200 text-sm leading-relaxed font-serif italic">
                  "{OCCASION_REPLIES[selectedOccasion].msg}"
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-amber-400 font-sans">
                  <Sparkles className="w-4 h-4" />
                  <span>Sugerimos: <strong>{OCCASION_REPLIES[selectedOccasion].style}</strong></span>
                </div>
                <button
                  onClick={onStartWizard}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Sim, quero uma {selectedOccasion.toLowerCase()} em música
                </button>
                <button
                  onClick={() => setSelectedOccasion(null)}
                  className="text-[11px] text-stone-500 hover:text-stone-300 transition-colors cursor-pointer px-3 py-2"
                >
                  Não, quero escolher outra ocasião
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── 4. AUDIO DEMO ─── */}
      <section id="audio-demo-section" className="py-14 md:py-20 border-t border-stone-900/60 max-w-7xl mx-auto px-4 md:px-8">
        <AudioDemo onStartWizard={onStartWizard} />
      </section>

      {/* ─── 5. VIDEO TESTIMONIAL ─── */}
      <VideoTestimonial onStartWizard={onStartWizard} />

      {/* ─── 6. PRICING ─── */}
      <section id="pricing-section" className="py-14 md:py-20 border-t border-stone-900/60 bg-stone-950 px-4 md:px-8 relative text-center">
        <div className="max-w-7xl mx-auto space-y-10 md:space-y-14">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-amber-500 text-xs font-sans font-bold uppercase tracking-[0.2em] block">Sem Subscrições Secretas</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Preços Únicos Por Canção
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Encontre o plano ideal para a surpresa sentimental, sem mensalidades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 lg:gap-10 items-stretch max-w-5xl mx-auto">
            {PRICING_PLANS.map((plan, idx) => {
              const orderClass =
                plan.id === 'express'
                  ? 'order-first md:order-2'
                  : plan.id === 'standard'
                    ? 'md:order-1'
                    : plan.id === 'premium'
                      ? 'md:order-3'
                      : '';
              return (
              <motion.div
                id={`pricing-card-${plan.id}`}
                key={plan.id}
                initial={{ opacity: 1, y: 0 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: idx * 0.15, ease: 'easeOut' }}
                className={`rounded-2xl md:rounded-3xl p-5 md:p-8 flex flex-col justify-between relative transition-all duration-300 ${orderClass} ${
                  plan.popular
                    ? 'bg-gradient-to-b from-amber-950/40 via-stone-900/60 to-stone-900/30 border-2 border-amber-500 shadow-xl shadow-amber-500/5 md:scale-[1.03] z-10'
                    : 'bg-stone-900/30 border border-stone-850 hover:border-stone-800'
                }`}
              >
                {plan.badge && (
                  <span className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full shadow-lg">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-4 md:space-y-5 text-left">
                  <div>
                    <h3 className="font-serif text-lg md:text-xl font-bold text-stone-200">{plan.name}</h3>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">{plan.subtitle}</p>
                  </div>

                  <div className="py-3 border-b border-stone-850">
                    <div className="flex items-baseline gap-1.5">
                      {plan.originalPrice && (
                        <span className="text-sm text-stone-600 line-through font-mono">{plan.originalPrice}</span>
                      )}
                      <span className="font-serif text-2xl md:text-3xl font-black text-stone-100">{plan.price}</span>
                      <span className="text-[10px] text-stone-500 font-mono">/ Pago Único</span>
                    </div>
                    {plan.bestFor && (
                      <p className="text-[10px] text-amber-500/70 font-mono mt-1">Melhor para: {plan.bestFor}</p>
                    )}
                  </div>

                  <ul className="space-y-2.5 text-xs text-stone-300">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.popularity && (
                    <p className="text-center text-[10px] text-amber-500/80 font-mono font-medium pt-1">
                      <Flame className="w-3 h-3 inline-block -mt-0.5 mr-1" />{plan.popularity} dos clientes escolhem esta opção
                    </p>
                  )}
                </div>

                <div className="pt-6 md:pt-8">
                  <button
                    id={`pricing-cta-btn-${plan.id}`}
                    onClick={() => {
                      gaInitiateCheckout(plan.id, parsePrice(plan.price));
                      onStartWizard();
                    }}
                    className={`w-full py-3.5 rounded-full text-xs md:text-sm font-bold transition-all cursor-pointer ${
                      plan.popular
                        ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 font-extrabold'
                        : 'bg-stone-800 hover:bg-stone-750 text-stone-100'
                    }`}
                  >
                    {plan.id === 'premium' ? (
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Crown className="w-4 h-4" /> Criar com Minha Voz
                      </span>
                    ) : 'Escolher Este Plano'}
                  </button>
                  <span className="text-[10px] text-stone-400 block text-center mt-2 font-mono">
                    ✓ {plan.guarantee || 'Suporte pós-venda incluído'}
                  </span>
                </div>
              </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 7. TESTIMONIALS ─── */}
      <motion.section
        initial={{ opacity: 1, x: 0 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="py-14 md:py-20 border-t border-stone-900/60 max-w-7xl mx-auto px-4 md:px-8 text-center space-y-10 md:space-y-14"
      >
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-amber-500 text-xs font-sans font-bold uppercase tracking-[0.2em] block">Corações Conquistados</span>
          <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
            Quem ofereceu, nunca mais esqueceu
          </h2>
          <p className="text-stone-400 text-xs md:text-sm">
            Depoimentos reais de pessoas em Angola que criaram recordações eternas.
          </p>
        </div>
        <Testimonials />
        <div className="max-w-xl mx-auto text-center space-y-3">
          <button
            id="testimonials-cta-btn"
            onClick={onStartWizard}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-bold text-sm md:text-base rounded-full shadow-xl shadow-amber-500/20 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
          >
            <span>O próximo depoimento pode ser o teu</span>
            <ArrowRight className="w-5 h-5 shrink-0" />
          </button>
          <p className="text-[10px] text-stone-500 font-mono">
            Cria a tua história em menos de 2 minutos
          </p>
        </div>
      </motion.section>

      {/* ─── 8. FAQ ─── */}
      <section id="faq-section" className="py-14 md:py-20 border-t border-stone-900/60 bg-stone-950 px-4 md:px-8 text-center space-y-9 md:space-y-12">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-amber-500 text-xs font-sans font-bold uppercase tracking-[0.2em] block">Centro de Ajuda</span>
          <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
            Perguntas Frequentes
          </h2>
          <p className="text-stone-400 text-xs md:text-sm">
            Tudo o que precisa de saber para encomendar a sua composição.
          </p>
        </div>
        <FAQ />

        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3 pt-2">
          <p className="text-stone-400 text-sm">
            Ainda com dúvidas? <span className="text-amber-400 font-semibold">Fala connosco no WhatsApp</span>
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 bg-green-900/30 border border-green-800/50 rounded-full text-green-400 hover:bg-green-900/50 transition-colors text-sm font-semibold"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp: 922 058 136
          </a>
        </div>
      </section>

      {/* ─── 9. CTA FINAL ─── */}
      <motion.section
        initial={{ opacity: 1, scale: 1 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="py-16 md:py-24 px-4 md:px-8 relative border-t border-stone-900/60"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/10 to-transparent pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center space-y-8 relative z-10">
          <div className="space-y-4">
            <h2 className="font-serif text-3xl md:text-5xl text-stone-100 font-bold tracking-tight leading-[1.15]">
              A tua história merece ser cantada
            </h2>
              <p className="text-stone-400 text-base md:text-lg leading-relaxed">
                Primeiro a letra, depois a música. <span className="text-amber-400 font-semibold">Só pagas quando aprovares.</span>
              </p>
              <p className="text-stone-500 text-xs font-mono">
                Lê e edita a letra à vontade · A música nasce após o teu sim
              </p>
              <p className="text-amber-400/60 text-xs font-mono italic">
                Sabia que 9 em cada 10 pessoas choram ao ouvir a música que dedicaram?
              </p>
              <p className="text-stone-600 text-[11px] font-mono italic mt-1 max-sm:hidden">
                "Daqui a um ano, vai preferir ter feito esta música do que não a ter feito. As flores murcham. As memórias ficam. A dúvida é: vais querer ter essa memória?"
              </p>
          </div>

          <button
            onClick={onStartWizard}
            className="inline-flex items-center gap-3 px-6 sm:px-10 py-5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-extrabold text-base md:text-lg rounded-full shadow-2xl shadow-amber-500/20 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
          >
            <span className="inline-flex items-center gap-2"><Music2 className="w-5 h-5" />Criar a minha canção</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap justify-center gap-4 text-[10px] text-stone-600 font-mono uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-amber-500" /> Sem cartão
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-amber-500" /> Sem subscrição
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-amber-500" /> Entrega por email
            </span>
          </div>
        </div>
      </motion.section>

      {/* ─── 9. FOOTER — SIMPLIFICADO ─── */}
      <footer className="border-t border-stone-900 bg-stone-950/60 py-10 px-4 md:px-8 text-stone-500 text-xs relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <LogoIcon size={36} />
            <div>
              <span className="font-sans text-lg font-black tracking-tight block leading-none">
                <span className="text-stone-100">Seu</span><span className="bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent">Beat</span>
              </span>
              <span className="text-[10px] font-mono text-stone-500">© 2026 · Todos os direitos reservados</span>
            </div>
          </div>

          {/* Links rápidos */}
          <div className="flex items-center gap-6 text-stone-400 font-medium">
            <a href="/terms" className="hover:text-amber-400 transition-colors px-3 py-2">Termos</a>
            <a href="/privacy" className="hover:text-amber-400 transition-colors px-3 py-2">Privacidade</a>
            <a href="#faq-section" className="hover:text-amber-400 transition-colors px-3 py-2">Ajuda</a>
          </div>

          {/* Contacto directo */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-green-900/30 border border-green-800/50 rounded-full text-green-400 hover:bg-green-900/50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-semibold">WhatsApp: 922 058 136</span>
            </a>
            <a
              href="mailto:suporte@seubeat.ao"
              className="text-stone-500 hover:text-amber-400 transition-colors font-mono"
            >
              suporte@seubeat.ao
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-stone-900/40 text-center text-[10px] tracking-widest text-stone-600 uppercase">
          Construído com amor para recordar para sempre · Luanda, Angola
        </div>
      </footer>

      {/* Sticky bottom CTA — mobile apenas */}
      {showStickyBar && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260, mass: 0.8 }}
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-stone-950/90 backdrop-blur-md border-t border-stone-800/60 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col leading-tight shrink-0">
              <span className="text-[10px] text-stone-500 font-mono uppercase tracking-wider">A tua história em música</span>
              <span className="text-sm font-serif font-bold text-amber-400">a partir de 7.900 Kz</span>
            </div>
            <button
              id="sticky-cta-btn"
              onClick={handleStartWizard}
              className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-rose-600 active:from-amber-400 active:to-rose-500 text-stone-950 font-extrabold text-sm rounded-full shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              Criar Minha Música
            </button>
          </div>
        </motion.div>
      )}

      {/* Studio Opening Curtain Overlay */}
      <AnimatePresence>
        {isStudioOpening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-4 text-center p-6"
            >
              <LogoIcon size={56} className="animate-pulse drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
              <h3 className="text-xl font-serif font-bold text-white tracking-tight">A preparar o teu estúdio...</h3>
              <div className="flex items-center gap-1 h-6">
                {[20, 60, 40, 80, 50, 90, 30].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: ['20%', `${h}%`, '20%'] }}
                    transition={{ repeat: Infinity, duration: 0.4 + i * 0.1 }}
                    className="w-1 bg-amber-400 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
