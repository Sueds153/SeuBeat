import React, { useState, useMemo } from 'react';
import {
  Upload, MapPin, Mail, Phone, Cake, Heart as HeartIcon, GraduationCap, Home, Baby, Star, Sparkles, Calendar, Gift, Music, User
} from 'lucide-react';
import {
  RecipientType, OccasionType, MusicStyleType, VoiceType, WizardData, RecipientGender
} from '../types';
import { formatPhoneNumber } from '../lib/validation';
import { PRICING_PLANS } from '../constants/pricing';

interface StepProps {
  formData: WizardData;
  setFormData: React.Dispatch<React.SetStateAction<WizardData>>;
  fieldErrors?: Record<string, string>;
  relationshipCards: readonly { type: string; label: string; icon: string }[];
  occasionCards: readonly { type: string; label: string; icon: React.ReactNode }[];
  musicStyleCards: readonly { style: string; label: string; desc: string; icon: string }[];
  voiceCards: readonly { type: string; label: string; desc: string }[];
  photoFileRef: React.RefObject<HTMLInputElement | null>;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  todayCount: number;
  step: number;
  onFieldBlur?: (field: string, value: string) => void;
}

const STARTING_PRICE = PRICING_PLANS[0]?.price || '7.900 Kz';

export function Step1Relation({
  formData, setFormData, relationshipCards, fieldErrors, todayCount, step, onFieldBlur
}: Pick<StepProps, 'formData' | 'setFormData' | 'relationshipCards' | 'fieldErrors' | 'todayCount' | 'step' | 'onFieldBlur'>) {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-stone-400 block font-semibold">Para quem é esta canção? (Selecione)</label>
        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
          💰 A partir de {STARTING_PRICE}
        </span>
      </div>
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
            maxLength={100}
            value={formData.recipientName}
            onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
            onBlur={(e) => onFieldBlur?.('recipientName', e.target.value)}
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
      </div>
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        {formData.recipientRelation === 'Mãe' ? `+${todayCount} já fizeram para uma mãe` :
         formData.recipientRelation === 'Namorado' || formData.recipientRelation === 'Esposa' || formData.recipientRelation === 'Marido' ? `+${todayCount} declarações em música` :
         formData.recipientRelation === 'Pai' ? `+${todayCount} já fizeram para um pai` :
         formData.recipientRelation === 'Filho' ? `+${todayCount} músicas para filhos` :
         `+${todayCount} músicas criadas`}
      </p>
    </div>
  );
}

export function Step2Occasion({
  formData, setFormData, occasionCards, fieldErrors, step
}: Pick<StepProps, 'formData' | 'setFormData' | 'occasionCards' | 'fieldErrors' | 'step'>) {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-stone-400 block font-semibold">Selecione a Ocasião</label>
        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
          💰 A partir de {STARTING_PRICE}
        </span>
      </div>
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
      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        {formData.occasion === 'Declaração' ? 'Sabia que 9 em cada 10 pessoas que fizeram uma declaração em música receberam um "sim"? A sua pode ser a próxima.' :
         formData.occasion === 'Aniversário' ? 'Mais de 300 músicas de aniversário já foram entregues — um presente que não se esquece.' :
         formData.occasion === 'Casamento' ? 'Mais de 100 casais já eternizaram o amor deles numa canção — o próximo pode ser o vosso.' :
         formData.occasion === 'Aniversário de namoro' ? 'Mais de 200 músicas já celebraram amores que duram — celebrem o vosso também.' :
         'Aniversários e Declarações de Amor são as ocasiões mais escolhidas — a seguir vai escolher o ritmo perfeito'}
      </p>
    </div>
  );
}

export function Step3StyleVoice({
  formData, setFormData, musicStyleCards, voiceCards, fieldErrors, todayCount
}: Pick<StepProps, 'formData' | 'setFormData' | 'musicStyleCards' | 'voiceCards' | 'fieldErrors' | 'todayCount'>) {
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
      </div>

      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        {formData.musicStyle === 'Kizomba' ? 'A Kizomba é o estilo mais escolhido — perfeito para histórias de amor.' :
         formData.musicStyle === 'Semba' ? 'O Semba é a alma musical de Angola — uma escolha cheia de tradição.' :
         formData.musicStyle === 'Gospel' ? `Gospel: +${todayCount} músicas criadas` :
         'No próximo passo: contar a vossa história'}
      </p>
    </div>
  );
}

