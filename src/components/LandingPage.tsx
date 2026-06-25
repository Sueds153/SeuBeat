import { ArrowRight, Sparkles, Check, Play, MessageCircle } from 'lucide-react';
import LogoIcon from './LogoIcon';
import AudioDemo from './AudioDemo';
import Testimonials from './Testimonials';
import VideoTestimonial from './VideoTestimonial';
import FAQ from './FAQ';
import { PRICING_PLANS } from '../types';

interface LandingPageProps {
  onStartWizard: () => void;
}

const OCCASIONS = [
  { icon: '💍', label: 'Aniversário de Casamento', desc: 'Para quem partilha uma vida' },
  { icon: '❤️', label: 'Declaração de Amor', desc: 'Diz o que sentes em música' },
  { icon: '🎂', label: 'Aniversário', desc: 'Um presente eterno e único' },
  { icon: '👩‍👧', label: 'Para a Mãe', desc: 'A homenagem que ela merece' },
  { icon: '🙏', label: 'Agradecimento', desc: 'Gratidão que toca a alma' },
  { icon: '🕊️', label: 'Em Memória', desc: 'Eterniza quem nunca esquecemos' },
];

export default function LandingPage({ onStartWizard }: LandingPageProps) {
  return (
    <div id="landing-page-root" className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500/30 selection:text-amber-200">

      {/* ─── PROMO BAR ─── */}
      <div className="w-full bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-stone-950 text-center py-2 px-4 text-xs font-bold tracking-wide animate-pulse-slow z-50 relative">
        🎉 Lançamento Exclusivo · Primeiros 50 pedidos com <span className="underline underline-offset-2">30% de desconto</span> · Oferta Limitada!
      </div>

      {/* Ambient Background */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-amber-950/15 via-rose-950/10 to-transparent pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-amber-550/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[600px] h-[600px] bg-rose-550/5 rounded-full blur-[140px] pointer-events-none" />

      {/* ─── NAV ─── */}
      <header className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between sticky top-0 bg-stone-950/80 backdrop-blur-md z-40 border-b border-stone-900/40">
        <div className="flex items-center gap-2">
          <LogoIcon size={44} className="drop-shadow-[0_0_12px_rgba(245,158,11,0.4)] shrink-0" />
          <div>
            <span className="font-sans text-2xl font-black tracking-tight block leading-none">
              <span className="text-stone-100">Seu</span><span className="bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent">Beat</span>
            </span>
            <span className="text-[9px] text-stone-500 block tracking-[0.18em] font-mono uppercase mt-0.5">Sua Música. Seu Momento.</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-400">
          <a href="#how-it-works-section" className="hover:text-amber-400 transition-colors">Como Funciona</a>
          <a href="#occasions-section" className="hover:text-amber-400 transition-colors">Ocasiões</a>
          <a href="#audio-demo-section" className="hover:text-amber-400 transition-colors">Demos</a>
          <a href="#pricing-section" className="hover:text-amber-400 transition-colors">Preços</a>
          <a href="#faq-section" className="hover:text-amber-400 transition-colors">Perguntas</a>
        </nav>

        <button
          id="nav-cta-btn"
          onClick={onStartWizard}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-550 text-stone-950 text-xs md:text-sm font-extrabold rounded-full shadow-lg shadow-amber-500/10 active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          Criar Música ❤️
        </button>
      </header>

      {/* ─── 1. HERO — SPLIT LAYOUT ─── */}
      <section className="relative max-w-7xl mx-auto px-4 md:px-8 pt-14 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left: Text */}
          <div className="space-y-8 text-left">

            {/* Citation Quote — Emotional Hook */}
            <div className="inline-flex flex-col gap-1 pl-4 border-l-2 border-amber-500/60">
              <p className="font-serif text-lg md:text-xl text-stone-200 italic leading-snug">
                "Ela ouviu e não parou de chorar…<br />
                <span className="text-amber-400">foi o melhor presente da minha vida."</span>
              </p>
              <span className="text-xs text-stone-500 font-mono">— Rui M., Luanda · Kizomba para a Esposa</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-amber-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Lançamento Exclusivo em Angola</span>
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-stone-100 tracking-tight leading-[1.1]">
                Transforme a sua história numa{' '}
                <span className="bg-gradient-to-r from-amber-400 via-rose-400 to-amber-500 bg-clip-text text-transparent italic">
                  música inesquecível ❤️
                </span>
              </h1>
              <p className="text-stone-400 text-sm md:text-base max-w-lg leading-relaxed">
                Surpreenda quem mais ama com uma canção premium personalizada — Kizomba, Semba ou Pop Romântico. As suas memórias, cantadas para sempre.
              </p>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3 text-xs font-mono text-stone-500 uppercase tracking-wider">
              {['Letras em Português Real', 'Kizomba · Semba · Gospel', 'Entrega por E-mail'].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                id="hero-primary-cta"
                onClick={onStartWizard}
                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-bold text-sm md:text-base rounded-full shadow-xl shadow-amber-500/20 hover:-translate-y-0.5 active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Criar Minha Música</span>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </button>

              <a
                href="#audio-demo-section"
                className="px-8 py-4 bg-stone-900 hover:bg-stone-850 text-stone-200 font-medium text-sm md:text-base rounded-full border border-stone-800 hover:border-stone-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current text-amber-400 shrink-0" />
                <span>Ouvir Exemplos Reais</span>
              </a>
            </div>

            {/* Social proof micro-stats */}
            <div className="flex items-center gap-6 text-xs text-stone-500 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold text-base">+200</span>
                <span>músicas criadas</span>
              </div>
              <div className="w-px h-4 bg-stone-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold text-base">4.9★</span>
                <span>satisfação</span>
              </div>
              <div className="w-px h-4 bg-stone-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold text-base">100%</span>
                <span>personalizado</span>
              </div>
            </div>
          </div>

          {/* Right: Emotional Photo */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
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
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-stone-950 font-black text-xs shrink-0">❤️</div>
                  <div>
                    <p className="text-stone-200 text-xs font-semibold">"Chorámos juntos ao ouvir."</p>
                    <p className="text-stone-500 text-[10px] font-mono">Faustino · Benguela · Semba</p>
                  </div>
                </div>
              </div>

              {/* Floating badge top-right */}
              <div className="absolute -top-4 -right-4 bg-gradient-to-br from-amber-500 to-rose-600 text-stone-950 rounded-2xl px-4 py-2 text-xs font-black shadow-xl shadow-amber-500/30 rotate-3">
                🎵 Entrega em 24–72h
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. HOW IT WORKS — ROMAN NUMERALS ─── */}
      <section id="how-it-works-section" className="py-20 border-t border-stone-900/60 bg-stone-950/40 relative z-10 text-center">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block">Estúdio SeuBeat</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Como funciona o presente perfeito?
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Em três passos rápidos, convertemos as vossas memórias numa faixa de nível profissional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {[
              { step: 'I', title: 'Conte a sua história', desc: 'Abra o estúdio e responda a perguntas simples e românticas. Conte alcunhas, piadas privadas e aquela viagem inesquecível ao Cabo Ledo.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { step: 'II', title: 'O Estúdio cria a música', desc: 'Os nossos compositores angolanos estruturam a letra e vozes profissionais gravam a canção no ritmo de Kizomba, Semba ou Pop favorito.', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
              { step: 'III', title: 'Surpreenda alguém especial', desc: 'Receba uma página de dedicatória lindíssima com a letra sincronizada e leitor interativo. Prepare os lenços — as lágrimas são garantidas.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-stone-900/20 border border-stone-850 p-6 md:p-8 rounded-2xl space-y-4 text-left relative overflow-hidden group hover:border-stone-800 transition-colors"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-serif font-bold text-2xl border ${item.color}`}>
                  {item.step}
                </div>
                <h3 className="font-serif text-lg md:text-xl font-medium text-stone-200">{item.title}</h3>
                <p className="text-stone-400 text-xs md:text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3. OCCASIONS GRID ─── */}
      <section id="occasions-section" className="py-20 border-t border-stone-900/60 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block">Para Cada Momento</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Qual é a vossa ocasião especial? ✨
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Cada canção é moldada para o momento exato que quer eternizar.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {OCCASIONS.map((occ, idx) => (
              <button
                key={idx}
                onClick={onStartWizard}
                className="group bg-stone-900/30 hover:bg-stone-900/70 border border-stone-800 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col items-center text-center space-y-3 transition-all hover:-translate-y-1 cursor-pointer"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{occ.icon}</span>
                <div>
                  <p className="text-stone-200 text-xs font-semibold leading-tight">{occ.label}</p>
                  <p className="text-stone-500 text-[10px] mt-1 font-mono leading-tight">{occ.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. AUDIO DEMO ─── */}
      <section id="audio-demo-section" className="py-20 border-t border-stone-900/60 max-w-7xl mx-auto px-4 md:px-8">
        <AudioDemo />
      </section>

      {/* ─── 5. VIDEO TESTIMONIAL ─── */}
      <VideoTestimonial />

      {/* ─── 6. PRICING ─── */}
      <section id="pricing-section" className="py-20 border-t border-stone-900/60 bg-stone-950 px-4 md:px-8 relative text-center">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block">Sem Subscrições Secretas</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Preços Únicos Por Canção 💎
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Encontre o plano ideal para a surpresa sentimental, sem mensalidades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 items-stretch max-w-5xl mx-auto">
            {PRICING_PLANS.map((plan) => (
              <div
                id={`pricing-card-${plan.id}`}
                key={plan.id}
                className={`rounded-3xl p-6 md:p-8 flex flex-col justify-between relative transition-all duration-300 ${
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

                <div className="space-y-5 text-left">
                  <div>
                    <h3 className="font-serif text-lg md:text-xl font-bold text-stone-200">{plan.name}</h3>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">{plan.subtitle}</p>
                  </div>

                  <div className="py-3 flex items-baseline gap-1.5 border-b border-stone-850">
                    <span className="font-serif text-2xl md:text-3xl font-black text-stone-100">{plan.price}</span>
                    <span className="text-[10px] text-stone-500 font-mono">/ Pago Único</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-stone-300">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <button
                    id={`pricing-cta-btn-${plan.id}`}
                    onClick={onStartWizard}
                    className={`w-full py-3.5 rounded-full text-xs md:text-sm font-bold transition-all cursor-pointer ${
                      plan.popular
                        ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 font-extrabold'
                        : 'bg-stone-800 hover:bg-stone-750 text-stone-100'
                    }`}
                  >
                    {plan.id === 'premium' ? 'Criar com Minha Voz 👑' : 'Escolher Este Plano'}
                  </button>
                  <span className="text-[10px] text-stone-500 block text-center mt-2.5 font-mono">
                    Suporte de apoio pós-venda incluído
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. TESTIMONIALS ─── */}
      <section className="py-20 border-t border-stone-900/60 max-w-7xl mx-auto px-4 md:px-8 text-center space-y-14">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block">Corações Conquistados</span>
          <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
            Quem ofereceu, nunca mais esqueceu ❤️
          </h2>
          <p className="text-stone-400 text-xs md:text-sm">
            Depoimentos reais de pessoas em Angola que criaram recordações eternas.
          </p>
        </div>
        <Testimonials />
      </section>

      {/* ─── 8. CTA FINAL ─── */}
      <section className="py-24 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/10 to-transparent pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center space-y-8 relative z-10">
          <div className="space-y-4">
            <h2 className="font-serif text-3xl md:text-5xl text-stone-100 font-bold tracking-tight leading-[1.15]">
              Pronto a começar?
            </h2>
            <p className="text-stone-400 text-base md:text-lg leading-relaxed">
              A canção já existe. <span className="text-amber-400 font-semibold">Falta só ouvi-la.</span>
            </p>
            <p className="text-stone-500 text-xs font-mono">
              Pré-visualização grátis · Pagas só quando ouvires e adorares · Garantia de devolução
            </p>
          </div>

          <button
            onClick={onStartWizard}
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-extrabold text-base md:text-lg rounded-full shadow-2xl shadow-amber-500/20 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
          >
            <span>♪ Criar a minha canção</span>
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
      </section>

      {/* ─── 9. FAQ ─── */}
      <section id="faq-section" className="py-20 border-t border-stone-900/60 bg-stone-950 px-4 md:px-8 text-center space-y-12">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block">Centro de Ajuda</span>
          <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
            Perguntas Frequentes 💡
          </h2>
          <p className="text-stone-400 text-xs md:text-sm">
            Tudo o que precisa de saber para encomendar a sua composição.
          </p>
        </div>
        <FAQ />
      </section>

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
            <a href="/terms.html" className="hover:text-amber-400 transition-colors">Termos</a>
            <a href="/privacy.html" className="hover:text-amber-400 transition-colors">Privacidade</a>
            <a href="#faq-section" className="hover:text-amber-400 transition-colors">Ajuda</a>
          </div>

          {/* Contacto directo */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a
              href="https://wa.me/244929423278"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-800/50 rounded-full text-green-400 hover:bg-green-900/50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-semibold">WhatsApp: 929 423 278</span>
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

    </div>
  );
}
