import React from 'react';
import {
  Upload, MapPin, Sparkles, Mail, Phone
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  RecipientType, OccasionType, MusicStyleType, VoiceType, EmotionType, WizardData, RecipientGender
} from '../types';

interface StepProps {
  formData: WizardData;
  setFormData: React.Dispatch<React.SetStateAction<WizardData>>;
  fieldErrors?: Record<string, string>;
  relationshipCards: readonly { type: string; label: string; icon: string }[];
  occasionCards: readonly { type: string; label: string; icon: string }[];
  musicStyleCards: readonly { style: string; label: string; desc: string; icon: string }[];
  artistCards: readonly { name: string; style: string }[];
  voiceCards: readonly { type: string; label: string; desc: string }[];
  emotionCards: readonly { type: string; icon: string; label: string }[];
  photoFileRef: React.RefObject<HTMLInputElement | null>;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  suggestTab: 'viagem' | 'romance' | 'divertido' | 'quotidiano';
  setSuggestTab: React.Dispatch<React.SetStateAction<'viagem' | 'romance' | 'divertido' | 'quotidiano'>>;
}

export function Step1Relation({
  formData, setFormData, relationshipCards, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'relationshipCards' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <label className="text-xs font-mono text-stone-400 block font-semibold">Para quem é esta canção? (Selecione)</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {relationshipCards.map((card) => {
          const isSelected = formData.recipientRelation === card.type;
          return (
            <button
              id={`relation-btn-${card.type}`}
              key={card.type}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, recipientRelation: card.type as RecipientType }))}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/15 shadow'
                  : 'bg-stone-950/40 border-stone-850 text-stone-400 hover:text-stone-150 hover:border-stone-750'
              }`}
            >
              <span className="text-xl mb-1">{card.icon}</span>
              <span className="text-xxs sm:text-xs font-medium leading-tight">{card.label}</span>
            </button>
          );
        })}
      </div>
      {fieldErrors?.recipientRelation && (
        <p className="text-red-400 text-xs mt-1">{fieldErrors.recipientRelation}</p>
      )}

      <div className="space-y-3 pt-3 border-t border-stone-900">
        <div>
          <label id="recipient-name-lbl" className="text-xs font-mono text-stone-400 block mb-1.5 font-semibold">
            Qual é o nome da pessoa? (Primeiro nome ou alcunha)
          </label>
          <input
            id="recipient-name-input"
            type="text"
            placeholder="Anabela, Mamã Maria, Yuri..."
            value={formData.recipientName}
            onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
            className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300"
          />
          {fieldErrors?.recipientName && (
            <p className="text-red-400 text-xs mt-1">{fieldErrors.recipientName}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-mono text-stone-400 block mb-1.5 font-semibold">
            Género do destinatário?
          </label>
          <div className="flex gap-2">
            {(['Masculino', 'Feminino'] as const).map((g) => (
              <button
                key={g}
                id={`gender-btn-${g}`}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, recipientGender: g as RecipientGender }))}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  formData.recipientGender === g
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/15'
                    : 'bg-stone-950/40 border-stone-850 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {fieldErrors?.recipientGender && (
            <p className="text-red-400 text-xs mt-1">{fieldErrors.recipientGender}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-mono text-stone-400 block mb-1.5 font-semibold">
              Que apelido carinhoso essa pessoa te chama?
            </label>
            <input
              id="user-nick-input"
              type="text"
              placeholder="Fofinho, Amor, Campeão, Filho..."
              value={formData.userNick}
              onChange={(e) => setFormData(prev => ({ ...prev, userNick: e.target.value }))}
              className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300"
            />
            {fieldErrors?.userNick && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.userNick}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-mono text-stone-400 block mb-1.5 font-semibold">
              E tu, que apelido usas para essa pessoa?
            </label>
            <input
              id="recipient-nick-input"
              type="text"
              placeholder="Amor, Princesa, Meu Rei, Vida..."
              value={formData.recipientNick}
              onChange={(e) => setFormData(prev => ({ ...prev, recipientNick: e.target.value }))}
              className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300"
            />
            {fieldErrors?.recipientNick && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.recipientNick}</p>
            )}
          </div>
        </div>

        <p className="text-xxs text-amber-500 italic mt-1 font-mono">
          "Apelidos carinhosos = letra mais emocionante."
        </p>
      </div>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        🎵 Milhares de músicas já foram criadas para <strong className="text-amber-500/70">Mães, Esposas e Namoradas</strong> — a sua pode ser a próxima.
      </p>
    </div>
  );
}

export function Step2Occasion({
  formData, setFormData, occasionCards, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'occasionCards' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <label className="text-xs font-mono text-stone-400 block font-semibold">Selecione a Ocasião</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {occasionCards.map((card) => {
          const isSelected = formData.occasion === card.type;
          return (
            <button
              id={`occasion-btn-${card.type}`}
              key={card.type}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, occasion: card.type as OccasionType }))}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/15 shadow'
                  : 'bg-stone-950/40 border-stone-850 text-stone-400 hover:text-stone-150 hover:border-stone-750'
              }`}
            >
              <span className="text-xl mb-1">{card.icon}</span>
              <span className="text-xxs sm:text-xs font-medium leading-tight">{card.label}</span>
            </button>
          );
        })}
      </div>
      {fieldErrors?.occasion && (
        <p className="text-red-400 text-xs mt-1">{fieldErrors.occasion}</p>
      )}

      <div className="space-y-2 pt-3 border-t border-stone-900">
        <label className="text-xs font-mono text-stone-400 block font-semibold">
          O que aconteceu para esta música ser criada hoje?
        </label>
        <textarea
          id="why-created-today-textarea"
          rows={4}
          placeholder="Ex: Ela faz anos amanhã e quero surpreendê-la..."
          value={formData.whyCreatedToday}
          onChange={(e) => setFormData(prev => ({ ...prev, whyCreatedToday: e.target.value }))}
          className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700 leading-relaxed resize-none"
        />
        {fieldErrors?.whyCreatedToday && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.whyCreatedToday}</p>
        )}
        <p className="text-xxs text-stone-500 italic mt-1 font-mono">
          "Explique rapidamente porque decidiu criar esta música."
        </p>
      </div>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        💍 Aniversários e Declarações de Amor são as ocasiões mais escolhidas — a seguir vai escolher o ritmo perfeito 🎵
      </p>
    </div>
  );
}

