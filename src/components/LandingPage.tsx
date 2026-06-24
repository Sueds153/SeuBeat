import { ArrowRight, Sparkles, Check, Play, Coffee } from 'lucide-react';
import AudioDemo from './AudioDemo';
import Testimonials from './Testimonials';
import VideoTestimonial from './VideoTestimonial';
import FAQ from './FAQ';
import { PRICING_PLANS } from '../types';

interface LandingPageProps {
  onStartWizard: () => void;
}

export default function LandingPage({ onStartWizard }: LandingPageProps) {
  return (
    <div id="landing-page-root" className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-amber-950/15 via-rose-950/10 to-transparent pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-amber-550/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[600px] h-[600px] bg-rose-550/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex items-center justify-between sticky top-0 bg-stone-950/70 backdrop-blur-md z-45 border-b border-stone-900/40">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-rose-600 rounded-xl flex items-center justify-center text-stone-950 font-black shadow-lg shadow-amber-500/10 animate-[pulse_3s_infinite]">
            SB
          </div>
          <div>
            <span className="font-serif text-xl font-black text-stone-100 tracking-tight block">
              SeuBeat
            </span>
            <span className="text-[10px] text-stone-500 block tracking-widest font-mono uppercase">Música com Emoção</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-400">
          <a href="#how-it-works-section" className="hover:text-amber-400 transition-colors">Como Funciona</a>
          <a href="#audio-demo-section" className="hover:text-amber-400 transition-colors">Demonstrações</a>
          <a href="#pricing-section" className="hover:text-amber-400 transition-colors">Preços</a>
          <a href="#faq-section" className="hover:text-amber-400 transition-colors">Perguntas Frequentes</a>
        </nav>

        <button
          id="nav-cta-btn"
          onClick={onStartWizard}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-550 text-stone-950 text-xs md:text-sm font-extrabold rounded-xl shadow-lg shadow-amber-500/5 active:scale-95 transition-all text-center shrink-0 cursor-pointer"
        >
          Criar Música ❤️
        </button>
      </header>

      {/* 1. HERO SECTION */}
      <section className="relative max-w-7xl mx-auto px-4 md:px-8 pt-16 pb-24 text-center space-y-8">
        
        {/* Floating Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-amber-400 text-xs font-semibold animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Lançamento Exclusivo em Angola</span>
        </div>

        {/* Emotion Heading */}
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl text-stone-100 tracking-tight leading-none">
            Transforme a sua história numa <br />
            <span className="bg-gradient-to-r from-amber-400 via-rose-400 to-amber-500 bg-clip-text text-transparent italic font-semibold">
              música inesquecível ❤️
            </span>
          </h1>
          <p className="text-stone-400 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed pt-2">
            Surpreenda quem mais ama com uma canção premium personalizada. Escolha Kizomba, Semba ou Pop Romântico. Escreva as suas memórias e deixe o nosso estúdio cantar o seu amor.
          </p>
        </div>

        {/* Core Hero CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <button
            id="hero-primary-cta"
            onClick={onStartWizard}
            className="w-full sm:w-auto px-8 py-4.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-bold text-sm md:text-base rounded-2xl shadow-xl shadow-amber-500/15 transform hover:translate-y-[-2px] active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Criar Minha Música</span>
            <ArrowRight className="w-5 h-5 shrink-0" />
          </button>
          
          <a
            href="#audio-demo-section"
            className="w-full sm:w-auto px-8 py-4 bg-stone-900 hover:bg-stone-850 text-stone-200 hover:text-white font-medium text-sm md:text-base rounded-2xl border border-stone-800 hover:border-stone-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Play className="w-4.5 h-4.5 fill-current text-amber-400 shrink-0" />
            <span>Ouvir Exemplos Reais</span>
          </a>
        </div>

        {/* Trust Stats */}
        <div className="pt-8 flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-xs font-mono text-stone-500 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-amber-500" />
            <span>Letras em Português Real</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-amber-500" />
            <span>Kizomba, Semba e mais</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-amber-500" />
            <span>Voz de Estúdio Customizada</span>
          </div>
        </div>

      </section>

      {/* 2. HOW IT WORKS SECTION */}
      <section id="how-it-works-section" className="py-20 border-t border-stone-900/60 bg-stone-950/40 relative z-10 text-center">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
          
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block">Estúdio SeuBeat</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Como funciona o presente perfeito?
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Em apenas três passos rápidos, convertemos as vossas memórias numa faixa de nível profissional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {[
              {
                step: '01',
                title: 'Conte a sua história',
                desc: 'Abra o estúdio e responda a perguntas simples e românticas. Conte fofocas, alcunhas, piadas privadas e aquela viagem fantástica ao Cabo Ledo ou Mussulo.',
                color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              },
              {
                step: '02',
                title: 'O Estúdio cria a música',
                desc: 'O nosso estúdio junta compositores nacionais para estruturar a letra, e vozes profissionais gravam a música no ritmo de Kizomba, Semba ou Pop favorito.',
                color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              },
              {
                step: '03',
                title: 'Surpreenda alguém especial',
                desc: 'Receba uma página de dedicatória lindíssima, com as fotos do casal, letra sincronizada e leitor interativo. Prepare os lenços porque as lágrimas são garantidas.',
                color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              }
            ].map((item, idx) => (
              <div 
                key={idx}
                className="bg-stone-900/20 border border-stone-850 p-6 md:p-8 rounded-2xl space-y-4 text-left relative overflow-hidden group hover:border-stone-800 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-lg border ${item.color}`}>
                  {item.step}
                </div>
                <h3 className="font-serif text-lg md:text-xl font-medium text-stone-200">
                  {item.title}
                </h3>
                <p className="text-stone-400 text-xs md:text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 3. AUDIO DEMO SECTION */}
      <section className="py-20 max-w-7xl mx-auto px-4 md:px-8">
        <div className="space-y-12">
          <AudioDemo />
        </div>
      </section>

      {/* VIDEO TESTIMONIAL PROOF SECTION */}
      <VideoTestimonial />

      {/* 4. PRICING SECTION */}
      <section id="pricing-section" className="py-20 border-t border-stone-900/60 bg-stone-950 px-4 md:px-8 relative text-center">
        <div className="max-w-7xl mx-auto space-y-14">
          
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block">Sem Subscrições Secretas</span>
            <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
              Preços Únicos Por Canção 💎
            </h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Encontre o plano ideal para surpresa sentimental sem mensalidades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 items-stretch max-w-5xl mx-auto">
            {PRICING_PLANS.map((plan) => {
              return (
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
                    <span className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 text-xxs font-extrabold uppercase px-3 py-1 rounded-full shadow-lg">
                      {plan.badge}
                    </span>
                  )}

                  <div className="space-y-5 text-left">
                    <div>
                      <h3 className="font-serif text-lg md:text-xl font-bold text-stone-200">{plan.name}</h3>
                      <p className="text-xxs text-stone-500 mt-1 lines-clamp-2 leading-relaxed h-8">{plan.subtitle}</p>
                    </div>

                    <div className="py-3 flex items-baseline gap-1.5 border-b border-stone-850">
                      <span className="font-serif text-2xl md:text-3.5xl font-black text-stone-100">{plan.price}</span>
                      <span className="text-xxs text-stone-500 font-mono">/ Pago Único</span>
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
                      className={`w-full py-3.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
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
              );
            })}
          </div>

        </div>
      </section>

      {/* 5. TESTIMONIALS SECTION */}
      <section className="py-20 max-w-7xl mx-auto px-4 md:px-8 text-center space-y-14">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block font-semibold">Corações Conquistados</span>
          <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
            Quem ofereceu, nunca mais esqueceu ❤️
          </h2>
          <p className="text-stone-400 text-xs md:text-sm">
            Depoimentos comoventes de pessoas reais em Angola que criaram recordações inesquecíveis.
          </p>
        </div>

        <Testimonials />
      </section>

      {/* 6. FAQ SECTION */}
      <section id="faq-section" className="py-20 border-t border-stone-900/60 bg-stone-950 px-4 md:px-8 text-center space-y-12">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-amber-500 text-xs font-mono font-bold uppercase tracking-widest block font-semibold">Centro de Ajuda</span>
          <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-semibold tracking-tight">
            Perguntas Frequentes 💡
          </h2>
          <p className="text-stone-400 text-xs md:text-sm">
            Tudo o que precisa de saber para encomendar a sua composição com facilidade.
          </p>
        </div>

        <FAQ />
      </section>

      {/* 7. FOOTER */}
      <footer className="border-t border-stone-900 bg-stone-950/60 py-12 px-4 md:px-8 text-stone-500 text-xs relative z-10 font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-amber-500 to-rose-600 rounded-lg flex items-center justify-center text-stone-950 font-black text-xs">
                SB
              </div>
              <span className="font-serif text-lg font-bold text-stone-200">SeuBeat</span>
            </div>
            <p className="text-stone-400 leading-relaxed font-sans max-w-xs text-xs">
              Fazemos com que os sentimentos mais profundos se tornem canções eternas de alta definição artística para recordar.
            </p>
          </div>

          <div className="text-left space-y-3">
            <h4 className="text-xs font-bold text-stone-300 uppercase tracking-widest">Estilos Artísticos</h4>
            <ul className="space-y-2 font-medium text-stone-500">
              <li>Kizomba Lenta / Tarraxinha</li>
              <li>Semba Tradicional Angolano</li>
              <li>Afrobeat Vibrante</li>
              <li>Pop Balada Romântica</li>
            </ul>
          </div>

          <div className="text-left space-y-3">
            <h4 className="text-xs font-bold text-stone-300 uppercase tracking-widest">Parcerias e Legal</h4>
            <ul className="space-y-2 font-medium text-stone-500">
              <li><a href="/terms.html" className="hover:underline">Termos de Utilização</a></li>
              <li><a href="/privacy.html" className="hover:underline">Políticas de Privacidade</a></li>
              <li>Compositores Associados</li>
              <li><a href="mailto:suporte@seubeat.ao" className="hover:underline">Contactar Suporte VIP</a></li>
            </ul>
          </div>

          <div className="text-left space-y-3">
            <h4 className="text-xs font-bold text-stone-300 uppercase tracking-widest">Estúdio central em Angola</h4>
            <p className="text-stone-400 leading-relaxed max-w-xs text-xs font-sans">
              Bairro Talatona, Luanda.<br />
              WhatsApp: 929 423 278 | Email: suporte@seubeat.ao
            </p>
            <div className="pt-2 text-[10px] text-stone-500">
              @ 2026 SeuBeat. Todos os direitos reservados.
            </div>
          </div>

        </div>

        {/* Small footer copyright & custom design credit lines but strictly human and clean! */}
        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-stone-900/40 flex flex-col md:flex-row justify-between items-center gap-4 text-xxs tracking-wider">
          <span>CONSTRUÍDO COM AMOR PARA RECORDAR PARA SEMPRE</span>
          <div className="flex items-center gap-1.5 text-stone-600">
            <Coffee className="w-3.5 h-3.5 text-amber-500/80" />
            <span>Feito de forma segura com criptografia</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
