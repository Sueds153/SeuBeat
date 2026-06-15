import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Como funciona a criação artística das músicas?",
    answer: "É simples e emocionante! No nosso assistente, partilha memórias reais, alcunhas, piadas e mensagens do fundo do coração. O nosso estúdio de composição criativa desenvolve um poema lírico personalizado com rimas ricas e naturais em ritmos como Kizomba, Semba, R&B ou Pop. Um talentoso vocalista digital de estúdio interpreta depois a letra com instrumentistas de excelência, resultando numa faixa personalizada real e incrivelmente emocionante."
  },
  {
    question: "Quanto tempo demora a entrega da minha música?",
    answer: "Depende do plano selecionado. O plano Standard é entregue em até 24 dias úteis. No plano SeuBeat Express ⚡ a entrega é ultrarrápida. O plano Premium Voice 👑 (com som de estúdio personalizado) demora as mesmas gravações válidas."
  },
  {
    question: "Posso sugerir alterações se não gostar de algum detalhe?",
    answer: "Não é possível alterar, por este motivo se atente no acto do preenchimento do formulário"
  },
  {
    question: "Como funciona a opção 'A Minha Própria Voz' (Premium)?",
    answer: "É a experiência mais romântica e premium no mercado! No passo 4 do assistente, se selecionar a sua própria voz, poderá fazer upload de um ficheiro de áudio simples (pelo telemóvel ou computador). O nosso motor acústico exclusivo estuda a sua assinatura vocal e timbre. O cantor de estúdio canta depois a canção inteira com a sua assinatura de voz e a emoção perfeita."
  },
  {
    question: "De que forma recebo a música pronta?",
    answer: "A música é entregue através de um link exclusivo no seu e-mail e WhatsApp. Esse link abre uma página de dedicatória lindíssima, personalizada com a foto que carregou, as letras a passar em formato animado, e um leitor premium para carregar no play e emocionar a pessoa especial instantaneamente. Também daremos a opção de descarregar em ficheiro de áudio padrão de alta definição (MP3 e WAV)."
  },
  {
    question: "Como posso efetuar o pagamento seguro em Angola?",
    answer: "Aceitamos pagamentos instantâneos extremamente populares como transferência bancária direta, depósitos ou via referências de pagamento Multicaixa Express. No final do formulário, as instruções de liquidação serão apresentadas de forma clara para validação."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div id="faq-accordions" className="max-w-3xl mx-auto space-y-4">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="border border-stone-800 bg-stone-900/40 hover:bg-stone-900/60 rounded-2xl transition-all duration-300 relative overflow-hidden"
          >
            <button
              id={`faq-toggle-btn-${idx}`}
              onClick={() => toggleItem(idx)}
              className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-amber-500/85 shrink-0" />
                <span className="text-stone-200 font-medium text-sm md:text-base pr-4">
                  {item.question}
                </span>
              </div>
              <div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                )}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <div className="px-6 pb-6 pt-1 text-sm md:text-base text-stone-400 border-t border-stone-800/60 leading-relaxed font-sans mt-1">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