export function Step3Style({
  formData, setFormData, musicStyleCards, artistCards, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'musicStyleCards' | 'artistCards' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <div>
        <label className="text-xs font-mono text-stone-400 block mb-2 font-semibold">Qual é o Ritmo Ideal?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {musicStyleCards.map((card) => {
            const isSelected = formData.musicStyle === card.style;
            return (
              <button
                id={`style-btn-${card.style}`}
                key={card.style}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, musicStyle: card.style as MusicStyleType }))}
                className={`p-3 rounded-xl border text-left transition-all flex h-full gap-3 cursor-pointer items-start ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/15'
                    : 'bg-stone-950/40 border-stone-850 text-stone-400 hover:text-stone-200 hover:border-stone-750'
                }`}
              >
                <div className="text-xl shrink-0 mt-0.5">{card.icon}</div>
                <div>
                  <h4 className="font-semibold text-stone-200 text-xs">{card.label}</h4>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-snug">{card.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        {fieldErrors?.musicStyle && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.musicStyle}</p>
        )}
      </div>

      <div className="pt-3 border-t border-stone-900 space-y-2">
        <label className="text-xs font-mono text-stone-400 block font-semibold">
          Escolha um Artista de Referência <span className="text-stone-600 font-normal">(Opcional)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {artistCards.map((artist) => {
            const isSelected = formData.referenceArtist === artist.name;
            return (
              <button
                id={`artist-btn-${artist.name.replace(/\s+/g, '-')}`}
                key={artist.name}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, referenceArtist: artist.name }))}
                className={`px-2 py-2 text-center rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/15'
                    : 'bg-stone-950/40 border-stone-850 text-stone-400 hover:text-stone-300'
                }`}
              >
                <span className="text-xs font-semibold leading-tight block">{artist.name}</span>
                <span className="text-[8px] text-stone-550 leading-tight block font-mono">{artist.style}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xxs text-stone-500 italic pt-1 font-mono">
          O artista de referência ajuda a acertar o tom.
        </p>
      </div>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        🎙️ No próximo passo: escolher <strong className="text-amber-500/70">quem vai cantar</strong> esta história
      </p>
    </div>
  );
}

