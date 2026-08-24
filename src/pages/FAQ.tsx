import React from 'react';
import { FAQ } from '../components/FAQ';
import { HelpCircle } from 'lucide-react';

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#151210] text-stone-100 py-12 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
            <HelpCircle className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-stone-100">
            Perguntas Frequentes
          </h1>
          <p className="text-stone-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Encontre respostas rápidas para as dúvidas mais comuns. Se não encontrar o que procura, 
            <a href="https://wa.me/244922058136" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-mono text-xs">
              fale connosco no WhatsApp
            </a>.
          </p>
        </div>

        <FAQ showSearch={true} showCategories={true} compact={false} />
      </div>
    </div>
  );
}