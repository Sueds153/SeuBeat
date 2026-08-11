import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowRight, ArrowLeft, Heart, Sparkles, Check, Upload,
  Mic, Mail, Eye, Lock, RefreshCw, Play, AlertTriangle, ShieldCheck, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StepErrorBoundary from './StepErrorBoundary';
import { 
  WizardData, INITIAL_WIZARD_DATA, RecipientType, OccasionType, 
  MusicStyleType, VoiceType, EmotionType 
} from '../types';
import {
  Step1Relation, Step2Occasion, Step3Style, Step4Voice,
  Step5Traits, Step6Memory, Step7Message, Step8Photo, Step9Contact
} from './WizardSteps';
import { validateStep as zodValidateStep, FieldErrors } from '../lib/validation';
import WhatsAppHelp from './WhatsAppHelp';
import LogoIcon from './LogoIcon';
import { 
  fbLead, fbSetUserData, fbStartWizard, fbWizardStep, fbLyricsGenerated, fbCheckoutView, parsePrice, generateEventId 
} from '../lib/metaPixel';
import { 
  gaViewContent, gaLead, gaCompleteRegistration, gaAddPaymentInfo, gaSubmitApplication, gaWizardStep, gaPageView 
} from '../lib/analytics';
import { DEMO_SONGS } from '../constants/demoSongs';
import { useUtm } from '../hooks/useUtm';
import { useSocialProof, formatMinutesAgo } from '../lib/socialProof';
import { CURRENCY } from '../constants/currency';
import { safeUUID } from '../lib/uuid';
import { buildTeaser, loadTeaserEdits, saveTeaserEdits, clearTeaserEdits, isTeaserEnabled, resetTeaserEnabledCache } from '../lib/lyricsTeaser';
import LyricsTeaserPreview from './LyricsTeaserPreview';

interface WizardProps {
  onBackToLanding: () => void;
}

type GenerationStatus =
  | 'idle'
  | 'lyrics_generating'
  | 'lyrics_ready'
  | 'music_processing'
  | 'error';

// Custom steps configuration with titles, subtitles, examples, and tips
const STEP_META = [
  {
    title: 'Para quem é esta canção? ❤️',
    subtitle: 'Escolha a relação e configure os nomes para rimas profundas.',
    example: 'Exemplo: "Para a minha Mãe (Dona Maria)", mostrando gratidão.',
    tip: 'Passo 1  • Os pormenores pessoais criam mais empatia na música.'
  },
  {
    title: 'Qual é a ocasião especial? 🎂',
    subtitle: 'O compasso e ritmo assentam na festa pretendida.',
    example: 'Exemplo: "Aniversário de Casamento", ou "Uma declaração sem motivo".',
    tip: 'Passo 2  • Conte-nos brevemente as razões da surpresa de hoje.'
  },
  {
    title: 'Qual é o estilo e artista de inspiração? 🎵',
    subtitle: 'Navegue pelos sons angolanos ou uma balada emocionante.',
    example: 'Exemplo: Kizomba ao estilo de Anselmo Ralph ou Chelsea Dinorath.',
    tip: 'Passo 3  • Isto ajuda a modelar com mais precisão a vibração ideal.'
  },
  {
    title: 'Quem deve cantar esta homenagem? 🎙️',
    subtitle: 'A voz transmite sentimentos inesquecíveis.',
    example: 'Exemplo: Voz Feminina celestial ou Dueto Romântico expressivo.',
    tip: 'Passo 4  • Note: A sua própria voz poderá ser personalizada na fase seguinte!'
  },
  {
    title: 'O que torna esta pessoa especial? ✨',
    subtitle: 'Escreva sobre os seus superpoderes e mimos diários.',
    example: 'Exemplo: "É uma pessoa muito atenciosa e canta sempre no banho de manhã."',
    tip: 'Passo 5  • Detalhes engraçados convertem-se no presente perfeito.'
  },
  {
    title: 'Onde e qual é a vossa memória forte? 📍',
    subtitle: 'O local e os momentos formam a lírica narrativa.',
    example: 'Exemplo: "Amamos passear em Luanda, e rimos imenso quando a tenda caiu no Cabo Ledo."',
    tip: 'Passo 6  • Locais e datas criam um ambiente imersivo fantástico.'
  },
  {
    title: 'O que gostaria de nunca esquecer? 🥹',
    subtitle: 'A mensagem pura do seu peito que compõe o marcante refrão.',
    example: 'Exemplo: "Que essa pessoa mudou a minha vida e que estarei sempre ao seu lado."',
    tip: 'Passo 7  • Escreva com verdade crua para derreter corações.'
  },
  {
    title: 'Fotografia marcante do casal 📸',
    subtitle: 'Esta foto preencherá o ecrã do player digital da dedicatória.',
    example: 'Exemplo: Um lindo retrato do aniversário passado juntos.',
    tip: 'Passo 8  • Acompanha o correio eletrónico nas capas de estúdio.'
  },
  {
    title: 'Contacto de segurança do autor 🛡️',
    subtitle: 'Preencha o correio eletrónico para o seu link privado de escuta.',
    example: 'Exemplo: Receba o ficheiro WAV directamente no WhatsApp.',
    tip: 'Passo 9  • Estamos quase prontos para criar a melodia!'
  }
];

const WIZARD_BUILD = '20260716_1';

const RELATIONSHIP_CARDS = [
  { type: 'Mãe', label: 'Mãe', icon: '❤️' },
  { type: 'Pai', label: 'Pai', icon: '⭐' },
  { type: 'Esposa', label: 'Esposa', icon: '💍' },
  { type: 'Marido', label: 'Marido', icon: '🤵' },
  { type: 'Namorado', label: 'Namorado(a)', icon: '💕' },
  { type: 'Ex-namorado', label: 'Ex-namorado(a)', icon: '💔' },
  { type: 'Filho', label: 'Filho(a)', icon: '👶' },
  { type: 'Irmão', label: 'Irmão(ã)', icon: '👨‍👩‍👧' },
  { type: 'Amigo', label: 'Amigo(a)', icon: '🤝' },
  { type: 'Avó-Avô', label: 'Avó/Avô', icon: '👵' },
  { type: 'Professor', label: 'Professor(a)', icon: '🎓' },
  { type: 'Pastor', label: 'Pastor(a)', icon: '🙏' },
  { type: 'Colega', label: 'Colega', icon: '💼' },
  { type: 'Para-mim', label: 'Para mim', icon: '✨' },
  { type: 'Outro', label: 'Outro', icon: '➕' }
];

const OCCASION_CARDS = [
  { type: 'Aniversário', label: 'Aniversário', icon: '🎂' },
  { type: 'Aniversário de namoro', label: 'Aniversário de namoro', icon: '💕' },
  { type: 'Casamento', label: 'Casamento', icon: '💍' },
  { type: 'Declaração', label: 'Declaração de amor', icon: '❤️' },
  { type: 'Agradecimento', label: 'Agradecimento', icon: '🙏' },
  { type: 'Homenagem', label: 'Homenagem', icon: '🏆' },
  { type: 'Pedido de desculpas', label: 'Pedido de desculpas', icon: '💔' },
  { type: 'Saudade', label: 'Saudade', icon: '📍' },
  { type: 'Sem motivo', label: 'Sem motivo', icon: '✨' }
];

const MUSIC_STYLE_CARDS = [
  { style: 'Kizomba', label: 'Kizomba', desc: 'Tarraxinha lenta, romântica e envolvente.', icon: '💃' },
  { style: 'Semba', label: 'Semba', desc: 'Ritmo angolano com muita tradição e guitarra viva.', icon: '🎸' },
  { style: 'Afrobeat', label: 'Afrobeat', desc: 'Moderno, dinâmico e carregado de energia.', icon: '🥁' },
  { style: 'Gospel', label: 'Gospel', desc: 'Harmonioso, coros de fé e piano edificador.', icon: '✨' },
  { style: 'Acoustic', label: 'Acústico', desc: 'Expressividade pura assente em violão e piano.', icon: '🕯️' },
  { style: 'Romantic Pop', label: 'Romantic Pop', desc: 'Balada radiofónica internacional com refrão forte.', icon: '🎹' },
  { style: 'Zouk', label: 'Zouk', desc: 'Ritmo caribenho romântico com sintetizadores suaves.', icon: '🌴' },
  { style: 'Balada', label: 'Balada', desc: 'Emocional e orquestrada, piano e cordas a envolver.', icon: '🎻' },
  { style: 'Pop', label: 'Pop', desc: 'Melodia cativante e produção polida, estilo radiofónico.', icon: '🌟' },
  { style: 'R&B', label: 'R&B', desc: 'Voz suave e groove envolvente, alma e sentimento.', icon: '🎤' },
  { style: 'Rap', label: 'Rap', desc: 'Flow ritmado e batida urbana, palavra poderosa.', icon: '🎧' },
  { style: 'Funk', label: 'Funk', desc: 'Batida contagiante, groove elétrico e dançante angolano.', icon: '🕺' },
  { style: 'Trap', label: 'Trap', desc: 'Batida pesada 808, flow moderno e atitude urbana.', icon: '🔥' },
  { style: 'Reggae', label: 'Reggae', desc: 'Ritmo descontraído, vibração positiva e bass pesado.', icon: '🌿' },
  { style: 'Samba', label: 'Samba', desc: 'Percussão vibrante, gingado brasileiro e energia festiva.', icon: '🥁' },
  { style: 'Hino', label: 'Hino', desc: 'Épico e solene, ideal para hinos corporativos e institucionais.', icon: '🏛️' }
];

const ARTIST_CARDS = [
  { name: 'Anselmo Ralph', style: 'R&B / Kizomba' },
  { name: 'Matias Damásio', style: 'Semba / Romântico' },
  { name: 'Gerilson Insrael', style: 'Afro Pop / Kizomba' },
  { name: 'Chelsea Dinorath', style: 'Neo-kizomba / R&B' },
  { name: 'Ary', style: 'Semba / Soul' },
  { name: 'Cef', style: 'Ghetto Zouk' },
  { name: 'Nelson Freitas', style: 'Zouk / R&B' },
  { name: 'Outro', style: 'Estilo Próprio' }
];

const VOICE_CARDS = [
  { type: 'Masculina', label: '👨 Masculina', desc: 'Voz quente, aveludada e profunda.' },
  { type: 'Feminina', label: '👩 Feminina', desc: 'Voz expressiva, meiga, meiga e angelical.' },
  { type: 'Dueto', label: '👩‍❤️‍👨 Dueto', desc: 'Harmonização perfeita de tom masculino e feminino de estúdio.' },
  { type: 'Sem preferência', label: '✨ Sem preferência', desc: 'A nossa equipa seleciona o timbre que melhor se adequa à letra criada.' }
];

const LOCATION_CARDS = [
  { name: 'Luanda', icon: '📍' },
  { name: 'Benguela', icon: '📍' },
  { name: 'Huambo', icon: '📍' },
  { name: 'Lubango', icon: '📍' },
  { name: 'Namibe', icon: '📍' },
  { name: 'Outro', icon: '➕' }
];

const EMOTION_CARDS = [
  { type: 'Amor', icon: '❤️', label: 'Amor' },
  { type: 'Emoção', icon: '🥹', label: 'Emoção' },
  { type: 'Gratidão', icon: '🙏', label: 'Gratidão' },
  { type: 'Carinho', icon: '💕', label: 'Carinho' },
  { type: 'Saudade', icon: '😢', label: 'Saudade' },
  { type: 'Inspiração', icon: '✨', label: 'Inspiração' }
];