export function Step4Story({
  formData, setFormData, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'fieldErrors'>) {
  const appendStory = (text: string) => {
    setFormData(prev => {
      const next = prev.whatMakesSpecial ? `${prev.whatMakesSpecial} ${text}` : text;
      return { ...prev, whatMakesSpecial: next.slice(0, 4000) };
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-xs font-mono text-stone-300 block font-semibold flex items-center justify-between">
          <span>Momentos & Recordações Inesquecíveis</span>
          <span className="text-amber-400 font-mono text-[10px] uppercase font-bold tracking-wider">Obrigatório</span>
        </label>
        <textarea
          id="makes-special-textarea"
          rows={5}
          maxLength={4000}
          placeholder="Ex: Conta-nos um momento marcante, uma gargalhada ou o que torna esta pessoa única... Escreve à vontade, quanto mais detalhes contares, mais emocionante fica a canção."
          value={formData.whatMakesSpecial}
          onChange={(e) => setFormData(prev => ({ ...prev, whatMakesSpecial: e.target.value }))}
          className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700 leading-relaxed resize-none"
        />
        <div className="space-y-1 pt-0.5">
          <p className="text-[10px] text-stone-500 font-mono">Toque para adicionar ideias prontas em 1 segundo:</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '✨ Doce e Carinhosa', append: 'É uma pessoa extremamente doce e carinhosa, com um coração gigante que acolhe todos à sua volta.' },
              { label: '🔥 Forte e Inspiradora', append: 'É uma fonte inesgotável de força e inspiração, supera cada desafio com um sorriso que ilumina.' },
              { label: '😂 Divertida e Alegre', append: 'Traz alegria a cada momento com o seu sentido de humor único e gargalhada contagiante.' },
              { label: '🕊️ Sábia e Conselheira', append: 'Tem sempre a palavra certa na hora certa, uma sabedoria que admiro profundamente.' },
              { label: '💖 Memória Inesquecível', append: 'Guardo com carinho o momento em que tudo começou, uma memória que aquece o coração e nunca mais esqueci.' },
              { label: '👀 Primeiro Encontro', append: 'No primeiro encontro percebi que era especial — os olhares cruzaram-se e tudo à nossa volta desapareceu.' },
              { label: '🌊 Passeio à Beira-Mar', append: 'Aquele passeio à beira-mar sob o luar, partilhando segredos embalados pelo som das ondas.' },
              { label: '🍳 Cozinhando Juntos', append: 'Quando cozinhámos juntos e o prato correu mal, mas acabámos a rir no chão com boa disposição.' },
            ].map((pill, i) => (
              <button
                key={i}
                type="button"
                onClick={() => appendStory(pill.append)}
                className="px-2.5 py-1 bg-stone-950 hover:bg-stone-850 border border-stone-800 hover:border-amber-500/50 text-[10px] text-stone-300 rounded-full font-medium transition-all cursor-pointer active:scale-95"
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
        {fieldErrors?.whatMakesSpecial && (
          <p className="text-red-400 text-xs mt-1 font-semibold">{fieldErrors.whatMakesSpecial}</p>
        )}
      </div>

      <div className="space-y-2 pt-3 border-t border-stone-900">
        <label className="text-xs font-mono text-stone-300 block font-semibold flex items-center justify-between">
          <span>O Nosso Lugar Especial</span>
          <span className="text-stone-500 font-mono text-[10px] font-normal">(Opcional)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
            <MapPin className="w-4 h-4 text-amber-500" />
          </div>
          <input
            id="where-it-happened-input"
            type="text"
            maxLength={1000}
            placeholder="A cidade, praia ou local onde o vosso mundo parou (Ex: Luanda, Benguela, Cabo Ledo...)"
            value={formData.whereItHappened}
            onChange={(e) => setFormData(prev => ({ ...prev, whereItHappened: e.target.value }))}
            className="w-full pl-10 pr-4 py-3.5 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700"
          />
          {fieldErrors?.whereItHappened && (
            <p className="text-red-400 text-xs mt-1">{fieldErrors.whereItHappened}</p>
          )}
        </div>
        <p className="text-xxs text-stone-500 italic mt-1 font-mono">
          "Lugares reais ajudam a criar uma letra que toca a alma."
        </p>
      </div>

      <div className="space-y-2 pt-3 border-t border-stone-900">
        <label className="text-xs font-mono text-stone-300 block font-semibold flex items-center justify-between">
          <span>Mensagem do Coração</span>
          <span className="text-stone-500 font-mono text-[10px] font-normal">(Opcional)</span>
        </label>
        <textarea
          id="deep-message-textarea"
          rows={4}
          maxLength={4000}
          placeholder="Se só pudesses dizer mais uma frase do fundo do coração antes da música tocar, qual seria?"
          value={formData.messageFromTheHeart}
          onChange={(e) => setFormData(prev => ({ ...prev, messageFromTheHeart: e.target.value }))}
          className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-stone-100 outline-none text-xs sm:text-sm font-medium duration-300 placeholder-stone-700 leading-relaxed resize-none"
        />
        {fieldErrors?.messageFromTheHeart && (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.messageFromTheHeart}</p>
        )}
        <p className="text-xxs text-amber-400/80 italic mt-1 font-mono">
          "Esta mensagem inspirará a estrofe mais marcante da canção."
        </p>
      </div>

      <p className="text-[10px] text-stone-600 font-mono text-center pt-2 border-t border-stone-900/40">
        Os detalhes mais simples são os que geram as letras mais emocionantes — já transformámos centenas de histórias reais em canções inesquecíveis
      </p>
    </div>
  );
}

export function Step5Finalize({
  formData, setFormData, photoFileRef, handlePhotoChange, fieldErrors
}: Pick<StepProps, 'formData' | 'setFormData' | 'photoFileRef' | 'handlePhotoChange' | 'fieldErrors'>) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-xs font-mono text-stone-400 block font-semibold">
          Fotografia marcante do casal <span className="text-stone-600 font-normal">(Opcional)</span>
        </label>
        <div
          onClick={() => photoFileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 sm:p-8 text-center transition-all cursor-pointer bg-stone-950/40 relative min-h-[160px] sm:min-h-[180px] flex flex-col justify-center items-center ${
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
      </div>

      <div className="space-y-4 max-w-md pt-2 border-t border-stone-900">
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
            onBlur={() => setFormData(prev => ({ ...prev, phone: formatPhoneNumber(prev.phone) }))}
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
        Seus dados estão protegidos — usados apenas para criar e entregar a sua música. Mais de 800 músicas já foram criadas com segurança.
      </p>
    </div>
  );
}