export function Step4Voice({
  formData, setFormData, voiceCards, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'voiceCards' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <label className="text-xs font-mono text-stone-400 block font-semibold">Quem deve cantar?</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {voiceCards.map((card) => {
          const isSelected = formData.voiceType === card.type;
          return (
            <button
              id={`voice-btn-${card.type.replace(/\s+/g, '-')}`}
              key={card.type}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, voiceType: card.type as VoiceType }))}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-full cursor-pointer ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/15'
                  : 'bg-stone-950/40 border-stone-850 text-stone-400 hover:text-stone-200 hover:border-stone-750'
              }`}
            >
              <div>
                <h4 className="font-semibold text-stone-200 text-xs sm:text-sm">{card.label}</h4>
                <p className="text-xxs text-stone-500 mt-1 leading-relaxed">{card.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      {fieldErrors?.voiceType && (
        <p className="text-red-400 text-xs mt-1">{fieldErrors.voiceType}</p>
      )}
      <p className="text-xxs text-stone-500 italic mt-1 font-mono">
        "A voz certa transforma a emoção da letra."
      </p>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        ✍️ A seguir: contar o que torna essa pessoa <strong className="text-amber-500/70">verdadeiramente especial</strong> — são os detalhes que emocionam
      </p>
    </div>
  );
}

export function Step5Traits({
  formData, setFormData, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-xs font-mono text-stone-400 block font-semibold">
          O que torna esta pessoa especial? <span className="text-rose-500 font-black">*Obrigatório</span>
        </label>
        <textarea
          id="makes-special-textarea"
          rows={4}
          placeholder="Ex: É uma pessoa extremamente doce e presente, adora caminhar ao fim da tarde... Tem um sorriso contagiante..."
          value={formData.whatMakesSpecial}
          onChange={(e) => setFormData(prev => ({ ...prev, whatMakesSpecial: e.target.value }))}
          className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700 leading-relaxed resize-none"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { label: 'Doce e Carinhosa', append: 'É uma pessoa extremamente doce e carinhosa, com um coração gigante que acolhe todos à sua volta.' },
            { label: 'Forte e Inspiradora', append: 'É uma fonte inesgotável de força e inspiração, supera cada desafio com um sorriso que ilumina.' },
            { label: 'Divertida e Alegre', append: 'Traz alegria a cada momento com o seu sentido de humor único e gargalhada contagiante.' },
            { label: 'Sábia e Conselheira', append: 'Tem sempre a palavra certa na hora certa, uma sabedoria que admiro profundamente.' },
          ].map((pill, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                whatMakesSpecial: prev.whatMakesSpecial ? `${prev.whatMakesSpecial} ${pill.append}` : pill.append
              }))}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-850 border border-stone-850 hover:border-stone-700 text-[10px] text-stone-300 rounded-full font-medium transition-colors cursor-pointer"
            >
              {pill.label}
            </button>
          ))}
        </div>
        {fieldErrors?.whatMakesSpecial && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.whatMakesSpecial}</p>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-stone-900">
        <label className="text-xs font-mono text-stone-400 block font-semibold">
          O que só essa pessoa faz? (Manias, hábitos)
        </label>
        <textarea
          id="only-she-does-textarea"
          rows={4}
          placeholder="Ex: Fecha os olhos com força quando dá uma ruidosa gargalhada, canta desafinado no banho, encolhe os ombros quando tem frio..."
          value={formData.onlySheDoes}
          onChange={(e) => setFormData(prev => ({ ...prev, onlySheDoes: e.target.value }))}
          className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700 leading-relaxed resize-none"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { label: 'Sorriso Contagiante', append: 'tem um sorriso contagiante que ilumina qualquer divisão onde entra' },
            { label: 'Olhar Penetrante', append: 'olha nos olhos de uma forma que faz esquecer o mundo à volta' },
            { label: 'Cozinha Divinal', append: 'faz uma comida que aquece a alma, cada refeição é um abraço' },
            { label: 'Abraço de Apertar', append: 'abraça com tanta força e verdade que todos os problemas desaparecem' },
            { label: 'Gargalhada Única', append: 'dá uma gargalhada tão genuína e alta que é impossível não rir junto' },
          ].map((pill, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                onlySheDoes: prev.onlySheDoes ? `${prev.onlySheDoes} ${pill.append}` : pill.append
              }))}
              className="px-2.5 py-1 bg-stone-950 hover:bg-stone-850 border border-stone-850 hover:border-stone-700 text-[10px] text-stone-300 rounded-full font-medium transition-colors cursor-pointer"
            >
              {pill.label}
            </button>
          ))}
        </div>
        {fieldErrors?.onlySheDoes && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.onlySheDoes}</p>
        )}
        <p className="text-xxs text-amber-500 italic mt-1 font-mono">
          "Pequenos detalhes tornam a música única."
        </p>
      </div>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        📖 A seguir: partilhe uma <strong className="text-amber-500/70">memória inesquecível</strong> — vai inspirar a letra da música
      </p>
    </div>
  );
}

export function Step6Memory({
  formData, setFormData, suggestTab, setSuggestTab, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'suggestTab' | 'setSuggestTab' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-xs font-mono text-stone-400 block font-semibold flex justify-between items-center">
          <span>Memória Engraçada / Momento Único</span>
          <span className="text-[10px] text-amber-500 font-mono">Dica: Seja específico!</span>
        </label>
        <textarea
          id="unforgettable-memory-textarea"
          rows={4}
          placeholder="Ex: Aquele fim de semana fantástico na praia de Cabo Ledo, onde comemos churrasquinho sob o luar e rimos imenso sob as estrelas..."
          value={formData.unforgettableMemory}
          onChange={(e) => setFormData(prev => ({ ...prev, unforgettableMemory: e.target.value }))}
          className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700 leading-relaxed resize-none"
        />
        {fieldErrors?.unforgettableMemory && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.unforgettableMemory}</p>
        )}
      </div>

      <div className="bg-stone-900 border border-stone-850 rounded-xl p-3.5 space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-stone-850">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-extrabold tracking-wider text-amber-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Ideias de Composição & Detalhes Reais</span>
          </div>
          <span className="text-[9.5px] text-stone-500 font-mono">Toque para preencher ou anexar</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {(['viagem', 'romance', 'divertido', 'quotidiano'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSuggestTab(cat)}
              className={`px-2.5 py-1 text-[10px] font-mono tracking-tight rounded-md border transition-all uppercase cursor-pointer ${
                suggestTab === cat
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              {cat === 'viagem' && 'Viagens'}
              {cat === 'romance' && 'Romance'}
              {cat === 'divertido' && 'Divertido'}
              {cat === 'quotidiano' && 'Quotidiano'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-left">
          {suggestTab === 'viagem' && (
            <>
              <button
                type="button"
                onClick={() => {
                  const text = "Aquele luar inesquecível na praia de Cabo Ledo, sob a brisa fresca, em que partilhámos segredos embalados pelo eco das ondas e comemos mufete à beira-mar.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text,
                    whereItHappened: prev.whereItHappened || "Praia de Cabo Ledo"
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Passeio em Cabo Ledo</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "Aquele luar inesquecível na praia de Cabo Ledo, sob a brisa fresca, em que partilhámos segredos..."
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = "O domingo maravilhoso na Ilha de Luanda, em que passeámos descalços pela areia molhada, rimos das ondas fortes e dividimos um gelado de coco delicioso.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text,
                    whereItHappened: prev.whereItHappened || "Ilha de Luanda"
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Domingo na Ilha de Luanda</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "O domingo maravilhoso na Ilha de Luanda, em que passeámos descalços pela areia molhada..."
                </span>
              </button>
            </>
          )}

          {suggestTab === 'romance' && (
            <>
              <button
                type="button"
                onClick={() => {
                  const text = "O nosso primeiro encontro em Luanda, quando os nossos olhares se cruzaram e um nervosismo fofo tomou conta de nós, sabendo naquele segundo que era amor.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Primeiro Olhar do Encontro</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "O nosso primeiro encontro em Luanda, quando os nossos olhares se cruzaram e o coração bateu..."
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = "Aquele jantar em que a chama de uma vela iluminava o teu rosto de forma mágica, seguraste-me na mão e confessámos tudo o que sentíamos.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Jantar Romântico</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "Aquele jantar em que a chama de uma vela iluminava o teu rosto de forma mágica..."
                </span>
              </button>
            </>
          )}

          {suggestTab === 'divertido' && (
            <>
              <button
                type="button"
                onClick={() => {
                  const text = "Aquele dia em que fomos surpreendidos por um temporal no meio de Luanda e corremos rindo alto, ensopados até aos ossos, até encontrar um abrigo.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text,
                    whereItHappened: prev.whereItHappened || "Luanda"
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Chuva Inesperada</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "Aquele dia em que fomos surpreendidos por um temporal no meio de Luanda e corremos rindo alto..."
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = "A piada estúpida no carro em que começámos a rir com tanta intensidade que tivemos de parar na berma com lágrimas nos olhos de tanta cumplicidade.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Gargalhadas no Carro</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "A piada estúpida no carro em que começámos a rir com tanta intensidade..."
                </span>
              </button>
            </>
          )}

          {suggestTab === 'quotidiano' && (
            <>
              <button
                type="button"
                onClick={() => {
                  const text = "Os domingos calmos em que entraste de mansinho no quarto com duas chávenas de café quente e ficámos apenas deitados abraçados.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Pequeno-almoço na Cama</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "Os domingos calmos em que entraste de mansinho no quarto com duas chávenas de café quente..."
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = "A primeira vez que decidimos cozinhar juntos e o prato principal acabou completamente queimado. Acabámos a comer pão com boa disposição no chão.";
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory} ${text}` : text
                  }));
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-stone-700 rounded-lg text-left transition-all duration-300 group cursor-pointer"
              >
                <span className="font-sans font-bold text-[11px] text-amber-400 block group-hover:text-amber-300">Cozinhando Juntos</span>
                <span className="text-[10px] text-stone-400 line-clamp-2 mt-1 italic font-serif leading-relaxed">
                  "A primeira vez que decidimos cozinhar juntos e o prato principal acabou completamente queimado..."
                </span>
              </button>
            </>
          )}
        </div>

        <div className="space-y-1.5 pt-2 border-t border-stone-850/60">
          <span className="text-[9.5px] font-mono text-stone-400 font-bold tracking-wide uppercase block">Adicione Pormenores Sensoriais:</span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[
              { label: "+ Brisa do mar", append: " com a brisa maravilhosa do mar a acariciar o rosto e o embalo das ondas" },
              { label: "+ Luar de Luanda", append: " sob o clarão do luar de Luanda, reluzindo nas águas escuras da baía" },
              { label: "+ Música suave", append: " enquanto ao longe tocava um Semba ou Kizomba suave que parecia guiar os nossos passos" },
              { label: "+ Calor e Arrepio", append: " com aquele calor acolhedor no peito e um arrepio doce que nos congelou no tempo" }
            ].map((pill, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    unforgettableMemory: prev.unforgettableMemory ? `${prev.unforgettableMemory}${pill.append}` : pill.append.trim()
                  }));
                }}
                className="px-2 py-0.5 bg-stone-950 hover:bg-stone-850 border border-stone-850 hover:border-stone-700 text-[10px] text-stone-300 rounded-full font-medium transition-colors cursor-pointer"
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-stone-900">
        <label className="text-xs font-mono text-stone-400 block font-semibold">Onde aconteceu?</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
            <MapPin className="w-4 h-4 text-amber-500" />
          </div>
          <input
            id="where-it-happened-input"
            type="text"
            placeholder="Escreva a cidade, província ou local (Ex: Luanda, Benguela, Cabo Ledo...)"
            value={formData.whereItHappened}
            onChange={(e) => setFormData(prev => ({ ...prev, whereItHappened: e.target.value }))}
            className="w-full pl-10 pr-4 py-3.5 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700"
          />
          {fieldErrors?.whereItHappened && (
            <p className="text-red-400 text-xs mt-1">{fieldErrors.whereItHappened}</p>
          )}
        </div>
        <p className="text-xxs text-stone-500 italic mt-1 font-mono">
          "Lugares reais ajudam-nos a criar letras mais emocionantes."
        </p>
      </div>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        🎤 As memórias partilhadas transformam-se em versos — já ajudámos centenas de pessoas a eternizar momentos especiais
      </p>
    </div>
  );
}

export function Step7Message({
  formData, setFormData, emotionCards, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'emotionCards' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-xs font-mono text-stone-400 block font-semibold">
          O que gostarias que esta pessoa nunca esquecesse?
        </label>
        <textarea
          id="deep-message-textarea"
          rows={4}
          placeholder="Ex: Que sempre estarei ao seu lado, custe o que custar, e que essa pessoa mudou completamente as cores da minha vida..."
          value={formData.messageFromTheHeart}
          onChange={(e) => setFormData(prev => ({ ...prev, messageFromTheHeart: e.target.value }))}
          className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700 leading-relaxed resize-none"
        />
        {fieldErrors?.messageFromTheHeart && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.messageFromTheHeart}</p>
        )}
        <p className="text-xxs text-amber-500 italic mt-1 font-mono">
          "Escreva como se fosse uma carta de amor."
        </p>
      </div>

      <div className="space-y-2 pt-3 border-t border-stone-900">
        <label className="text-xs font-mono text-stone-400 block font-semibold">Escolha as emoções dominantes:</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {emotionCards.map((card) => {
            const isSelected = formData.desiredEmotion === card.type;
            return (
              <button
                id={`emotion-btn-${card.type}`}
                key={card.type}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, desiredEmotion: card.type as EmotionType }))}
                className={`px-3 py-3 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/15 shadow'
                    : 'bg-stone-950/40 border-stone-850 text-stone-400 hover:text-stone-150 hover:border-stone-750'
                }`}
              >
                <span className="text-xs sm:text-sm shrink-0">{card.icon}</span>
                <span className="text-xxs sm:text-xs font-medium leading-tight">{card.label}</span>
              </button>
            );
          })}
        </div>
        {fieldErrors?.desiredEmotion && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.desiredEmotion}</p>
        )}
      </div>
      <p className="text-[10px] text-amber-600/50 font-mono text-center pt-2 border-t border-stone-900/40 italic">
        "Daqui a um ano, vai preferir ter escrito esta mensagem do que não a ter escrito. Os momentos passam. As palavras ficam."
      </p>
    </div>
  );
}

export function Step8Photo({
  formData, photoFileRef, handlePhotoChange, fieldErrors
}: Pick<StepProps, 'formData' | 'photoFileRef' | 'handlePhotoChange' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <div
        onClick={() => photoFileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer bg-stone-950/40 relative min-h-[220px] flex flex-col justify-center items-center ${
          formData.photoUrl
            ? 'border-green-500/30 bg-stone-900'
            : 'border-stone-800 hover:border-stone-700'
        }`}
      >
        <input
          ref={photoFileRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />

        {formData.photoUrl ? (
          <div className="space-y-4 max-w-xs text-center">
            <div className="w-36 h-36 mx-auto rounded-xl overflow-hidden shadow-xl border border-stone-700 relative group">
              <img
                src={formData.photoUrl}
                alt="Dedicatória Casal"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xxs text-stone-300 font-semibold font-sans">Mudar imagem</span>
              </div>
            </div>
            <p className="text-xs text-green-400 font-medium">Foto idealizada carregada com sucesso!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-14 h-14 bg-stone-900 rounded-full flex items-center justify-center border border-stone-850 text-amber-500 mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-stone-255">Carregue ou arraste uma foto especial</p>
            <p className="text-xxs text-stone-500 max-w-sm mx-auto leading-relaxed">
              Formatos aceitáveis: JPG, PNG, JPEG. A foto ilustrará de fundo a dedicatória de reprodução da canção.
            </p>
          </div>
        )}
      </div>
      {fieldErrors?.photoUrl && (
        <p className="text-red-400 text-xs mt-1 text-center">{fieldErrors.photoUrl}</p>
      )}
      <p className="text-xxs text-stone-400 italic text-center font-mono">
        "Esta foto será exibida na página personalizada da música."
      </p>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        📸 92% dos clientes carregam uma foto — a dedicatória fica 3x mais emocionante com uma imagem especial
      </p>
    </div>
  );
}

export function Step9Contact({
  formData, setFormData, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-stone-400 tracking-wider font-semibold">Idioma da Letra</label>
          <select
            value={formData.language}
            onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
            className="w-full px-4 py-3 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs sm:text-sm font-medium outline-none"
          >
            <option value="Português">Português (Nacional)</option>
            <option value="Kimbundu">Mesclado com Kimbundu</option>
            <option value="UmBundu">Mesclado com UmBundu</option>
            <option value="Kikongo">Mesclado com Kikongo</option>
            <option value="Lingala">Mesclado com Lingala</option>
            <option value="Inglês">Inglês</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label id="user-email-lbl" className="text-xs font-mono text-stone-400 tracking-wider flex items-center gap-1.5 font-semibold">
            <Mail className="w-3.5 h-3.5" /> E-mail de Registo (Obrigatório)
          </label>
          <input
            id="user-email-input"
            type="email"
            placeholder="ex: seu-nome@dominio.com"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300"
          />
          {fieldErrors?.email && (
            <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label id="user-phone-lbl" className="text-xs font-mono text-stone-400 tracking-wider flex items-center gap-1.5 font-semibold">
            <Phone className="w-3.5 h-3.5" /> Telemóvel / WhatsApp (Obrigatório)
          </label>
          <input
            id="user-phone-input"
            type="tel"
            placeholder="+244 922 000 000"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300"
          />
          {fieldErrors?.phone && (
            <p className="text-red-400 text-xs mt-1">{fieldErrors.phone}</p>
          )}
        </div>
      </div>

      <p className="text-xxs text-stone-500 italic mt-1 font-mono">
        "O link da música será enviado para este email."
      </p>

      <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 text-xs text-stone-400 leading-normal max-w-md">
        "Estamos quase a transformar a tua história numa música."
      </div>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        🔒 Seus dados estão protegidos com encriptação — usados apenas para criar a sua música personalizada
      </p>
    </div>
  );
}