export default function Wizard({ onBackToLanding }: WizardProps) {
  const [step, setStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.step && parsed.step >= 1 ? parsed.step : 1;
      }
    } catch {}
    return 1;
  });
  const [formData, setFormData] = useState<WizardData>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.formData) {
          return { ...INITIAL_WIZARD_DATA, ...parsed.formData };
        }
      }
    } catch {}
    return INITIAL_WIZARD_DATA;
  });
  const [paymentDetails, setPaymentDetails] = useState({ entidade: '10116', referencia: '929423278' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [rotatingMsgIndex, setRotatingMsgIndex] = useState(0);
  const [paymentSocialIdx, setPaymentSocialIdx] = useState(0);
  const [showProcessingWarning, setShowProcessingWarning] = useState(false);
  // Toast notification state
const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info'; id: number } | null>(null);

  useUtm();

  const socialProof = useSocialProof();
  const todayCount = socialProof.createdToday;
  const paymentProofs = [
    socialProof.lastPayment
      ? `👤 ${socialProof.lastPayment.firstName || 'Um cliente'} ${socialProof.lastPayment.minutesAgo <= 1 ? 'pagou agora' : `pagou há ${socialProof.lastPayment.minutesAgo} min`}`
      : null,
    socialProof.paidToday > 0
      ? `👥 +${socialProof.paidToday} ${socialProof.paidToday === 1 ? 'pagamento aprovado' : 'pagamentos aprovados'} hoje`
      : null,
    socialProof.paidTotal > 0 ? `✅ ${socialProof.paidTotal} compras concluídas` : null,
    socialProof.deliveredTotal > 0 ? `🎧 ${socialProof.deliveredTotal} músicas já entregues` : null,
  ].filter((x): x is string => Boolean(x));
  const activeProof = paymentProofs.length > 0 ? paymentProofs[paymentSocialIdx % paymentProofs.length] : '⏳ Pagamento por referência Multicaixa';
  const liveActivity = socialProof.lastActivity
    ? {
        text: `"A última música foi criada para ${socialProof.lastActivity.firstName || 'alguém especial'}"`,
        time: formatMinutesAgo(socialProof.lastActivity.minutesAgo),
      }
    : { text: '"A tua música pode ser a próxima história 🎵"', time: 'agora' };

  // Demo preview player (Ecrã 1)
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);

  // Checkout & Upsell States
  const [selectedPlanID, setSelectedPlanID] = useState<'standard' | 'express' | 'premium' | null>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.selectedPlanID || null;
      }
    } catch {}
    return null;
  });
  const [voiceUpsellApplied, setVoiceUpsellApplied] = useState(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.voiceUpsellApplied || false;
      }
    } catch {}
    return false;
  });
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showVoiceCloningScreen, setShowVoiceCloningScreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [clonedVoiceFile, setClonedVoiceFile] = useState<File | null>(null);
  const [copiedText, setCopiedText] = useState<'entidade' | 'referencia' | 'link' | null>(null);
  const [isDone, setIsDone] = useState(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.isDone || false;
      }
    } catch {}
    return false;
  }); // Order success screen
  const [generatedShareUrl, setGeneratedShareUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.generatedShareUrl || '';
      }
    } catch {}
    return '';
  });

  // Estado do upload de comprovativo de pagamento
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.paymentSubmitted || false;
      }
    } catch {}
    return false;
  });
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.paymentStatus || 'pending';
      }
    } catch {}
    return 'pending';
  });
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSubmitError, setPaymentSubmitError] = useState<string>('');
  // AI Song states powered by Claude
  const [aiSongTitle, setAiSongTitle] = useState(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.aiSongTitle || '';
      }
    } catch {}
    return '';
  });
  const [aiLyrics, setAiLyrics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.aiLyrics || [];
      }
    } catch {}
    return [];
  });
  const [aiLyricsSnippet, setAiLyricsSnippet] = useState(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.aiLyricsSnippet || '';
      }
    } catch {}
    return '';
  });
  const [aiLetterText, setAiLetterText] = useState(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.aiLetterText || '';
      }
    } catch {}
    return '';
  });
  
  // Lyrics Teaser state (Fase 4)
  const [teaserEnabled, setTeaserEnabled] = useState(false);
  const [lyricsTeaser, setLyricsTeaser] = useState<ReturnType<typeof buildTeaser> | null>(null);

  // Resume via /wizard?resume=<id> — aplicado uma única vez no mount
  const resumeAppliedRef = useRef(false);
  
  const [dbSongId, setDbSongId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.dbSongId || '';
      }
    } catch {}
    return '';
  });
  const [dbSongRequestId, setDbSongRequestId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.dbSongRequestId || '';
      }
    } catch {}
    return '';
  });
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(() => {
    try {
      const saved = localStorage.getItem('seubeat_wizard_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.generationStatus || 'idle';
      }
    } catch {}
    return 'idle';
  });
  const [generationError, setGenerationError] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Estado para edição de letra
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [regenerationsUsed, setRegenerationsUsed] = useState(0);
  const [regenerationsRemaining, setRegenerationsRemaining] = useState(2);
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [lyricsSaved, setLyricsSaved] = useState(false);
  const [conversionStep, setConversionStep] = useState<'preview' | 'plans'>('preview');

  // Limpar localStorage se a build do wizard mudou (evita cache velho)
  useEffect(() => {
    const savedVersion = localStorage.getItem('seubeat_wizard_version');
    if (savedVersion !== WIZARD_BUILD) {
      try {
        const saved = localStorage.getItem('seubeat_wizard_progress');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.dbSongId || parsed?.isDone || parsed?.paymentSubmitted) {
            localStorage.removeItem('seubeat_wizard_progress');
            window.location.reload();
            return;
          }
        }
      } catch {}
      localStorage.setItem('seubeat_wizard_version', WIZARD_BUILD);
    }
  }, []);

  // Buscar feature flags do servidor ao iniciar
  useEffect(() => {
    let mounted = true;
    isTeaserEnabled().then(enabled => {
      if (mounted) setTeaserEnabled(enabled);
    });
    return () => { mounted = false; };
  }, []);

  // Definir ecrã de preview quando a letra fica pronta
  useEffect(() => {
    if (generationStatus === 'lyrics_ready') {
      if (!resumeAppliedRef.current) {
        setConversionStep('preview');
        const PLAN_VALUES: Record<string, number> = { standard: 7900, express: 9900, premium: 14900 };
        const plan = selectedPlanID || 'standard';
        gaViewContent(plan, PLAN_VALUES[plan]);
        // Meta: letras geradas = CompleteRegistration real
        fbLyricsGenerated(safeUUID());
      }
    }
  }, [generationStatus]);

  // Meta: trackar quando vê os planos (checkout view)
  useEffect(() => {
    if (conversionStep === 'plans') {
      const PLAN_VALUES: Record<string, number> = { standard: 7900, express: 9900, premium: 14900 };
      const plan = selectedPlanID || 'standard';
      fbCheckoutView(plan, PLAN_VALUES[plan], CURRENCY, safeUUID());
    }
  }, [conversionStep]);

  // GA4: registar cada passo do wizard
  useEffect(() => {
    gaWizardStep(step);
  }, [step]);

  // Meta: wizard iniciado (primeira vez que chega ao step 1)
  const wizardStartedRef = useRef(false);
  useEffect(() => {
    if (step === 1 && !wizardStartedRef.current) {
      wizardStartedRef.current = true;
      fbStartWizard(safeUUID());
    }
  }, [step]);

  const wrappedSetFormData: React.Dispatch<React.SetStateAction<WizardData>> = (action) => {
    setFormData(action);
    setFieldErrors({});
  };

  // Persistir progresso no localStorage para sobreviver a refresh
  useEffect(() => {
    try {
      const { photoFile, ...rest } = formData;
      localStorage.setItem('seubeat_wizard_progress', JSON.stringify({
        formData: rest,
        step,
        isDone,
        generatedShareUrl,
        paymentSubmitted,
        paymentStatus,
        aiSongTitle,
        aiLyrics,
        aiLyricsSnippet,
        aiLetterText,
        dbSongId,
        dbSongRequestId,
        generationStatus,
        selectedPlanID,
        voiceUpsellApplied
      }));
    } catch {}
  }, [
    formData,
    step,
    isDone,
    generatedShareUrl,
    paymentSubmitted,
    paymentStatus,
    aiSongTitle,
    aiLyrics,
    aiLyricsSnippet,
    aiLetterText,
    dbSongId,
    dbSongRequestId,
    generationStatus,
    selectedPlanID,
    voiceUpsellApplied
  ]);

  // Polling automático: após refresh, verificar estado e continuar a vigiar
  useEffect(() => {
    if (!paymentSubmitted || !dbSongRequestId || !formData.email) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/payment-status?email=${encodeURIComponent(formData.email)}&requestId=${dbSongRequestId}`);
        const data = await res.json();
        if (data.status === 'approved') {
          setPaymentStatus('approved');
          showToast('Pagamento confirmado! A sua música será entregue em breve.', 'success');
        } else if (data.status === 'rejected') {
          setPaymentStatus('rejected');
          setPaymentNotes(data.notes || '');
          showToast('Pagamento rejeitado. Veja o motivo na tela.', 'error');
        }
      } catch {}
    };

    checkStatus();

    if (paymentStatus === 'pending') {
      const interval = setInterval(checkStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [paymentSubmitted, dbSongRequestId, formData.email, paymentStatus]);

  // Buscar dados Multicaixa do servidor
  useEffect(() => {
    fetch('/api/payment-details')
      .then(r => r.json())
      .then(d => { if (d.entidade && d.referencia) setPaymentDetails(d); })
      .catch(() => {});
  }, []);

  // Identificar utilizador no Sentry quando o email é preenchido
  useEffect(() => {
    const email = formData.email?.trim();
    if (email && email.includes('@')) {
      import('@sentry/react').then((mod) => {
        try { (mod as any).setUser({ email }); } catch {}
      }).catch(() => {});
    }
  }, [formData.email]);

  // Helper para mostrar toasts
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const id = Date.now();
    setToast({ message, type, id });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };
  useEffect(() => () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); }, []);

  const proofMountedRef = useRef(true);
  useEffect(() => { proofMountedRef.current = true; return () => { proofMountedRef.current = false; }; }, []);

  // Resume via /wizard?resume=<requestId> — reconstrói o wizard com a letra já gerada
  useEffect(() => {
    if (resumeAppliedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get('resume');
    if (!resumeId || dbSongId) return;

    resumeAppliedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const { fetchResumeData } = await import('../api/song');
        const data = await fetchResumeData(resumeId);
        if (cancelled) return;
        if (!data || !data.success || !data.data) {
          showToast('Pedido não encontrado ou expirado. Inicie novamente.', 'error');
          return;
        }

        const rd = data.data;
        const fd = rd.formData || {};
        wrappedSetFormData(prev => ({
          ...prev,
          ...fd
        }));
        if (rd.aiSongTitle) setAiSongTitle(rd.aiSongTitle);
        if (Array.isArray(rd.aiLyrics) && rd.aiLyrics.length) {
          setAiLyrics(rd.aiLyrics);
          setAiLyricsSnippet(rd.aiLyricsSnippet || rd.aiLyrics.join('\n').slice(0, 200));
        }
        if (rd.aiLetterText) setAiLetterText(rd.aiLetterText);
        if (rd.dbSongId) setDbSongId(rd.dbSongId);
        if (rd.dbSongRequestId) setDbSongRequestId(rd.dbSongRequestId);

        setGenerationStatus('lyrics_ready');
        setConversionStep('plans');

        const fullLyrics = Array.isArray(rd.aiLyrics) ? rd.aiLyrics.join('\n') : '';
        const teaserOn = await isTeaserEnabled();
        setTeaserEnabled(teaserOn);
        if (teaserOn && fullLyrics) {
          setLyricsTeaser(buildTeaser(fullLyrics));
        }

        showToast('Pedido retomado! Escolhe o teu plano para continuar.', 'success');
      } catch {
        if (!cancelled) {
          showToast('Não foi possível retomar o pedido. Tente novamente.', 'error');
        }
      }
    })();

    return () => { cancelled = true; resumeAppliedRef.current = false; };
  }, [dbSongId]);

  useEffect(() => {
    if (proofFile && !paymentSubmitting && !paymentSubmitted && !paymentSubmitError) {
      submitPaymentProof();
    }
  }, [proofFile]);

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setPaymentSubmitError('O comprovativo não pode exceder 10MB.');
        e.target.value = '';
        return;
      }
      setProofFile(file);
      setPaymentSubmitError('');
    }
  };

  const submitPaymentProof = async () => {
    if (!dbSongRequestId) {
      setPaymentSubmitError('Nao foi possivel associar o pagamento ao pedido. Tente gerar a musica novamente.');
      return;
    }

    if (!proofFile) {
      setPaymentSubmitError('Por favor, selecione um ficheiro de comprovativo primeiro.');
      return;
    }

    setPaymentSubmitting(true);
    setPaymentSubmitError('');

    try {
      // Ler arquivo de comprovativo como base64
      const reader = new FileReader();
      reader.readAsDataURL(proofFile);
      reader.onloadend = async () => {
        if (!proofMountedRef.current) { setPaymentSubmitting(false); return; }
        const base64Data = reader.result as string;

        let voiceBase64 = null;
        let voiceFilename = null;
        let voiceMimeType = null;

        const postPaymentData = async (proofStr: string, voiceStr: string | null, voiceName: string | null, voiceType: string | null) => {
          try {
            // Generate deterministic eventIds for cross-device deduplication
            const checkoutEventId = generateEventId(dbSongRequestId, 'InitiateCheckout');
            const addPaymentEventId = generateEventId(dbSongRequestId, 'AddPaymentInfo');
            const submitAppEventId = generateEventId(dbSongRequestId, 'SubmitApplication');
            
            const res = await fetch('/api/submit-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                songRequestId: dbSongRequestId || null,
                userEmail: formData.email,
                phone: formData.phone,
                plan: selectedPlanID || 'standard',
                amount: getPrice(),
                proofBase64: proofStr,
                proofFilename: proofFile.name,
                proofMimeType: proofFile.type,
                voiceSampleBase64: voiceStr,
                voiceSampleFilename: voiceName,
                voiceSampleMimeType: voiceType,
                eventIds: {
                  initiateCheckout: checkoutEventId,
                  addPaymentInfo: addPaymentEventId,
                  submitApplication: submitAppEventId
                }
              })
            });

            const data = await res.json();
            if (res.ok && data.success) {
              setPaymentSubmitted(true);
              setPaymentSubmitError('');
              fbSetUserData(formData.email, formData.phone);
              gaSubmitApplication(selectedPlanID || 'standard', parsePrice(getPrice()));
            } else if (res.status === 409) {
              setPaymentSubmitted(true);
              setPaymentSubmitError('');
            } else {
              setPaymentSubmitError(data.error || 'Erro ao submeter o comprovativo.');
            }
          } catch (fetchErr: any) {
            setPaymentSubmitError('O servidor demorou a responder, mas pode já ter recebido o seu comprovativo. Use o botão "Verificar Estado" abaixo para confirmar.');
          } finally {
            setPaymentSubmitting(false);
          }
        };

        if (clonedVoiceFile) {
          const voiceReader = new FileReader();
          voiceReader.readAsDataURL(clonedVoiceFile);
          voiceReader.onloadend = async () => {
            if (!proofMountedRef.current) { setPaymentSubmitting(false); return; }
            voiceBase64 = voiceReader.result as string;
            voiceFilename = clonedVoiceFile.name;
            voiceMimeType = clonedVoiceFile.type;
            await postPaymentData(base64Data, voiceBase64, voiceFilename, voiceMimeType);
          };
          voiceReader.onerror = () => {
            setPaymentSubmitError('Erro ao ler o ficheiro de voz.');
            setPaymentSubmitting(false);
          };
        } else {
          await postPaymentData(base64Data, null, null, null);
        }
      };
      reader.onerror = () => {
        setPaymentSubmitError('Erro ao ler o comprovativo.');
        setPaymentSubmitting(false);
      };
    } catch (err: any) {
      setPaymentSubmitError('Erro ao processar o ficheiro: ' + err.message);
      setPaymentSubmitting(false);
    }
  };

  const [instructionsOpen, setInstructionsOpen] = useState(false);

  // Memory writing suggestions UI tab state
  const [suggestTab, setSuggestTab] = useState<'viagem' | 'romance' | 'divertido' | 'quotidiano'>('viagem');

  const photoFileRef = useRef<HTMLInputElement>(null);
  const submissionStartedRef = useRef(false);
  const isRecheckingRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (audioBlob.size === 0) {
          showToast('Nenhum áudio captado. Tente novamente com o microfone ligado.', 'error');
          setClonedVoiceFile(null);
          setHasRecorded(false);
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const file = new File([audioBlob], 'sample_vocal.wav', { type: 'audio/wav' });
        setClonedVoiceFile(file);
        setHasRecorded(true);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setHasRecorded(false);
    } catch (err) {
      console.error('Error starting recording:', err);
      showToast('Não foi possível aceder ao microfone. Verifique as permissões.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  

  // Processing message rotator while the real backend workflow runs.
  useEffect(() => {
    if (isSubmitting) {
      setShowProcessingWarning(false);
      const rotateTimer = setInterval(() => {
        setRotatingMsgIndex((prev) => (prev + 1) % 4);
      }, 3000);
      const warnTimer = setTimeout(() => setShowProcessingWarning(true), 30000);

      return () => {
        clearInterval(rotateTimer);
        clearTimeout(warnTimer);
      };
    }
  }, [isSubmitting]);

  // Payment social proof rotator (dados reais da BD)
  useEffect(() => {
    if (!isDone || paymentProofs.length < 2) return;
    const interval = setInterval(() => {
      setPaymentSocialIdx(i => (i + 1) % paymentProofs.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isDone, paymentProofs.length]);

  // Meta: registar quando o ecrã de pagamento é visto (uma vez por pedido)
  const paymentScreenTrackedRef = useRef(false);
  useEffect(() => {
    if (isDone && !paymentScreenTrackedRef.current) {
      paymentScreenTrackedRef.current = true;
      fbWizardStep('payment_screen', 9, safeUUID());
    }
  }, [isDone]);

  const pollCancelledRef = useRef(false);

  const pollSongUntilPreview = async (songId: string, maxAttempts = 15) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (pollCancelledRef.current) return false;
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 8000));
      }

      const controller = new AbortController();
      const pollTimeout = setTimeout(() => controller.abort(), 15000);
      try {
        const statusRes = await fetch(`/api/song/${songId}`, { signal: controller.signal });

        if (!statusRes.ok) {
          throw new Error('Nao foi possivel consultar o estado da musica.');
        }

        const song = await statusRes.json();
        const requestStatus = song?.data?.status;
        const previewUrl = song?.data?.preview_url;

        if (requestStatus === 'failed' || song?.data?.mureka_status === 'failed') {
          throw new Error('A geracao da musica falhou. Tente novamente.');
        }

        if (previewUrl && (requestStatus === 'music_ready' || song?.data?.mureka_status === 'completed')) {
          setProcessingStage(4);
          setIsSubmitting(false);
          return true;
        }

        if (requestStatus === 'lyrics_ready') {
          setGenerationStatus('lyrics_ready');
          setProcessingStage(3);
          setIsSubmitting(false);
          return false;
        } else {
          setGenerationStatus('music_processing');
          setProcessingStage(4);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          continue;
        }
        throw err;
      } finally {
        clearTimeout(pollTimeout);
      }
    }

    setGenerationStatus('lyrics_ready');
    setProcessingStage(3);
    setIsSubmitting(false);
    return false;
  };

  // Cleanup polling on unmount; reset on mount (StrictMode remount fix)
  useEffect(() => {
    pollCancelledRef.current = false;
    return () => { pollCancelledRef.current = true; };
  }, []);

  // Recupera uma letra já criada no servidor quando a geração "falhou" no cliente
  // (falha de rede/timeout após o servidor ter concluído). Evita duplicatas.
  // Janela total ≈ 60s (5 tentativas × 8s + 4 backoffs × 5s) para cobrir gerações lentas.
  const tryRecoverExistingLyrics = async () => {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`/api/latest-song?email=${encodeURIComponent(formData.email)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return false;
        const data = await res.json();
        if (data?.success && data?.found && data.dbSongId && data.dbSongRequestId) {
          setAiSongTitle(data.songTitle);
          setAiLyrics(data.lyrics);
          setAiLyricsSnippet(data.lyricsSnippet);
          setAiLetterText(data.letterText);
          setDbSongId(data.dbSongId);
          setDbSongRequestId(data.dbSongRequestId);
          setGenerationStatus('lyrics_ready');
          setProcessingStage(3);
          showToast('A sua letra já tinha sido criada. Aqui está!', 'success');
          return true;
        }
      } catch {
        // ligação falhou de novo — tenta outra vez
      }
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    return false;
  };

  // Call Claude Lyric Generator API on submission
  useEffect(() => {
    if (isSubmitting) {
      if (submissionStartedRef.current) return;
      if (isRecheckingRef.current) {
        isRecheckingRef.current = false;
        return;
      }
      submissionStartedRef.current = true;
      
      const submitData = async () => {
        setGenerationStatus('lyrics_generating');
        setGenerationError('');
        setProcessingStage(1);
        setDbSongId('');
        setDbSongRequestId('');

        try {
          let photoBase64 = null;
          let photoFilename = null;
          let photoMimeType = null;

          if (formData.photoFile) {
            try {
              let file = formData.photoFile;
              if (file.size > 4 * 1024 * 1024) {
                const compressed = await new Promise<Blob | null>((resolve) => {
                  const img = new Image();
                  const url = URL.createObjectURL(file);
                  img.onload = () => {
                    URL.revokeObjectURL(url);
                    let w = img.width;
                    let h = img.height;
                    const maxDim = 1920;
                    if (w > maxDim || h > maxDim) {
                      if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                      else { w = Math.round(w * maxDim / h); h = maxDim; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(null); return; }
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
                  };
                  img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
                  img.src = url;
                });
                if (compressed) file = new File([compressed], file.name, { type: 'image/jpeg' });
              }
              photoBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
              });
              photoFilename = file.name;
              const rawMime = (file.type || '').toLowerCase();
              const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
              photoMimeType = rawMime === 'image/jpg' ? 'image/jpeg'
                : (ALLOWED_MIMES.includes(rawMime) ? rawMime : null);
            } catch (e) {
              console.error('Error reading photo file:', e);
              showToast('Erro ao ler a foto. Tente selecionar novamente.', 'error');
            }
          }

          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 180000);

          const { photoFile: _pf, photoUrl: _pu, ...formBody } = formData;
          const payload: Record<string, unknown> = { ...formBody };
          if (!payload.email) delete payload.email;
          if (!payload.userNick) payload.userNick = undefined;
          if (!payload.recipientNick) payload.recipientNick = undefined;
          if (!payload.referenceArtist) payload.referenceArtist = undefined;
          if (!payload.whyCreatedToday) payload.whyCreatedToday = undefined;
          if (!payload.whatMakesSpecial) payload.whatMakesSpecial = undefined;
          if (!payload.onlySheDoes) payload.onlySheDoes = undefined;
          if (!payload.unforgettableMemory) payload.unforgettableMemory = undefined;
          if (!payload.whereItHappened) payload.whereItHappened = undefined;
          if (!payload.messageFromTheHeart) payload.messageFromTheHeart = undefined;
          const rawUtm = sessionStorage.getItem('seubeat_utm_params');
          if (rawUtm) {
            try { Object.assign(payload, JSON.parse(rawUtm)); } catch { /* ignore */ }
          }
          const res = await fetch('/api/generate-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              photoBase64,
              photoFilename,
              photoMimeType
            }),
            signal: controller.signal
          });
          clearTimeout(fetchTimeout);

          if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Erro na conexão' }));
            if (data.validation_errors?.length) {
              const fields = data.validation_errors.map((e: any) => e.field || e.path || 'campo').join(', ');
              throw new Error(`Campos inválidos: ${fields}.`);
            }
            throw new Error(data.error || `Erro ${res.status}: Não foi possível gerar a letra.`);
          }

          const data = await res.json();
          
          if (!data.success) {
            throw new Error(data.error || 'Não foi possível gerar a letra agora.');
          }

          if (!data.dbSongId || !data.dbSongRequestId) {
            throw new Error('O pedido não foi guardado corretamente. Tente novamente.');
          }

          setAiSongTitle(data.songTitle);
          setAiLyrics(data.lyrics);
          setAiLyricsSnippet(data.lyricsSnippet);
          setAiLetterText(data.letterText);
          setDbSongId(data.dbSongId);
          setDbSongRequestId(data.dbSongRequestId);
          fbSetUserData(formData.email, formData.phone);
          fbLead('lyrics_generated', data.dbSongRequestId);
          gaLead(data.dbSongRequestId);

          setGenerationStatus('lyrics_ready');
          setProcessingStage(3);

          // Fase 4: Build lyrics teaser if feature flag enabled
          const fullLyrics = Array.isArray(data.lyrics) ? data.lyrics.join('\n') : data.lyrics || '';
          const teaserOn = await isTeaserEnabled();
          setTeaserEnabled(teaserOn);
          if (teaserOn && fullLyrics) {
            const teaser = buildTeaser(fullLyrics);
            setLyricsTeaser(teaser);
            clearTeaserEdits(data.dbSongRequestId); // Clear old edits for new generation
          }

          await pollSongUntilPreview(data.dbSongId);
          if (generationStatus !== 'error') {
            showToast('Letra criada com sucesso! Reveja e edite se necessário.', 'success');
          }
          submissionStartedRef.current = false;
        } catch (err: any) {
          console.error('Error generating AI lyrics:', err);
          const recovered = await tryRecoverExistingLyrics();
          if (!recovered) {
            setGenerationStatus('error');
            const errorMsg = err.message || 'Erro ao gerar. Tente novamente.';
            setGenerationError(errorMsg);
            showToast(errorMsg, 'error');
          }
          setIsSubmitting(false);
          submissionStartedRef.current = false;
        }
      };
      
      submitData();
    }
  }, [isSubmitting, formData]);

  // Recording timer countdown ticker simulation
  useEffect(() => {
    let recTimer: NodeJS.Timeout | null = null;
    if (isRecording) {
      recTimer = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 20) return 20;
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (recTimer) clearInterval(recTimer);
    };
  }, [isRecording]);

  // Stop recording when timer reaches 20s
  useEffect(() => {
    if (recordingSeconds >= 20 && isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      setHasRecorded(true);
    }
  }, [recordingSeconds, isRecording]);

  // Order Finalization effect: saves locally and generates sharing URL
  useEffect(() => {
    if (isDone) {
      // 1. Save locally to populate PersonalizedSongPage on reload
      const serialData = {
        recipientName: formData.recipientName,
        recipientNick: formData.recipientNick,
        userNick: formData.userNick,
        musicStyle: formData.musicStyle,
        unforgettableMemory: formData.unforgettableMemory,
        whereItHappened: formData.whereItHappened,
        messageFromTheHeart: aiLetterText || formData.messageFromTheHeart || 'Fiz esta música com todo o carinho do mundo para ti...',
        photoUrl: formData.photoUrl || '',
        songId: dbSongId || ''
      };
      localStorage.setItem('seubeat_last_created', JSON.stringify(serialData));
      if (dbSongId) localStorage.setItem('seubeat_last_song_id', dbSongId);

      // 2. Generate sharing URL — apenas com ?id= para não expor dados pessoais na URL
      const slug = (formData.recipientName || 'especial')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
        
      const shareUrl = dbSongId
        ? `${window.location.origin}/song/${slug}?id=${dbSongId}`
        : `${window.location.origin}/song/${slug}`;
      setGeneratedShareUrl(shareUrl);
    }
  }, [isDone, formData, aiLetterText, aiSongTitle, aiLyrics, dbSongId]);

  // 7. Check voice cloning failure after song is done
  const [voiceCloningFailed, setVoiceCloningFailed] = useState(false);
  useEffect(() => {
    if (!isDone || !dbSongId) return;
    fetch(`/api/song/${dbSongId}?checkVoice=true`)
      .then(r => r.json())
      .then(d => {
        try {
          const voiceId = d.data?.elevenlabs_voice_id;
          if (voiceId && typeof voiceId === 'string') {
            const parsed = JSON.parse(voiceId);
            if (parsed?.failed === true) setVoiceCloningFailed(true);
          }
      } catch {
        // Silencioso — o polling retenta automaticamente a cada 30s
      }
      })
      .catch(() => {});
  }, [isDone, dbSongId]);

  // Handlers
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showToast('A foto excede 5MB. Comprima a imagem ou escolha outra.', 'error');
        e.target.value = '';
        return;
      }
      const url = URL.createObjectURL(file);
      wrappedSetFormData(prev => {
        if (prev.photoUrl?.startsWith('blob:')) URL.revokeObjectURL(prev.photoUrl);
        return { ...prev, photoFile: file, photoUrl: url };
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          sessionStorage.setItem('seubeat_photo_base64', reader.result as string);
        } catch {
          // Foto demasiado grande para sessionStorage (quota excedida) — ignora
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const blobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const savedBase64 = sessionStorage.getItem('seubeat_photo_base64');
    if (savedBase64 && (!formData.photoUrl || formData.photoUrl.startsWith('blob:'))) {
      try {
        const byteString = atob(savedBase64.split(',')[1]);
        const mimeString = savedBase64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: mimeString });
        const file = new File([blob], 'foto.' + (mimeString.split('/')[1] || 'jpg'), { type: mimeString });
        const url = URL.createObjectURL(file);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        wrappedSetFormData(prev => ({ ...prev, photoFile: file, photoUrl: url }));
      } catch (e) {
        sessionStorage.removeItem('seubeat_photo_base64');
      }
    } else if (!savedBase64 && formData.photoUrl?.startsWith('blob:')) {
      wrappedSetFormData(prev => ({ ...prev, photoUrl: '' }));
      showToast('A foto foi perdida após o recarregamento. Selecione novamente.', 'error');
    }
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);

  const prevPhotoUrlRef = useRef(formData.photoUrl);
  useEffect(() => {
    if (prevPhotoUrlRef.current && !formData.photoUrl) {
      sessionStorage.removeItem('seubeat_photo_base64');
    }
    prevPhotoUrlRef.current = formData.photoUrl;
  }, [formData.photoUrl]);

  const validateStep = () => {
    switch (step) {
      case 1:
        return formData.recipientRelation !== '' && 
               formData.recipientGender !== '' &&
               formData.recipientName.trim().length >= 2;
      case 2:
        return formData.occasion !== '' && formData.whyCreatedToday.trim().length >= 5;
      case 3:
        return formData.musicStyle !== '';
      case 4:
        return formData.voiceType !== '';
      case 5:
        return true;
      case 6:
        return true;
      case 7:
        return formData.desiredEmotion !== '';
      case 8:
        return true;
      case 9:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && formData.phone.trim().length >= 7;
      default:
        return true;
    }
  };

  const handleNext = () => {
    const errors = zodValidateStep(step, formData as unknown as Record<string, unknown>);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (step < 9) {
      const nextStepNum = step + 1;
      setStep(nextStepNum);
      fbWizardStep(`step_${nextStepNum}`, nextStepNum, safeUUID());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      fbSetUserData(formData.email, formData.phone);
      // Trigger Submitting / Composition simulation
      submissionStartedRef.current = false;
      setDbSongId('');
      setDbSongRequestId('');
      setGenerationStatus('idle');
      setGenerationError('');
      setProcessingStage(0);
      setIsSubmitting(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const retryGeneration = async () => {
    submissionStartedRef.current = false;
    const recovered = await tryRecoverExistingLyrics();
    if (recovered) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setDbSongId('');
    setDbSongRequestId('');
    setGenerationStatus('idle');
    setGenerationError('');
    setIsSubmitting(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recheckMusicStatus = async () => {
    if (!dbSongId) return;
    isRecheckingRef.current = true;
    setIsSubmitting(true);
    setGenerationError('');
    setGenerationStatus('music_processing');
    try {
      const previewReady = await pollSongUntilPreview(dbSongId, 30);
      if (!previewReady) {
        setIsSubmitting(false);
        setGenerationStatus('lyrics_ready');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setGenerationStatus('error');
      setGenerationError(err.message || 'Nao foi possivel consultar a musica.');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onBackToLanding();
    }
  };

  const handlePlanSelection = (pId: 'standard' | 'express' | 'premium') => {
    if (!dbSongRequestId) {
      setPaymentSubmitError('Ainda nao existe um pedido guardado para associar ao pagamento. Tente novamente.');
      return;
    }

    setSelectedPlanID(pId);
    const PLAN_VALUES: Record<string, number> = { standard: 7900, express: 9900, premium: 14900 };
    gaAddPaymentInfo(pId, PLAN_VALUES[pId]);
    if (pId === 'premium') {
      setVoiceUpsellApplied(true);
      setShowVoiceCloningScreen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Standard ou Express: mostrar modal de upsell de voz
      setShowUpsellModal(true);
    }
  };

  const getPrice = () => {
    if (voiceUpsellApplied) return '14.900 Kz';
    if (selectedPlanID === 'express') return '9.900 Kz';
    if (selectedPlanID === 'premium') return '14.900 Kz';
    return '7.900 Kz'; // standard
  };

  const getPriceNumber = (): number => {
    if (voiceUpsellApplied) return 14900;
    if (selectedPlanID === 'express') return 9900;
    if (selectedPlanID === 'premium') return 14900;
    return 7900;
  };

  const handleSaveLyrics = async () => {
    if (!dbSongId || !editedLyrics.trim()) return;
    setSavingLyrics(true);
    try {
      const res = await fetch(`/api/song/${dbSongId}/lyrics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: editedLyrics.split('\n').filter(l => l.trim()),
          lyrics_snippet: editedLyrics.slice(0, 200)
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiLyrics(editedLyrics.split('\n').filter(l => l.trim()));
        setAiLyricsSnippet(editedLyrics.slice(0, 200));
        setLyricsSaved(true);
        setEditingLyrics(false);
        showToast('Letra guardada com sucesso!', 'success');
        setTimeout(() => setLyricsSaved(false), 3000);
      } else {
        showToast(data.error || 'Erro ao guardar letra.', 'error');
      }
    } catch {
      showToast('Erro ao guardar letra. Tente novamente.', 'error');
    } finally {
      setSavingLyrics(false);
    }
  };

  const handleRegenerateLyrics = async () => {
    if (!dbSongId || regenerationsUsed >= 2) return;
    setSavingLyrics(true);
    try {
      const res = await fetch(`/api/song/${dbSongId}/regenerate-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onlySheDoes: formData.onlySheDoes,
          whereItHappened: formData.whereItHappened,
          whyCreatedToday: formData.whyCreatedToday,
          referenceArtist: formData.referenceArtist
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiSongTitle(data.songTitle);
        setAiLyrics(data.lyrics);
        setAiLyricsSnippet(data.lyricsSnippet);
        setAiLetterText(data.letterText);
        setRegenerationsUsed(data.regeneration_count);
        setRegenerationsRemaining(data.regenerations_remaining);
        setEditedLyrics(Array.isArray(data.lyrics) ? data.lyrics.join('\n') : data.lyrics);
        setLyricsSaved(false);
        setEditingLyrics(false);
        
        // Rebuild teaser on regeneration
        if (teaserEnabled) {
          const fullLyrics = Array.isArray(data.lyrics) ? data.lyrics.join('\n') : data.lyrics || '';
          const teaser = buildTeaser(fullLyrics);
          setLyricsTeaser(teaser);
          clearTeaserEdits(dbSongRequestId);
        }
        
        showToast(`Letra regenerada! (${data.regeneration_count}/2)`, 'success');
      } else {
        showToast(data.error || 'Erro ao regenerar letra.', 'error');
      }
    } catch {
      showToast('Erro ao regenerar letra. Tente novamente.', 'error');
    } finally {
      setSavingLyrics(false);
    }
  };

  const activeMeta = STEP_META[step - 1];
const ROTATING_MESSAGES = [
    '❤️ Música criada para uma mãe',
    '💕 Declaração de amor criada',
    '🎂 Música de aniversário pronta',
    '💍 Pedido de casamento a transformar-se em música'
  ];

  const getDemoByStyle = (style: string) => {
    const map: Record<string, string> = {
      Kizomba: 'kizomba-mae',
      Semba: 'semba-avo',
      Gospel: 'gospel-marido',
      Afrobeat: 'kizomba-mae',
      Zouk: 'kizomba-mae',
      Acoustic: 'semba-avo',
      'Romantic Pop': 'semba-avo',
      Balada: 'semba-avo',
      Pop: 'semba-avo',
      Hino: 'gospel-marido',
      Samba: 'kizomba-mae',
      Reggae: 'kizomba-mae',
      Trap: 'kizomba-mae',
      Funk: 'kizomba-mae',
      Rap: 'kizomba-mae',
      'R&B': 'semba-avo',
    };
    const id = map[style] || 'kizomba-mae';
    return DEMO_SONGS.find(d => d.id === id) || DEMO_SONGS[0];
  };

  const handleDemoPlayPause = () => {
    if (demoPlaying) {
      if (demoAudioRef.current) {
        demoAudioRef.current.pause();
      }
      setDemoPlaying(false);
    } else {
      const demo = getDemoByStyle(formData.musicStyle);
      if (demoAudioRef.current && demoAudioRef.current.dataset.songId === demo.id) {
        demoAudioRef.current.play().catch(() => {});
        setDemoPlaying(true);
      } else {
        if (demoAudioRef.current) {
          demoAudioRef.current.pause();
          demoAudioRef.current = null;
        }
        const audio = new Audio(demo.audioUrl);
        audio.dataset.songId = demo.id;
        audio.ontimeupdate = () => {
          if (audio.currentTime >= 30) {
            audio.pause();
            setDemoPlaying(false);
            setDemoProgress(30);
          } else {
            setDemoProgress(audio.currentTime);
          }
        };
        audio.onended = () => {
          setDemoPlaying(false);
          setDemoProgress(30);
        };
        audio.play().catch(() => {});
        demoAudioRef.current = audio;
        setDemoPlaying(true);
        setDemoProgress(0);
      }
    }
  };

  // Cleanup demo audio on unmount or when leaving Ecrã 1
  useEffect(() => {
    if (conversionStep !== 'preview' && demoAudioRef.current) {
      demoAudioRef.current.pause();
      demoAudioRef.current = null;
      setDemoPlaying(false);
      setDemoProgress(0);
    }
  }, [conversionStep]);

  useEffect(() => {
    return () => {
      if (demoAudioRef.current) {
        demoAudioRef.current.pause();
        demoAudioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#151210] text-stone-100 flex flex-col py-4 md:py-10 px-4 md:px-8 md:justify-between">
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl font-mono text-sm shadow-2xl border break-words max-w-[calc(100vw-2rem)] ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-300'
                : toast.type === 'error'
                  ? 'bg-rose-900/90 border-rose-500/30 text-rose-300'
                  : 'bg-stone-800/90 border-stone-600/30 text-stone-200'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-7xl mx-auto w-full flex-grow flex flex-col justify-center">
        
        {/* UPPER BRAND NAV */}
        {!isSubmitting && !isDone && !showVoiceCloningScreen && generationStatus === 'idle' && (
          <div className="flex items-center justify-between pb-6 mb-8 border-b border-stone-900">
            <button 
              id="wizard-header-logo-btn"
              onClick={onBackToLanding}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <LogoIcon size={40} />
              <div>
                <h2 className="font-serif text-lg font-bold tracking-tight text-stone-100 group-hover:text-amber-400 transition-colors mb-0.5">
                  SeuBeat
                </h2>
                <span className="text-[10px] text-stone-500 font-sans block tracking-widest uppercase">Passo de Estúdio</span>
              </div>
            </button>

            <div className="flex items-center gap-2 sm:gap-4 text-right">
              <span className="hidden sm:inline text-xs text-stone-400 font-mono">
                🎵 <span className="text-amber-400 font-bold">+{todayCount}</span> hoje · PASSO <span className="text-amber-400 font-bold">{step}</span> · {Math.round((step / 9) * 100)}%
              </span>
              <div className="w-20 sm:w-24 md:w-36 h-2 bg-stone-900 rounded-full overflow-hidden relative">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                  animate={{ width: `${(step / 9) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>
        )}

        {/* -------------------- IS SUBMITTING: PROCESSING LOADER SCREEN -------------------- */}
        {isSubmitting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto w-full text-center space-y-8 bg-stone-900/30 p-4 md:p-12 rounded-3xl border border-stone-850 shadow-2xl backdrop-blur relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500" />
            <div className="w-20 h-20 bg-amber-500/5 rounded-full border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner animate-[spin_5s_linear_infinite]">
              <Sparkles className="w-9 h-9 text-amber-400" />
            </div>

            <div className="space-y-2">
              <h3 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-stone-100 animate-pulse">
                ❤️ A transformar a tua história em música...
              </h3>
              <p className="text-stone-400 text-sm max-w-md mx-auto">
                O nosso sistema de estúdio e de síntese acústica avançado está a converter as tuas memórias num tom personalizado de alta definição estúdio.
              </p>
            </div>

            {/* Simulated processing checklist */}
            <div className="max-w-xs mx-auto text-left space-y-3.5 bg-stone-950 p-6 rounded-2xl border border-stone-850">
              {[
                { label: 'A analisar a história', index: 0 },
                { label: 'A escrever a letra', index: 1 },
                { label: 'A criar o refrão', index: 2 },
                { label: 'A compor a melodia', index: 3 },
                { label: 'A finalizar a música', index: 4 }
              ].map((item, idx) => {
                const isFinished = processingStage > item.index;
                const isActive = processingStage === item.index;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs border ${
                      isFinished 
                        ? 'bg-green-500/10 border-green-500 text-green-400' 
                        : isActive 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400' 
                        : 'bg-stone-900 border-stone-800 text-stone-600'
                    }`}>
                      {isFinished ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : isActive ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <span className="text-[10px] font-mono">{idx + 1}</span>
                      )}
                    </div>
                    <span className={`text-xs md:text-sm font-medium ${
                      isFinished ? 'text-stone-400 line-through' : isActive ? 'text-amber-400 font-semibold' : 'text-stone-600'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ROTATING SUPPORT SOCIAL PROOF STATMENTS IN MIDDLE (Strictly genuine) */}
            <div className="h-10 flex items-center justify-center mt-3">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={rotatingMsgIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-xs text-rose-400 font-medium italic font-serif"
                >
                  {ROTATING_MESSAGES[rotatingMsgIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            {showProcessingWarning && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] leading-relaxed text-amber-500 font-mono bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg"
              >
                A sua letra esta a ser preparada com carinho. Obrigado por esperar — vai compensar.
              </motion.p>
            )}
          </motion.div>
        )}

        {!isSubmitting && generationStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto w-full text-center space-y-6 bg-stone-900/40 p-4 md:p-10 rounded-3xl border border-rose-900/40 shadow-2xl"
          >
            <div className="w-16 h-16 bg-rose-500/10 rounded-full border border-rose-500/25 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl md:text-3xl font-bold text-stone-100">
                Nao foi possivel gerar agora
              </h3>
              <p className="text-stone-400 text-sm max-w-md mx-auto">
                {generationError || 'Ocorreu um erro ao criar a letra ou iniciar a musica.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={retryGeneration}
                className="px-5 py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar novamente</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGenerationStatus('idle');
                  setGenerationError('');
                }}
                className="px-5 py-3 bg-stone-850 hover:bg-stone-800 text-stone-200 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Rever dados
              </button>
            </div>
            <div className="pt-4">
              <WhatsAppHelp context="erro_geracao" label="Falar com apoio" />
            </div>
          </motion.div>
        )}

        {!isSubmitting && generationStatus === 'music_processing' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto w-full text-center space-y-6 bg-stone-900/40 p-4 md:p-10 rounded-3xl border border-amber-900/30 shadow-2xl"
          >
            <div className="w-16 h-16 bg-amber-500/10 rounded-full border border-amber-500/25 flex items-center justify-center mx-auto">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
            <div className="space-y-2">
              <span className="text-amber-400 text-xs font-mono font-bold tracking-widest uppercase">
                LETRA PRONTA - MUSICA EM PROCESSAMENTO
              </span>
              <h3 className="font-serif text-2xl md:text-3xl font-bold text-stone-100">
                A musica ainda esta a ser criada
              </h3>
              <p className="text-stone-400 text-sm max-w-md mx-auto">
                {generationError || 'A letra foi guardada com sucesso. A pre-visualizacao so aparece quando o audio real estiver pronto.'}
              </p>
            </div>
            {aiSongTitle && (
              <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 text-left space-y-2">
                <span className="text-[10px] text-stone-500 font-mono tracking-widest uppercase block">Letra criada:</span>
                <h4 className="font-serif text-lg font-bold text-stone-100">{aiSongTitle}</h4>
                <p className="text-xs text-stone-400 italic line-clamp-3">{aiLyricsSnippet}</p>
              </div>
            )}
            <button
              type="button"
              onClick={recheckMusicStatus}
              disabled={!dbSongId}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Verificar pre-visualizacao</span>
            </button>
          </motion.div>
        )}

        {/* -------------------- ECRÃ 1: PREVIEW EMOCIONAL + CTA -------------------- */}
        {!isSubmitting && generationStatus === 'lyrics_ready' && !isDone && !showVoiceCloningScreen && conversionStep === 'preview' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto w-full space-y-5 py-6"
          >
            {/* ← Voltar a editar */}
            <button
              onClick={() => {
                submissionStartedRef.current = false;
                setGenerationStatus('idle');
                setGenerationError('');
                setIsSubmitting(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar a editar dados</span>
            </button>

            {/* Header */}
            <div className="text-center space-y-2">
              <span className="text-emerald-500 text-xs font-mono font-bold tracking-widest uppercase flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4" /> LETRA CRIADA COM SUCESSO
              </span>
              <h2 className="font-serif text-2xl md:text-3xl text-stone-100 font-black tracking-tight">
                {aiSongTitle || (formData.recipientName ? `Música para ${formData.recipientName}` : 'Música personalizada')}
              </h2>
              <p className="text-stone-400 text-xs max-w-sm mx-auto">
                Para <strong className="text-amber-400">{formData.recipientName || 'alguém especial'}</strong>
                {formData.recipientNick ? ` (${formData.recipientNick})` : ''} · Por ti 💝
              </p>
            </div>

            {/* Barra de progresso emocional */}
            <p className="text-[10px] font-mono text-stone-500 text-center">
              ✅ História · ✅ Letra · 🟡 Música · ⬜ {formData.recipientGender === 'Masculino' ? 'Ele' : 'Ela'}
            </p>

            {/* Preço âncora */}
            <div className="text-center space-y-0.5">
              <p className="text-[10px] font-mono text-stone-500">
                🎁 A partir de 7.900 Kz · Pago único
              </p>
            </div>

            {/* Dedication Preview — grande e visual */}
            <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden">
                  {formData.photoUrl
                    ? <img src={formData.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                    : <span className="text-3xl">💝</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-200 break-words">{aiSongTitle || (formData.recipientName ? `Música para ${formData.recipientName}` : 'Música personalizada')}</p>
                  <p className="text-xs text-stone-500">Para {formData.recipientName || 'alguém especial'} · Por {formData.userNick || 'Ti'}</p>
                  <p className="text-[10px] text-stone-500 font-mono mt-2">
                    🎵 {formData.musicStyle || 'Kizomba'} · 3-4 min · <em className="text-amber-400/70 not-italic">Para ouvir e chorar 🥹</em>
                  </p>
                </div>
              </div>
            </div>

            {/* Demo player — amostra real no estilo escolhido */}
            <div className="bg-stone-900/30 p-3 rounded-xl border border-stone-800/60">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDemoPlayPause}
                  className="w-9 h-9 rounded-full bg-amber-500/20 hover:bg-amber-500/30 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  aria-label={demoPlaying ? 'Pausar demo' : 'Ouvir demo'}
                >
                  {demoPlaying ? (
                    <div className="flex items-end gap-0.5 h-4">
                      <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-3" />
                      <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-4" />
                      <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-2" />
                    </div>
                  ) : (
                    <Play className="w-4 h-4 text-amber-400 ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-amber-400/80 font-medium">
                    🎵 {formData.musicStyle || 'Kizomba'} real · 30s sample
                  </p>
                  <div className="h-1 bg-stone-800 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-500/60 rounded-full transition-all duration-300"
                      style={{ width: `${(demoProgress / 30) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-stone-600 font-mono text-center mt-1.5">
                Ouve como vai soar o resultado final
              </p>
            </div>

            {/* Letra da música — Teaser ou Completa */}
            {teaserEnabled && lyricsTeaser ? (
              <LyricsTeaserPreview
                teaser={lyricsTeaser}
                requestId={dbSongRequestId}
                onEditChange={(sectionLabel, lines) => {
                  // Edits are saved to localStorage in the component
                }}
                onUnlockClick={() => {
                  setConversionStep('plans');
                  fbWizardStep('unlock_click', 0, safeUUID());
                }}
              />
            ) : (
              <>
                {!editingLyrics ? (
                  <div className="bg-stone-900/40 p-4 rounded-2xl border border-stone-800 max-h-44 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-stone-500 font-mono tracking-widest uppercase">Letra da música</span>
                      <span className="text-[10px] text-amber-400/60 font-mono">🎵 {formData.musicStyle || 'Kizomba'}</span>
                    </div>
                    <div className="text-stone-300 text-sm font-serif leading-relaxed whitespace-pre-line">
                      {Array.isArray(aiLyrics) ? aiLyrics.join('\n') : aiLyrics}
                    </div>
                  </div>
                ) : (
                  <div className="bg-stone-900/40 p-4 rounded-2xl border border-amber-900/30 space-y-3">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-300 space-y-1">
                      <strong>⚠️ Atenção à escrita:</strong>
                      <p>A letra que escrever será cantada pela inteligência artificial. Escreva corretamente para garantir uma pronúncia perfeita. Evite abreviações, gírias ou erros ortográficos — a IA canta exatamente o que está escrito.</p>
                    </div>
                    <textarea
                      value={editedLyrics}
                      onChange={(e) => setEditedLyrics(e.target.value)}
                      className="w-full h-48 bg-stone-950 text-stone-200 text-sm font-mono p-4 rounded-xl border border-stone-800 focus:border-amber-500 focus:outline-none resize-y"
                      placeholder="Escreva a letra aqui..."
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingLyrics(false)} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded-xl transition-all cursor-pointer">Cancelar</button>
                      <button onClick={handleSaveLyrics} disabled={savingLyrics} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50">
                        {savingLyrics ? 'A guardar...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Editar / Regenerar links (só quando não está a editar) */}
            {!editingLyrics && (
              <div className="flex items-center justify-center gap-4 text-xs">
                <button
                  onClick={() => {
                    setEditedLyrics(Array.isArray(aiLyrics) ? aiLyrics.join('\n') : '');
                    setEditingLyrics(true);
                  }}
                  className="text-stone-400 hover:text-amber-400 transition-colors cursor-pointer underline underline-offset-2"
                >
                  Editar letra
                </button>
                <span className="text-stone-700">·</span>
                <button
                  onClick={handleRegenerateLyrics}
                  disabled={regenerationsUsed >= 2}
                  className="text-stone-400 hover:text-amber-400 transition-colors cursor-pointer underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Regenerar {regenerationsRemaining > 0 ? `(${regenerationsRemaining}/2)` : '(limite)'}
                </button>
                {lyricsSaved && (
                  <span className="text-emerald-400 text-xs flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Guardada
                  </span>
                )}
              </div>
            )}

            {/* Linha emocional */}
            <p className="text-center text-sm text-stone-300 font-medium leading-relaxed">
              Já imaginaste a cara {formData.recipientGender === 'Masculino' ? 'do' : 'da'} <strong className="text-amber-400">{formData.recipientName || (formData.recipientGender === 'Masculino' ? 'alguém especial' : 'alguém especial')}</strong> a ouvir o <strong className="text-amber-400/80">NOME {formData.recipientGender === 'Masculino' ? 'DELE' : 'DELA'}</strong> cantado? 🥹
            </p>

            {/* Dor da indiferença */}
            <p className="text-center text-[10px] text-rose-400/40 font-mono italic leading-relaxed">
              🎁 Este presente já devia ter sido entregue no ano passado.
            </p>

            {/* CTA principal — ocupar ecrã inteiro no mobile */}
            <button
              onClick={() => setConversionStep('plans')}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-black text-sm rounded-2xl hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <span>SIM, QUERO QUE {formData.recipientGender === 'Masculino' ? 'ELE' : 'ELA'} OUÇA ISTO ❤️</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* -------------------- ECRÃ 2: PLANOS (2 OPÇÕES + ADD-ON PREMIUM) -------------------- */}
        {!isSubmitting && generationStatus === 'lyrics_ready' && !isDone && !showVoiceCloningScreen && conversionStep === 'plans' && !showUpsellModal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto w-full space-y-5 py-6"
          >
            {/* ← Voltar */}
            <button
              onClick={() => setConversionStep('preview')}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar à pré-visualização</span>
            </button>

            <p className="text-[10px] font-mono text-amber-400/80 text-center">
              🎵 Música para <strong className="text-stone-200">{formData.recipientName || 'alguém especial'}</strong>
            </p>

            <h3 className="text-center font-serif text-xl font-bold tracking-tight text-stone-200">
              Escolhe como queres receber
            </h3>
            <p className="text-center text-[10px] text-amber-400/70 font-mono -mt-3">
              💾 A letra que criaste para <strong className="text-stone-300">{formData.recipientName}</strong> está guardada. Falta só escolher como entregar.
            </p>
            <p className="text-[10px] font-mono text-stone-500 text-center leading-relaxed -mt-4">
              💬 {liveActivity.text}<br />
              <span className="text-amber-400/80">· {liveActivity.time}</span>
            </p>
            <p className="text-center text-[10px] font-mono text-amber-400/90">
              🔥 <strong className="text-amber-300">+{todayCount}</strong> músicas criadas hoje
            </p>

            {/* EXPRESS — hero */}
            <div className="bg-stone-900/40 rounded-2.5xl p-5 border-2 border-amber-500/70 shadow-2xl relative space-y-4">
              <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-rose-500 text-stone-950 font-mono text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                🔥 + ADQUIRIDO
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-lg font-bold text-amber-300">EXPRESS ⚡</h4>
                  <p className="text-amber-500/80 text-xs">Entrega imediata + Dueto</p>
                </div>
              </div>
              <div className="text-left">
                <span className="text-2xl font-serif font-black text-stone-100">9.900 Kz</span>
              </div>
              <ul className="text-xs text-stone-400 space-y-1.5">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> Tudo do Standard + Voz em Dueto</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> Entrega imediata após aprovação</li>
              </ul>
              <button
                id="express-plan-btn"
                onClick={() => handlePlanSelection('express')}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-xs rounded-xl hover:opacity-95 transition-all cursor-pointer"
              >
                Receber agora
              </button>
            </div>

            {/* STANDARD */}
            <div className="bg-stone-900/40 rounded-2.5xl p-5 border border-stone-850 space-y-4">
              <div>
                <h4 className="font-serif text-lg font-bold text-stone-300">STANDARD</h4>
                <p className="text-stone-500 text-xs">Entrega em 24h</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm text-stone-600 line-through">10.500 Kz</span>
                <span className="text-2xl font-serif font-black text-stone-100">7.900 Kz</span>
              </div>
              <ul className="text-xs text-stone-400 space-y-1.5">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> Música completa + Download MP3</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> Página de dedicatória online</li>
              </ul>
              <button
                id="standard-plan-btn"
                onClick={() => handlePlanSelection('standard')}
                className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Receber amanhã
              </button>
            </div>

            {/* Premium add-on info */}
            <div className="bg-stone-900/20 rounded-2xl p-4 border border-dashed border-purple-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👑</span>
                  <div>
                    <span className="text-xs font-bold text-purple-300">Premium — Voz Clonada</span>
                    <p className="text-[10px] text-stone-500">A música cantada com a tua própria voz</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-stone-200">+5.000 Kz</span>
                  <span className="text-[10px] text-stone-600 font-mono block">s/ Express 9.900</span>
                </div>
              </div>
              <p className="text-[10px] text-stone-500 flex items-center gap-1">
                <Check className="w-3 h-3 text-purple-400 shrink-0" /> Inclui: voz clonada, dueto, carta narrada, entrega imediata
              </p>
              <p className="text-[10px] text-stone-500 text-center pt-1">
                <button
                  onClick={() => handlePlanSelection('premium')}
                  className="text-purple-400 hover:text-purple-300 underline underline-offset-2 font-medium cursor-pointer"
                >
                  Adicionar voz clonada
                </button>
                · Total: <strong>14.900 Kz</strong> · Garantia 100%
              </p>
            </div>

            <p className="text-center text-xs text-stone-400 font-serif italic">
              O melhor presente que {formData.recipientGender === 'Masculino' ? 'ele' : 'ela'} já vai receber. E vais ser tu a dar.
            </p>

            {/* Trust */}
            <div className="text-center space-y-2 pt-1">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-stone-500 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>100% satisfação ou reembolso</span>
              </div>
              <div className="flex items-center justify-center gap-4 text-[9px] text-stone-600 font-mono">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Pagamento seguro</span>
                <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> Feito com amor em Angola</span>
              </div>
            </div>

            <div className="text-center pt-1">
              <button
                onClick={() => {
                  localStorage.removeItem('seubeat_wizard_progress');
                  sessionStorage.removeItem('seubeat_photo_base64');
                  wrappedSetFormData(INITIAL_WIZARD_DATA);
                  setStep(1);
                  setIsSubmitting(false);
                  setSelectedPlanID(null);
                  setVoiceUpsellApplied(false);
                  setShowVoiceCloningScreen(false);
                  setIsRecording(false);
                  setHasRecorded(false);
                  setRecordingSeconds(0);
                  setClonedVoiceFile(null);
                  setIsDone(false);
                  setPaymentSubmitted(false);
                  setPaymentStatus('pending');
                  setProofFile(null);
                  setConversionStep('preview');
                }}
                className="text-[10px] text-stone-500 hover:text-amber-400 transition-colors cursor-pointer underline underline-offset-2"
              >
                ou quero criar outra canção
              </button>
            </div>
          </motion.div>
        )}

        {/* -------------------- ECRÃ 3: UPSELL INLINE (VOZ CLONADA) -------------------- */}
        {!isSubmitting && generationStatus === 'lyrics_ready' && !isDone && !showVoiceCloningScreen && showUpsellModal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto w-full space-y-6 py-6"
          >
            {/* Back link */}
            <button
              onClick={() => { setShowUpsellModal(false); setConversionStep('plans'); }}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar aos planos</span>
            </button>

            {/* Badge */}
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold uppercase rounded-full tracking-wider shadow-sm">
                <Sparkles className="w-3 h-3 animate-pulse" /> UPGRADE EXCLUSIVO
              </span>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h3 className="font-serif text-2xl md:text-3xl font-black text-stone-100 tracking-tight">
                Queres ir mais longe? 🎙️
              </h3>
              <p className="text-stone-400 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
                A <strong className="text-amber-400">{formData.recipientName}</strong> vai ouvir a <strong className="text-stone-200">tua voz</strong> a cantar para ela. Lágrima garantida.
              </p>
            </div>

            {/* Voice comparison */}
            <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-850 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-stone-900/50 p-3 rounded-xl border border-stone-800">
                  <span className="text-[10px] text-stone-500 font-mono">OPÇÃO PADRÃO</span>
                  <span className="text-xxs text-stone-500 font-sans italic bg-stone-950 px-1.5 py-0.5 rounded border border-stone-900 ml-1.5">Incluído</span>
                  <h4 className="text-xs font-semibold text-stone-300 mt-1">Voz Inteligente</h4>
                  <p className="text-[10px] text-stone-500 leading-snug">Timbre estúdio predefinido de alta qualidade.</p>
                </div>
                <div className="bg-amber-500/[0.04] p-3 rounded-xl border-2 border-amber-500/50 relative overflow-hidden">
                  <span className="text-[10px] text-amber-400 font-mono font-bold">RECOMENDADO</span>
                  <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/10 rounded-bl-full flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <h4 className="text-xs font-bold text-amber-300 mt-1">Sua Voz de Estúdio</h4>
                  <p className="text-[10px] text-amber-400 leading-snug">Usa o seu tom e expressão de verdade.</p>
                </div>
              </div>

              <span className="text-[9px] text-stone-500 font-mono tracking-widest uppercase block border-b border-stone-900 pb-1.5">PORQUE ADICIONAR ESTE UPGRADE?</span>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-stone-400 font-medium">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Fator surpresa inigualável</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Garantia de fortes lágrimas</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Grave em 20 seg pelo telefone</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Carta narrada incluída</li>
              </ul>

              <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                <div className="text-left">
                  <span className="text-xs text-stone-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Total com Voz Clonada:
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono block">{selectedPlanID === 'standard' ? 'Standard 7.900 + Voz 5.000' : 'Express 9.900 + Voz 5.000'}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-amber-400 font-mono block">14.900 Kz</span>
                  <span className="text-[9px] text-stone-500 font-mono uppercase">Kwanza Angola</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                id="upsell-accept-btn"
                onClick={() => {
                  setSelectedPlanID('premium');
                  setVoiceUpsellApplied(true);
                  setShowUpsellModal(false);
                  setShowVoiceCloningScreen(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-rose-600 text-stone-950 font-black text-xs md:text-sm rounded-2xl hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" />
                <span>Quero a Música Cantada pela Minha Voz — 14.900 Kz</span>
              </button>

              <button
                id="upsell-decline-btn"
                onClick={() => {
                  setVoiceUpsellApplied(false);
                  setShowUpsellModal(false);
                  setIsDone(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3 text-stone-500 hover:text-stone-300 font-semibold text-xs rounded-xl hover:bg-stone-900/40 transition-colors cursor-pointer"
              >
                Não obrigado, usar {selectedPlanID === 'standard' ? 'Standard' : 'Express'} sem voz clonada
              </button>
            </div>

            <div className="text-[9px] text-stone-600 font-mono tracking-wide text-center">
              <Lock className="w-3 h-3 inline" /> Seguro & Protegido · Devolução 100% caso não goste do resultado
            </div>
          </motion.div>
        )}

        {/* -------------------- SHOW VOICE CLONING (RECORDING) SCREEN -------------------- */}
        {showVoiceCloningScreen && !isDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto w-full bg-stone-900/40 rounded-[32px] p-6 md:p-10 border border-amber-900/15 shadow-2xl backdrop-blur space-y-8 relative overflow-hidden text-center"
          >
            {/* Background glowing rings */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500" />
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-between items-center pb-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-amber-500 to-rose-600 rounded-lg flex items-center justify-center text-stone-950 font-black text-xs shadow-md">
                  SB
                </div>
                <span className="text-xs text-stone-400 font-mono tracking-wider uppercase font-bold">Estúdio de Sintonia Vocal</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">UPGRADE EXCLUSIVO</span>
            </div>

            <div className="space-y-2">
              <div className="relative w-16 h-16 bg-gradient-to-tr from-amber-500 to-rose-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <Mic className="w-7 h-7 text-stone-950" />
              </div>
              <h2 className="font-serif text-2xl md:text-3xl text-stone-100 font-black tracking-tight pt-2">
                A Música Será Cantada pela Sua Voz! 🎙️
              </h2>
              <p className="text-stone-400 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
                Grave 20 segundos. A nossa IA clona o seu timbre e a <strong className="text-stone-200">música completa será cantada pela sua própria voz</strong>. Precisamos apenas de uma amostra curta e clara.
              </p>
            </div>

            {/* Instruction Cue / Calibration text block */}
            <div className="bg-stone-950 p-5 rounded-2xl border border-stone-850 text-left space-y-3">
              <span className="text-[9px] text-amber-500 font-mono uppercase tracking-wider block">TEXTO DE CALIBRAÇÃO (LEIA EM VOZ ALTA):</span>
              <p className="text-stone-100 text-xs md:text-sm leading-relaxed italic border-l-2 border-amber-500 pl-3 font-medium py-1">
                "Eu, <strong className="text-white text-sans underline decoration-amber-500/60 font-bold">{formData.email ? formData.email.split('@')[0] : 'Artista'}</strong>, dou autorização ao estúdio SeuBeat para usar a gravação do meu timbre de voz de modo a criar esta canção de amor e emoção dedicada a <strong className="text-amber-400">{formData.recipientName || 'alguém especial'}</strong>."
              </p>
              <span className="text-[9.5px] text-stone-500 font-mono block">Dica: Fale de forma calma, clara e natural, mantendo o telefone ou microfone próximo.</span>
            </div>

            {/* Interactivity Control Center */}
            <div className="bg-stone-900/60 p-6 rounded-2xl border border-stone-850 space-y-6">
              
              {/* Voice simulation / Progress indicator */}
              <div className="flex flex-col items-center justify-center space-y-4">
                
                {/* Visual Audio Waveform Simulation */}
                <div className="flex items-end justify-center gap-1.5 h-12 py-2">
                  {Array.from({ length: 18 }).map((_, i) => {
                    return (
                      <motion.div
                        key={i}
                        className="w-1 bg-gradient-to-t from-amber-500 to-rose-500 rounded-full"
                        style={{ height: '4px' }}
                        animate={isRecording ? {
                          height: [
                            '4px',
                            `${Math.floor(Math.random() * 32) + 12}px`,
                            '4px'
                          ]
                        } : { height: '5px' }}
                        transition={isRecording ? {
                          repeat: Infinity,
                          duration: 0.4 + (i % 3) * 0.15,
                          ease: "easeInOut"
                        } : {}}
                      />
                    );
                  })}
                </div>

                {/* State labels and counters */}
                <div className="text-center font-mono space-y-1">
                  {isRecording ? (
                    <div className="flex items-center gap-2 text-rose-500 text-xs font-bold justify-center">
                      <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                      <span>GRAVAÇÃO EM CURSO • 0:{(recordingSeconds < 10 ? '0' : '') + recordingSeconds}s</span>
                    </div>
                  ) : hasRecorded ? (
                    <span className="text-emerald-500 text-xs font-bold">🎙️ AMOSTRA GRAVADA COM SUCESSO! (0:{recordingSeconds}s)</span>
                  ) : (
                    <span className="text-stone-500 text-xs">Microfone de Gravação Pronto</span>
                  )}
                </div>
              </div>

              {/* Action buttons to trigger recording */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                {!isRecording && !hasRecorded && (
                  <button
                    id="start-rec-btn"
                    onClick={startRecording}
                    className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transform active:scale-95 transition-all cursor-pointer shadow-lg shadow-rose-600/10 w-full sm:w-auto justify-center"
                  >
                    <Mic className="w-4 h-4 text-white animate-pulse" />
                    <span>Iniciar Gravação do Áudio</span>
                  </button>
                )}

                {isRecording && (
                  <button
                    id="stop-rec-btn"
                    onClick={stopRecording}
                    className="px-6 py-3.5 bg-stone-950 border border-stone-800 hover:bg-stone-900 text-stone-200 font-bold text-xs rounded-xl flex items-center gap-2 transform active:scale-95 transition-all cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                    <span>Parar Gravação (Guardar Voz)</span>
                  </button>
                )}

                {hasRecorded && !isRecording && (
                  <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                    <button
                      id="retry-rec-btn"
                      onClick={startRecording}
                      className="px-5 py-3 bg-stone-950 border border-stone-850 hover:bg-stone-900 text-stone-400 hover:text-stone-250 font-semibold text-xs rounded-xl flex items-center gap-2 justify-center transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-[spin_3s_linear_infinite]" />
                      <span>Gravar Novamente</span>
                    </button>

                    <div className="bg-stone-950/80 px-4 py-2.5 rounded-xl border border-stone-850 flex items-center gap-2 justify-center text-xs font-mono text-emerald-400">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>amostra_vocal_clonada.wav</span>
                    </div>
                  </div>
                )}

                {/* Alternative File Uploader Option */}
                <div className="w-full text-center pt-4 border-t border-stone-800/60 mt-3">
                  <p className="text-xxs text-stone-500 font-mono tracking-wide uppercase pb-2">Ou envie um ficheiro de áudio gravado previamente</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-stone-950 hover:bg-stone-900 text-stone-400 hover:text-white rounded-xl border border-stone-850 cursor-pointer text-xxs font-mono transition-all font-sans">
                    <Upload className="w-3.5 h-3.5 text-stone-500" />
                    <span className="font-mono">Carregar Áudio (.mp3, .wav, .m4a)</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          if (file.size > 50 * 1024 * 1024) {
                            showToast('O áudio não pode exceder 50MB.', 'error');
                            e.target.value = '';
                            return;
                          }
                          setClonedVoiceFile(file);
                          setHasRecorded(true);
                          setRecordingSeconds(18);
                        }
                      }}
                    />
                  </label>
                  {clonedVoiceFile && (
                    <p className="text-[10px] text-amber-400 font-mono mt-1.5 flex items-center justify-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" /> Ficheiro inserido com sucesso: {clonedVoiceFile.name}
                    </p>
                  )}
                </div>

              </div>

            </div>

            {/* Direct Proceed Trigger Block */}
            <div className="pt-2">
              <button
                id="voice-screen-proceed-btn"
                onClick={() => {
                  if (!hasRecorded) {
                    alert('Por favor, faça uma gravação curta de calibração ou carregue um arquivo de áudio de amostra (mínimo de 10 segundos) antes de prosseguir.');
                    return;
                  }
                  setShowVoiceCloningScreen(false);
                  setIsDone(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full py-4 rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                  hasRecorded 
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-rose-600 text-stone-950 shadow-lg shadow-amber-500/20 hover:opacity-95' 
                    : 'bg-stone-850 border border-stone-800 text-stone-500 opacity-60'
                }`}
              >
                <span>🎙️ Confirmar Assinatura e Seguir para o Pagamento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <p className="text-center text-[10px] text-stone-550 font-mono pt-3 max-w-sm mx-auto uppercase animate-pulse">
                * Os seus dados vocais são estritamente encriptados com segurança militar e limpos após a mistura final.
              </p>
            </div>
          </motion.div>
        )}

        {/* -------------------- ORDER SUMMARY AND SECURE payment SCREEN -------------------- */}
        {isDone && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto w-full bg-stone-900/40 rounded-3xl p-6 md:p-10 border border-amber-900/15 shadow-2xl backdrop-blur text-center space-y-8 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500" />
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />

            <div className="w-16 h-16 bg-amber-500/10 rounded-full border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner mb-4">
              <span className="text-3xl">💝</span>
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="font-serif text-2xl md:text-3xl text-stone-100 font-bold tracking-tight">
                Que lindo gesto, {formData.recipientName.split(' ')[0]} vai adorar! ❤️
              </h3>
              <p className="text-stone-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                A história e o briefing foram registados com sucesso na central SeuBeat. Prepare-se para ver lágrima e emoção genuína ao presentear.
              </p>
              <p className="text-[11px] font-mono text-amber-400/80 text-center max-w-sm mx-auto">
                A música está pronta. Assim que confirmarmos o pagamento, {formData.recipientGender === 'Masculino' ? 'ele' : 'ela'} recebe o link.
              </p>
              <p className="text-stone-400 text-xs font-serif italic max-w-md mx-auto">
                Daqui a 10 anos, esta música ainda vai tocar. E tu vais estar nela.
              </p>
            </div>

            {/* Checklist — progresso */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-stone-500 max-w-md mx-auto flex-wrap">
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400 shrink-0" />Letra pronta</span>
              <span className="text-stone-700 hidden xs:inline">·</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400 shrink-0" />Plano escolhido</span>
              <span className="text-stone-700">·</span>
              <span className="flex items-center gap-1 text-amber-400 font-semibold"><span className="text-[11px]">⏳</span>Confirmação manual até 24h</span>
            </div>

            {/* Price confirmation box */}
            <div className="bg-stone-950 rounded-2xl p-5 border border-stone-850 text-left max-w-md mx-auto space-y-4">
              <div className="flex items-center justify-between border-b border-stone-900 pb-3">
                <div>
                  <span className="text-[10px] text-stone-550 font-mono block">PLANO ESCOLHIDO</span>
                  <strong className="text-stone-250 font-serif text-sm">
                    {voiceUpsellApplied
                      ? 'SeuBeat Express + Voz Clonada 👑'
                      : selectedPlanID === 'express'
                      ? 'SeuBeat Express ⚡'
                      : 'SeuBeat Standard'}
                  </strong>
                  {voiceUpsellApplied && (
                    <span className="text-[10px] text-amber-400 font-mono block mt-0.5">Música cantada pela sua voz • 14.900 Kz</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-stone-550 font-mono block">VALOR TOTAL</span>
                  <strong className="text-amber-400 font-serif text-base">{getPrice()}</strong>
                </div>
              </div>

              {/* Prova social — pagamentos */}
              <div className="flex items-center justify-center h-5">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={paymentSocialIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-[10px] text-stone-500 font-mono"
                  >
                    {activeProof}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Reference Payment Details */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 uppercase tracking-widest border-b border-stone-900 pb-2">
                  <span>MÉTODO ÚNICO: PAGAMENTO POR REFERÊNCIA (MULTICAIXA)</span>
                </div>

                <div className="bg-stone-950 p-5 rounded-2xl border border-stone-850 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-550 font-mono text-[10px] uppercase">Entidade</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <strong className="text-white text-sm font-bold tracking-wider">{paymentDetails.entidade}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentDetails.entidade);
                          setCopiedText('entidade');
                          setTimeout(() => setCopiedText(null), 2000);
                        }}
                        className="p-1 text-stone-500 hover:text-amber-400 hover:bg-stone-900 rounded transition-colors cursor-pointer"
                        title="Copiar Entidade"
                      >
                        {copiedText === 'entidade' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-stone-900/60 pt-2.5">
                    <span className="text-stone-555 font-mono text-[10px] uppercase">Referência</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <strong className="text-amber-400 text-sm font-bold tracking-wider">{paymentDetails.referencia}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentDetails.referencia);
                          setCopiedText('referencia');
                          setTimeout(() => setCopiedText(null), 2000);
                        }}
                        className="p-1 text-stone-500 hover:text-amber-400 hover:bg-stone-900 rounded transition-colors cursor-pointer"
                        title="Copiar Referência"
                      >
                        {copiedText === 'referencia' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-stone-900/60 pt-2.5">
                    <span className="text-stone-550 font-mono text-[10px] uppercase">Valor Total</span>
                    <strong className="text-white text-sm font-mono font-bold tracking-wider">{getPrice()}</strong>
                  </div>
                </div>

                {/* Instruções — collapsible */}
                <div className="space-y-3 text-left pt-2">
                  <button
                    type="button"
                    onClick={() => setInstructionsOpen(!instructionsOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 uppercase tracking-wider font-bold cursor-pointer hover:text-amber-400 transition-colors"
                  >
                    <span>{instructionsOpen ? '▾' : '▸'}</span>
                    <span>📱 Como pagar pelo Multicaixa</span>
                  </button>
                  {instructionsOpen && (
                    <div className="space-y-2 text-xs text-stone-400">
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">1</div>
                        <p>Abre o Multicaixa (app ou ATM) → <strong className="text-stone-200">Pagamentos</strong> → <strong className="text-stone-200">Pagamento de Serviços</strong></p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">2</div>
                        <p>Digita: <strong className="text-white">Entidade {paymentDetails.entidade}</strong> · <strong className="text-white">Ref. {paymentDetails.referencia}</strong> · <strong className="text-amber-400">Valor {getPrice()}</strong></p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">3</div>
                        <p>Confirma, faz <strong className="text-stone-200">printscreen</strong> do comprovativo e carrega abaixo 📸</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Section */}
                <div className="border-t border-stone-850 pt-4 space-y-4">
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] text-amber-500 font-mono uppercase tracking-wider block font-bold">SUBMETA O COMPROVATIVO</span>
                    <p className="text-stone-400 text-xs font-sans">
                      Carregue o comprovativo da operação (PDF ou Imagem) para que o nosso sistema possa iniciar a verificação.
                    </p>
                  </div>

                  {!paymentSubmitted ? (
                    <div className="space-y-4">
                      {paymentSubmitting ? (
                        <div className="flex flex-col items-center justify-center p-8 space-y-3">
                          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                          <span className="text-xs text-stone-400 font-mono">A enviar comprovativo...</span>
                        </div>
                      ) : (
                        <>
                          <label className="flex flex-col items-center justify-center border border-dashed border-stone-850 hover:border-amber-500/40 bg-stone-950 hover:bg-stone-900/60 p-6 rounded-xl cursor-pointer transition-all duration-300 relative">
                            <Upload className="w-6 h-6 text-stone-500 mb-2" />
                            <span className="text-xs text-stone-300 font-semibold mb-1">Carregar arquivo de comprovativo</span>
                            <span className="text-[10px] text-stone-500 font-mono">JPG, PNG ou PDF (máx. 10MB)</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={handleProofChange}
                            />
                          </label>

                          <p className="text-[10px] text-stone-500 font-mono text-center">
                            ⏱️ Demora 2 minutos. {formData.recipientGender === 'Masculino' ? 'Ele' : 'Ela'} vai ouvir ainda hoje.
                          </p>
                          <p className="text-[9px] text-rose-400/50 font-mono text-center italic">
                            ⏳ A letra e a música que criou para {formData.recipientName.split(' ')[0]} estão prontas. Se sair agora, a página expira e o progresso perde-se.
                          </p>

                          <p className="text-[10px] text-emerald-500/70 font-mono text-center flex items-center justify-center gap-1">
                            <span>🛡️</span>
                            <span>Entregamos a música ou devolvemos. Pode editar a letra à vontade.</span>
                          </p>

                          {paymentSubmitError && (
                            <>
                              <p className="text-rose-400 text-xs font-mono text-left">{paymentSubmitError}</p>
                              <div className="flex justify-start">
                                <WhatsAppHelp context="pagamento" label="Falar com apoio" />
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ) : paymentStatus === 'rejected' ? (
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 text-left space-y-3">
                      <div className="flex items-center gap-2 text-rose-400 text-xs font-bold font-mono">
                        <span className="text-lg">❌</span>
                        <span>COMPROVATIVO REJEITADO</span>
                      </div>
                      <p className="text-stone-400 text-xs font-sans leading-relaxed">
                        {paymentNotes || 'O comprovativo enviado não foi aceite pela nossa equipa.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentSubmitted(false);
                          setPaymentStatus('pending');
                          setPaymentNotes('');
                          setPaymentSubmitError('');
                          setProofFile(null);
                        }}
                        className="py-3 px-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-stone-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer text-center w-full shadow-lg"
                      >
                        <span>Reenviar Comprovativo</span>
                      </button>
                      <div className="flex justify-center pt-1">
                        <WhatsAppHelp context="pagamento_rejeitado" label="Falar com apoio" />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-left space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono">
                        <Check className="w-4 h-4" />
                        <span>COMPROVATIVO SUBMETIDO COM SUCESSO!</span>
                      </div>
                      <p className="text-stone-400 text-xs font-sans leading-relaxed">
                        O seu comprovativo foi enviado e estamos a verificar o pagamento.
                        {paymentStatus === 'pending' && ' A página actualiza automaticamente quando o estado mudar — não precisa de ficar a actualizar.'}
                      </p>

                      {paymentStatus === 'pending' && (
                        <div className="flex items-center gap-2 text-[10px] text-amber-500/80 font-mono">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>A verificar automaticamente a cada 30 segundos...</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/payment-status?email=${encodeURIComponent(formData.email)}&requestId=${dbSongRequestId}`);
                            const data = await res.json();
                            if (data.status === 'approved') {
                              showToast('Pagamento confirmado! A sua música será entregue em breve.', 'success');
                              setPaymentStatus('approved');
                            } else if (data.status === 'rejected') {
                              setPaymentNotes(data.notes || '');
                              showToast('Pagamento rejeitado. Veja o motivo na tela.', 'error');
                              setPaymentStatus('rejected');
                            } else {
                              showToast('Pagamento ainda pendente. Voltamos a verificar mais tarde.', 'info');
                              setPaymentStatus('pending');
                            }
                          } catch {
                            showToast('Erro ao verificar estado. Tente novamente.', 'error');
                          }
                        }}
                        className="px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer w-full"
                      >
                        Verificar Estado do Pagamento
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Voice cloning failure warning */}
            {voiceCloningFailed && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-left max-w-md mx-auto">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono mb-1">
                  <span>⚠️</span>
                  <span>CLONAGEM DE VOZ INDISPONÍVEL</span>
                </div>
                <p className="text-stone-400 text-xs leading-relaxed">
                  Não foi possível clonar a sua voz neste momento. A música foi gerada com a voz padrão do Suno.
                  Pode tentar novamente mais tarde.
                </p>
              </div>
            )}

            {/* Personalized Song Page generated success dashboard card — só após pagamento submetido */}
            {generatedShareUrl && paymentSubmitted && (
              <div className="bg-stone-950 rounded-2xl p-5 border border-stone-850 text-left max-w-md mx-auto space-y-4">
                {paymentStatus === 'approved' ? (
                  <>
                    <div className="border-b border-stone-900 pb-2 flex items-center gap-2">
                      <span className="text-xl">🎉</span>
                      <div>
                        <span className="text-[10px] text-amber-500 font-mono block uppercase tracking-wider font-extrabold">PÁGINA DEDICADA GERADA</span>
                        <h4 className="text-stone-100 font-serif text-sm font-bold">Dedicatória com som completo ativa!</h4>
                      </div>
                    </div>

                    <p className="text-stone-400 text-xs leading-relaxed">
                      Criámos um link único e exclusivo com a carta polida, o leitor de música unlocked sem limites e downloads do ficheiro original em MP3.
                    </p>

                    {/* Shared URL copy field */}
                    <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 flex items-center justify-between gap-3 text-xs">
                      <span className="text-amber-400 font-mono truncate select-all flex-1">{generatedShareUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedShareUrl);
                          setCopiedText('link');
                          setTimeout(() => setCopiedText(null), 2000);
                        }}
                        className="p-1.5 text-stone-400 hover:text-amber-400 hover:bg-stone-950 rounded-lg transition-colors cursor-pointer"
                        title="Copiar link"
                      >
                        {copiedText === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Email notification */}
                    <div className="text-xs pt-1 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-stone-400 font-mono text-xxs uppercase">
                        O link foi enviado para o seu e-mail de registo
                      </span>
                    </div>

                    {/* Web redirection button */}
                    <div className="pt-2">
                      <a
                        href={generatedShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-stone-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer text-center w-full shadow-lg"
                      >
                        <span>💝 Ver dedicatória de {formData.recipientName.split(' ')[0]}</span>
                        <ArrowRight className="w-4 h-4 text-stone-950" />
                      </a>
                    </div>
                  </>
                ) : paymentStatus === 'rejected' ? (
                  <>
                    <div className="border-b border-rose-900 pb-2 flex items-center gap-2">
                      <span className="text-xl">❌</span>
                      <div>
                        <span className="text-[10px] text-rose-400 font-mono block uppercase tracking-wider font-extrabold">COMPROVATIVO REJEITADO</span>
                        <h4 className="text-stone-100 font-serif text-sm font-bold">O pagamento não foi validado</h4>
                      </div>
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-left space-y-2">
                      <p className="text-stone-300 text-xs leading-relaxed">
                        {paymentNotes || 'O comprovativo enviado não foi aceite pela nossa equipa.'}
                      </p>
                      <p className="text-stone-500 text-xs">
                        Pode reenviar um novo comprovativo ou contactar-nos pelo WhatsApp para mais informações.
                      </p>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentSubmitted(false);
                          setPaymentStatus('pending');
                          setPaymentNotes('');
                          setPaymentSubmitError('');
                        }}
                        className="py-3 px-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-stone-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer text-center w-full shadow-lg"
                      >
                        <span>Reenviar Comprovativo</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="border-b border-stone-900 pb-2 flex items-center gap-2">
                      <span className="text-xl">📩</span>
                      <div>
                        <span className="text-[10px] text-amber-500 font-mono block uppercase tracking-wider font-extrabold">COMPROVATIVO RECEBIDO</span>
                        <h4 className="text-stone-100 font-serif text-sm font-bold">Aguardando confirmação do pagamento</h4>
                      </div>
                    </div>

                    <p className="text-stone-400 text-xs leading-relaxed">
                      O link da sua dedicatória será enviado para <strong className="text-stone-300">{formData.email}</strong> assim que o pagamento for confirmado pela nossa equipa.
                    </p>

                    <div className="text-xs pt-1 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-stone-400 font-mono text-xxs uppercase">
                        Verifique também a sua caixa de spam
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {paymentSubmitted && generatedShareUrl && (
              <div className="bg-stone-950/80 rounded-2xl p-5 border border-stone-800 text-left max-w-md mx-auto space-y-4">
                <div className="border-b border-stone-800 pb-2 flex items-center gap-2">
                  <span className="text-xl">🤝</span>
                  <div>
                    <span className="text-[10px] text-amber-500 font-mono block uppercase tracking-wider font-extrabold">INDIQUE UM AMIGO</span>
                    <h4 className="text-stone-100 font-serif text-sm font-bold">Ganhe 10% OFF na sua próxima música</h4>
                  </div>
                </div>
                <p className="text-stone-400 text-xs leading-relaxed">
                  Partilhe o SeuBeat com quem mais gosta. Quando eles criarem uma música, <strong className="text-stone-300">ganha 10% de desconto na sua próxima encomenda</strong>.
                </p>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent('Olá! 🌟 Acabei de criar uma música personalizada no SeuBeat e adorei o resultado! Eles transformam histórias em canções — Kizomba, Semba, Pop… É incrível! Cria uma também para quem amas 👉 seubeat.ao')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <span>Indicar no WhatsApp</span>
                </a>
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                id="back-home-success-btn"
                onClick={onBackToLanding}
                className="px-6 py-2.5 bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Voltar à Página Inicial
              </button>
              <button
                id="create-new-song-success-btn"
                  onClick={() => {
                    localStorage.removeItem('seubeat_wizard_progress');
                    sessionStorage.removeItem('seubeat_photo_base64');
                    wrappedSetFormData(INITIAL_WIZARD_DATA);
                    setStep(1);
                    setIsSubmitting(false);
                    setSelectedPlanID(null);
                    setVoiceUpsellApplied(false);
                    setShowVoiceCloningScreen(false);
                    setIsRecording(false);
                    setHasRecorded(false);
                    setRecordingSeconds(0);
                    setClonedVoiceFile(null);
                    setIsDone(false);
                    setPaymentSubmitted(false);
                    setPaymentStatus('pending');
                    setProofFile(null);
                  }}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
              >
                Criar Outra Música ❤️
              </button>
            </div>
            
            <div className="pt-4 text-stone-650 text-[10px] flex items-center justify-center gap-1.5 font-mono">
              <Lock className="w-3.5 h-3.5 text-stone-650" />
              <span>A sua história está totalmente encriptada de forma segura.</span>
            </div>
          </motion.div>
        )}

        {/* -------------------- FORM CONTAINER (THE 9 STEPS DESCRIPTIONS MAP) -------------------- */}
        {!isSubmitting && !isDone && !showVoiceCloningScreen && generationStatus === 'idle' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Form Content */}
            <div className="lg:col-span-7 bg-stone-900/40 rounded-3xl p-6 md:p-8 border border-stone-800 shadow-xl backdrop-blur relative flex flex-col justify-between min-h-[400px] lg:min-h-[580px]">
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 flex-grow"
                >
                  
                  {/* Step Titles Meta Block */}
                  <div className="space-y-1">
                    <span className="text-amber-500 text-[11px] font-mono font-black uppercase tracking-widest block">Estúdio SeuBeat</span>
                    <h3 className="font-serif text-2.5xl md:text-3xl font-medium text-stone-100 leading-tight">
                      {activeMeta.title}
                    </h3>
                    <p className="text-stone-400 text-xs md:text-sm leading-relaxed">
                      {activeMeta.subtitle}
                    </p>
                    <p className="text-stone-500 text-xxs font-mono italic">
                      {activeMeta.example}
                    </p>
                  </div>

                  {step === 1 && (
                    <StepErrorBoundary stepName="Relação">
                      <Step1Relation
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        relationshipCards={RELATIONSHIP_CARDS}
                        fieldErrors={fieldErrors}
                        todayCount={todayCount}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 2 && (
                    <StepErrorBoundary stepName="Ocasião">
                      <Step2Occasion
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        occasionCards={OCCASION_CARDS}
                        fieldErrors={fieldErrors}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 3 && (
                    <StepErrorBoundary stepName="Estilo Musical">
                      <Step3Style
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        musicStyleCards={MUSIC_STYLE_CARDS}
                        artistCards={ARTIST_CARDS}
                        fieldErrors={fieldErrors}
                        todayCount={todayCount}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 4 && (
                    <StepErrorBoundary stepName="Voz">
                      <Step4Voice
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        voiceCards={VOICE_CARDS}
                        fieldErrors={fieldErrors}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 5 && (
                    <StepErrorBoundary stepName="Qualidades">
                      <Step5Traits
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        fieldErrors={fieldErrors}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 6 && (
                    <StepErrorBoundary stepName="Memória">
                      <Step6Memory
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        suggestTab={suggestTab}
                        setSuggestTab={setSuggestTab}
                        fieldErrors={fieldErrors}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 7 && (
                    <StepErrorBoundary stepName="Mensagem">
                      <Step7Message
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        emotionCards={EMOTION_CARDS}
                        fieldErrors={fieldErrors}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 8 && (
                    <StepErrorBoundary stepName="Foto">
                      <Step8Photo
                        formData={formData}
                        photoFileRef={photoFileRef}
                        handlePhotoChange={handlePhotoChange}
                        fieldErrors={fieldErrors}
                      />
                    </StepErrorBoundary>
                  )}

                  {step === 9 && (
                    <StepErrorBoundary stepName="Contacto">
                      <Step9Contact
                        formData={formData}
                        setFormData={wrappedSetFormData}
                        fieldErrors={fieldErrors}
                      />
                    </StepErrorBoundary>
                  )}

                </motion.div>
              </AnimatePresence>

              {/* Wizard Nav Controls Footer */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-6 border-t border-stone-900 mt-6 relative z-10">
                <button
                  id="wizard-back-btn"
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-xl hover:bg-stone-800 text-stone-450 hover:text-stone-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retroceder</span>
                </button>

                <p className="hidden md:block text-[10px] text-stone-500 font-mono tracking-wider">
                  {activeMeta.tip}
                </p>

                <button
                  id="wizard-advance-btn"
                  onClick={handleNext}
                  disabled={!validateStep() || isSubmitting}
                  className={`px-5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    validateStep()
                      ? 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 shadow-lg shadow-amber-500/10 active:scale-[0.97]'
                      : 'bg-stone-850 text-stone-500 cursor-not-allowed border border-stone-800/80'
                  }`}
                >
                  <span>{step === 9 ? 'Concluir Declaração' : 'Avançar'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Right Column: Emotive Live Studio Console Visual Deck */}
            <div className="lg:col-span-5 bg-gradient-to-b from-stone-900/60 to-stone-950/80 border border-amber-900/10 rounded-3xl p-4 md:p-6 shadow-xl space-y-5 lg:sticky lg:top-8">
              <div className="flex items-center gap-2 justify-between border-b border-stone-900 pb-3">
                <div className="flex items-center gap-1.5 text-xxs text-stone-400 font-mono">
                  <Eye className="w-3.5 h-3.5 text-amber-500/80" />
                  <span>VISUALIZAÇÃO DE ESTÚDIO SEUBEAT</span>
                </div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              </div>

              {/* Physical Vinyl disk graphic */}
              <div className="flex flex-col items-center py-4 text-center space-y-3">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <motion.div 
                    animate={{ rotate: formData.musicStyle ? 360 : 0 }}
                    transition={{ repeat: Infinity, ease: 'linear', duration: 10 }}
                    className="absolute inset-x-0 inset-y-0 bg-[radial-gradient(circle_at_center,#050505_0%,#1a1917_40%,#111_100%)] rounded-full border-2 border-stone-850 flex items-center justify-center shadow-lg relative"
                  >
                    <div className="absolute inset-2.5 rounded-full border border-stone-850/80" />
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-950 to-amber-950 overflow-hidden flex items-center justify-center relative">
                      {formData.photoUrl ? (
                        <img src={formData.photoUrl} alt="Vinyl mini" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                      ) : (
                        <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                      )}
                      <div className="absolute inset-x-0 inset-y-0 m-auto w-2 h-2 bg-stone-950 rounded-full" />
                    </div>
                  </motion.div>
                </div>

                <div className="space-y-0.5">
                  <h4 className="font-serif font-bold text-base text-stone-100">
                    {formData.recipientName ? `Canção para ${formData.recipientName}` : 'Canção por Personalizar'}
                  </h4>
                  <p className="text-xxs text-stone-400 font-mono">
                    OCASIÃO: <strong className="text-amber-500 uppercase">{formData.occasion || 'PENDENTE'}</strong>
                  </p>
                </div>
              </div>

              {/* Connected details live cards */}
              <div className="bg-stone-950/80 p-4 rounded-xl border border-stone-900 space-y-2.5 text-xxs leading-relaxed font-mono text-stone-450">
                <div>
                  <span className="text-stone-605 block text-[9px] uppercase tracking-wider">Como deseja que se sinta:</span>
                  <span className="font-semibold text-stone-200">
                    {formData.desiredEmotion ? `${formData.desiredEmotion} ✨` : 'Pendente de escolha...'}
                  </span>
                </div>

                <div>
                  <span className="text-stone-605 block text-[9px] uppercase tracking-wider font-mono">Rítmo de Fundo:</span>
                  <span className="font-semibold text-stone-200">
                    {formData.musicStyle ? `${formData.musicStyle} (${formData.referenceArtist || 'Geral'})` : 'Pendente...'}
                  </span>
                </div>

                <div>
                  <span className="text-stone-605 block text-[9px] uppercase tracking-wider font-mono">Apelidos Carinhosos:</span>
                  <span className="font-semibold text-stone-200">
                    {formData.recipientNick ? `"${formData.recipientNick}" de ${formData.userNick || 'mim'}` : 'Ainda não configurado...'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
