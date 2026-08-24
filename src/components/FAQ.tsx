import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, X, HelpCircle } from 'lucide-react';
import { FAQ_ITEMS, FAQ_CATEGORIES } from '../lib/faq';

interface FAQProps {
  showSearch?: boolean;
  showCategories?: boolean;
  compact?: boolean;
  onClose?: () => void;
}

export function FAQ({ showSearch = true, showCategories = true, compact = false, onClose }: FAQProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const filteredItems = FAQ_ITEMS.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleItem = (index: number) => {
    const next = new Set(openItems);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setOpenItems(next);
  };

  const isOpen = (index: number) => openItems.has(index);

  return (
    <div className="space-y-4">
      {onClose && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 transition-colors rounded-lg hover:bg-stone-800/50"
            aria-label="Fechar FAQ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {showSearch && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
          <input
            type="text"
            placeholder="Procurar nas perguntas frequentes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium placeholder-stone-700"
          />
        </div>
      )}

      {showCategories && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
            }`}
          >
            Todas
          </button>
          {FAQ_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                  : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-stone-500">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 text-stone-600" />
            <p className="text-sm">Nenhuma pergunta encontrada.</p>
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const originalIndex = FAQ_ITEMS.indexOf(item);
            return (
              <div key={index} className="bg-stone-950/50 border border-stone-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleItem(originalIndex)}
                  className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3"
                  aria-expanded={isOpen(originalIndex)}
                >
                  <span className="text-stone-200 text-xs sm:text-sm font-medium leading-relaxed pr-8">
                    {item.question}
                  </span>
                  {isOpen(originalIndex) ? (
                    <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-stone-500 shrink-0" />
                  )}
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${isOpen(originalIndex) ? 'max-h-96 pb-4' : 'max-h-0'}`}>
                  <div className="px-4 text-stone-400 text-xs sm:text-sm leading-relaxed font-sans">
                    {item.answer.split('\n').map((line, i) => (
                      <p key={i} className="mb-2 last:mb-0">{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}