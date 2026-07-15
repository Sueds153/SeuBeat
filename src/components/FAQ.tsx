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
    answer: "Standard: entrega em 24h · Express: entrega imediata · Premium: 24h (timbre personalizado)."
  },
  {
    question: "Posso sugerir alterações se não gostar de algum detalhe?",
    answer: "Pode editar a letra à vontade depois de gerada — corrigir nomes, alcunhas ou frases. Também pode regenerar a letra até 2 vezes se quiser um tom diferente. A música só é gerada após aprovar a letra e o pagamento."
  },
  {
    question: "Como funciona a opção 'A Minha Própria Voz' (Premium)?",
    answer: "Após escolher o plano Premium, grava um áudio curto (telemóvel ou PC). A sua assinatura vocal é aplicada à música final — o cantor canta com o seu timbre."
  },
  {
    question: "De que forma recebo a música pronta?",
    answer: "A música é entregue através de um link exclusivo no seu e-mail. Esse link abre uma página de dedicatória lindíssima, personalizada com a foto que carregou, as letras animadas e um leitor interativo. Também poderá descarregar em MP3."
  },
  {
    question: "Como posso efetuar o pagamento seguro em Angola?",
    answer: "Pagamento por referência Multicaixa (Entidade 10116, Referência 929423278). No final do wizard encontras o passo a passo completo para ATM ou Multicaixa Express."
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
