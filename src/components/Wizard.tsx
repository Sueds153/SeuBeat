import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowRight, ArrowLeft, Heart, Sparkles, Check, Upload,
  Mic, Mail, Phone, Eye, Lock, RefreshCw, Play, Pause, AlertTriangle, ShieldCheck, MapPin, Copy, FileText
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
import { fbLead, fbAddPaymentInfo, fbPurchase, parsePrice } from '../lib/metaPixel';

interface WizardProps {
  onBackToLanding: () => void;
}

type GenerationStatus =
  | 'idle'
  | 'lyrics_generating'
  | 'lyrics_ready'
  | 'music_processing'
  | 'preview_available'
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
  const [showPreviewPage, setShowPreviewPage] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info'; id: number } | null>(null);
  
  // Audio Player Simulation States
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); // 0 to 20 seconds
  
  // Checkout & Upsell States
  const [selectedPlanID, setSelectedPlanID] = useState<'standard' | 'express' | 'premium' | null>(null);
  const [voiceUpsellApplied, setVoiceUpsellApplied] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showVoiceCloningScreen, setShowVoiceCloningScreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [clonedVoiceFile, setClonedVoiceFile] = useState<File | null>(null);
  const [copiedText, setCopiedText] = useState<'entidade' | 'referencia' | null>(null);
  const [isDone, setIsDone] = useState(false); // Order success screen
  const [generatedShareUrl, setGeneratedShareUrl] = useState('');

  // Estado do upload de comprovativo de pagamento
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paymentSubmitError, setPaymentSubmitError] = useState<string>('');
  const [paymentTab, setPaymentTab] = useState<'atm' | 'express'>('express');

  // AI Song states powered by Claude
  const [aiSongTitle, setAiSongTitle] = useState('');
  const [aiLyrics, setAiLyrics] = useState<string[]>([]);
  const [aiLyricsSnippet, setAiLyricsSnippet] = useState('');
  const [aiLetterText, setAiLetterText] = useState('');
  const [dbSongId, setDbSongId] = useState<string>('');
  const [dbSongRequestId, setDbSongRequestId] = useState<string>('');
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [generationError, setGenerationError] = useState('');
  const [previewAudioUrl, setPreviewAudioUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const wrappedSetFormData: React.Dispatch<React.SetStateAction<WizardData>> = (action) => {
    setFormData(action);
    setFieldErrors({});
  };

  // Persistir progresso no localStorage (formData + step) para sobreviver a refresh
  useEffect(() => {
    try {
      const { photoFile, ...rest } = formData;
      localStorage.setItem('seubeat_wizard_progress', JSON.stringify({ formData: rest, step }));
    } catch {}
  }, [formData, step]);

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
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const proofMountedRef = useRef(true);
  useEffect(() => { return () => { proofMountedRef.current = false; }; }, []);

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
      
      // Se for uma imagem, gerar preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (proofMountedRef.current) setProofPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setProofPreviewUrl('');
      }
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
        if (!proofMountedRef.current) return;
        const base64Data = reader.result as string;
        
        let voiceBase64 = null;
        let voiceFilename = null;
        let voiceMimeType = null;
        
        const postPaymentData = async (proofStr: string, voiceStr: string | null, voiceName: string | null, voiceType: string | null) => {
          try {
            const res = await fetch('/api/submit-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                songRequestId: dbSongRequestId || null,
                userEmail: formData.email,
                plan: selectedPlanID || 'standard',
                amount: getPrice(),
                proofBase64: proofStr,
                proofFilename: proofFile.name,
                proofMimeType: proofFile.type,
                voiceSampleBase64: voiceStr,
                voiceSampleFilename: voiceName,
                voiceSampleMimeType: voiceType
              })
            });

            const data = await res.json();
            if (res.ok && data.success) {
              setPaymentSubmitted(true);
              fbPurchase(selectedPlanID || 'standard', parsePrice(getPrice()));
              setPaymentSubmitError('');
            } else {
              setPaymentSubmitError(data.error || 'Erro ao submeter o comprovativo.');
            }
          } catch (fetchErr: any) {
            setPaymentSubmitError('Erro na ligação ao servidor: ' + fetchErr.message);
          } finally {
            setPaymentSubmitting(false);
          }
        };

        if (clonedVoiceFile) {
          const voiceReader = new FileReader();
          voiceReader.readAsDataURL(clonedVoiceFile);
          voiceReader.onloadend = async () => {
            if (!proofMountedRef.current) return;
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

  // Memory writing suggestions UI tab state
  const [suggestTab, setSuggestTab] = useState<'viagem' | 'romance' | 'divertido' | 'quotidiano'>('viagem');

  const photoFileRef = useRef<HTMLInputElement>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const submissionStartedRef = useRef(false);

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

  // Card items configurations
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

  // Processing message rotator while the real backend workflow runs.
  useEffect(() => {
    if (isSubmitting) {
      const rotateTimer = setInterval(() => {
        setRotatingMsgIndex((prev) => (prev + 1) % 4);
      }, 3000);

      return () => {
        clearInterval(rotateTimer);
      };
    }
  }, [isSubmitting]);

  const pollCancelledRef = useRef(false);

  const pollSongUntilPreview = async (songId: string, maxAttempts = 60) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (pollCancelledRef.current) return false;
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 8000));
      }

      const statusRes = await fetch(`/api/song/${songId}`);
      if (!statusRes.ok) {
        throw new Error('Nao foi possivel consultar o estado da musica.');
      }

      const statusData = await statusRes.json();
      const song = statusData.data;
      const requestStatus = song?.status ?? song?.song_requests?.status;
      const previewUrl = song?.preview_url;

      if (requestStatus === 'failed' || song?.mureka_status === 'failed') {
        throw new Error('A geracao da musica falhou. Tente novamente.');
      }

      if (previewUrl && (requestStatus === 'music_ready' || song?.mureka_status === 'completed')) {
        setPreviewAudioUrl(previewUrl);
        setGenerationStatus('preview_available');
        setProcessingStage(4);
        setIsSubmitting(false);
        setShowPreviewPage(true);
        return true;
      }

      if (requestStatus === 'lyrics_ready') {
        setGenerationStatus('lyrics_ready');
        setProcessingStage(2);
      } else {
        setGenerationStatus('music_processing');
        setProcessingStage(3);
      }
    }

    setGenerationStatus('music_processing');
    setProcessingStage(3);
    return false;
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { pollCancelledRef.current = true; };
  }, []);

  // Call Claude Lyric Generator API on submission
  useEffect(() => {
    if (isSubmitting) {
      if (submissionStartedRef.current) return;
      submissionStartedRef.current = true;
      
      const submitData = async () => {
        setGenerationStatus('lyrics_generating');
        setGenerationError('');
        setProcessingStage(1);
        setDbSongId('');
        setDbSongRequestId('');
        setPreviewAudioUrl('');

        let photoBase64 = null;
        let photoFilename = null;
        let photoMimeType = null;
        
        if (formData.photoFile) {
          try {
            photoBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(formData.photoFile!);
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
            });
            photoFilename = formData.photoFile.name;
            photoMimeType = formData.photoFile.type;
          } catch (e) {
            console.error('Error reading photo file:', e);
            showToast('Erro ao ler a foto. Tente selecionar novamente.', 'error');
          }
        }
        
        try {
          const res = await fetch('/api/generate-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              photoBase64,
              photoFilename,
              photoMimeType
            })
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Erro na conexão' }));
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
          fbLead('lyrics_generated');
          setShowPreviewPage(false);

          const initialStatus = data.status === 'music_processing' ? 'music_processing' : 'lyrics_ready';
          setGenerationStatus(initialStatus);
          setProcessingStage(initialStatus === 'music_processing' ? 3 : 2);
          showToast('Letra gerada com sucesso!', 'success');

          const previewReady = await pollSongUntilPreview(data.dbSongId);
          if (!previewReady) {
            setIsSubmitting(false);
            setShowPreviewPage(false);
            setGenerationStatus('music_processing');
            setGenerationError('A letra foi criada. A música ainda está em processamento; volte a verificar em instantes.');
            showToast('Letra pronta. Música em processamento...', 'info');
          }
        } catch (err: any) {
          console.error('Error generating AI lyrics:', err);
          setGenerationStatus('error');
          const errorMsg = err.message || 'Erro ao gerar. Tente novamente.';
          setGenerationError(errorMsg);
          showToast(errorMsg, 'error');
          setIsSubmitting(false);
          submissionStartedRef.current = false;
        }
      };
      
      submitData();
    }
  }, [isSubmitting, formData]);

  // Audio Preview Progress Clock with real Suno audio playback
  useEffect(() => {
    return () => {
      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
        liveAudioRef.current = null;
      }
    };
  }, [formData.voiceType, voiceUpsellApplied, previewAudioUrl]);

  useEffect(() => {
    if (audioPlaying) {
      if (!liveAudioRef.current) {
        const url = previewAudioUrl;
        if (!url) return;
        liveAudioRef.current = new Audio(url);
        
        liveAudioRef.current.ontimeupdate = () => {
          if (liveAudioRef.current) {
            const current = liveAudioRef.current.currentTime;
            if (current >= 30) {
              liveAudioRef.current.pause();
              setAudioPlaying(false);
              setAudioProgress(30);
            } else {
              setAudioProgress(current);
            }
          }
        };

        liveAudioRef.current.onended = () => {
          setAudioPlaying(false);
          setAudioProgress(30);
        };
      }
      
      liveAudioRef.current.play().catch(err => {
        console.warn("Speech playback interrupted or blocked:", err);
      });
    } else {
      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
      }
    }
  }, [audioPlaying, aiLyricsSnippet, aiLyrics, previewAudioUrl]);

  // Cleanup live audio player on component unmount
  useEffect(() => {
    return () => {
      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
        liveAudioRef.current = null;
      }
    };
  }, []);

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
        if (d.elevenlabs_voice_id && d.elevenlabs_voice_id.includes('"failed"')) {
          setVoiceCloningFailed(true);
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
        sessionStorage.setItem('seubeat_photo_base64', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const savedBase64 = sessionStorage.getItem('seubeat_photo_base64');
    if (savedBase64 && !formData.photoUrl) {
      try {
        const byteString = atob(savedBase64.split(',')[1]);
        const mimeString = savedBase64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: mimeString });
        const file = new File([blob], 'foto.' + (mimeString.split('/')[1] || 'jpg'), { type: mimeString });
        const url = URL.createObjectURL(file);
        wrappedSetFormData(prev => ({ ...prev, photoFile: file, photoUrl: url }));
      } catch (e) {
        sessionStorage.removeItem('seubeat_photo_base64');
      }
    }
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
               formData.recipientName.trim().length >= 2 &&
               formData.userNick.trim().length >= 2 &&
               formData.recipientNick.trim().length >= 2;
      case 2:
        return formData.occasion !== '' && formData.whyCreatedToday.trim().length >= 5;
      case 3:
        return formData.musicStyle !== '';
      case 4:
        return formData.voiceType !== '';
      case 5:
        return formData.whatMakesSpecial.trim().length >= 5 && formData.onlySheDoes.trim().length >= 5;
      case 6:
        return formData.unforgettableMemory.trim().length >= 5 && formData.whereItHappened.trim() !== '';
      case 7:
        return formData.messageFromTheHeart.trim().length >= 5 && formData.desiredEmotion !== '';
      case 8:
        return formData.photoUrl !== '' || formData.photoFile !== null;
      case 9:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      default:
        return true;
    }
  };

  const handleNext = () => {
    const errors = zodValidateStep(step, formData as unknown as Record<string, unknown>);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (step < 9) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Trigger Submitting / Composition simulation
      submissionStartedRef.current = false;
      setShowPreviewPage(false);
      setPreviewAudioUrl('');
      setDbSongId('');
      setDbSongRequestId('');
      setGenerationStatus('idle');
      setGenerationError('');
      setProcessingStage(0);
      setIsSubmitting(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const retryGeneration = () => {
    submissionStartedRef.current = false;
    setDbSongId('');
    setDbSongRequestId('');
    setPreviewAudioUrl('');
    setShowPreviewPage(false);
    setGenerationStatus('idle');
    setGenerationError('');
    setIsSubmitting(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recheckMusicStatus = async () => {
    if (!dbSongId) return;
    setIsSubmitting(true);
    setGenerationError('');
    setGenerationStatus('music_processing');
    if (!dbSongId) return;
    setIsSubmitting(true);
    setGenerationError('');
    try {
      const previewReady = await pollSongUntilPreview(dbSongId, 30);
      if (!previewReady) {
        setIsSubmitting(false);
        setGenerationStatus('music_processing');
        setGenerationError('A musica ainda esta em processamento. Tente verificar novamente daqui a pouco.');
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
    fbAddPaymentInfo(pId, PLAN_VALUES[pId]);
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
    // Quando o upsell de voz está activo, o plano base é sempre Express (9.900 Kz)
    // para garantir que o total seja sempre 14.900 Kz
    if (voiceUpsellApplied) return '14.900 Kz';
    if (selectedPlanID === 'express') return '9.900 Kz';
    if (selectedPlanID === 'premium') return '14.900 Kz';
    return '7.900 Kz'; // standard
  };

  const activeMeta = STEP_META[step - 1];

  const ROTATING_MESSAGES = [
    '❤️ Uma nova música foi criada para uma mãe',
    '💕 Uma nova declaração de amor foi criada',
    '🎂 Uma música de aniversário acabou de ficar pronta',
    '💍 Um pedido de casamento está a transformar-se em música'
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between py-10 px-4 md:px-8">
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl font-mono text-sm shadow-2xl border ${
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
        {!isSubmitting && !showPreviewPage && !isDone && !showVoiceCloningScreen && generationStatus === 'idle' && (
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
                ⏱ <span className="text-amber-400 font-bold">~3 min</span> · PASSO <span className="text-amber-400 font-bold">{step}</span> · {Math.round((step / 9) * 100)}%
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
            className="max-w-2xl mx-auto w-full text-center space-y-8 bg-stone-900/30 p-8 md:p-12 rounded-3xl border border-stone-850 shadow-2xl backdrop-blur relative overflow-hidden"
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
          </motion.div>
        )}

        {!isSubmitting && generationStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto w-full text-center space-y-6 bg-stone-900/40 p-8 md:p-10 rounded-3xl border border-rose-900/40 shadow-2xl"
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

        {!isSubmitting && generationStatus === 'music_processing' && !showPreviewPage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto w-full text-center space-y-6 bg-stone-900/40 p-8 md:p-10 rounded-3xl border border-amber-900/30 shadow-2xl"
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

        {/* -------------------- SHOW PREVIEW PAGE: 20s PREVIEW AUDIO PLAYER & EXCLUSIVE OFFERS -------------------- */}
        {showPreviewPage && !isDone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto w-full space-y-10 py-6"
          >
            {/* Header branding on preview */}
            <div className="text-center space-y-2">
              <span className="text-emerald-500 text-xs font-mono font-bold tracking-widest uppercase flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> COMPOSIÇÃO DE DEMONSTRAÇÃO PRONTA
              </span>
              <h2 className="font-serif text-3xl md:text-4xl text-stone-100 font-black tracking-tight">
                😍 Ela vai adorar ouvir isto
              </h2>
              <p className="text-stone-400 text-sm md:text-base max-w-lg mx-auto">
                A tua música está pronta. Escuta abaixo a pré-visualização exclusiva dos primeiros 20 segundos da canção.
              </p>
            </div>

            {/* THE STUDIO PREVIEW AUDIO CONTAINER MAP */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Side: Modern Cassette/Vinyl Visualizer */}
              <div className="md:col-span-5 bg-stone-900/50 p-6 rounded-3xl border border-stone-800 flex flex-col justify-between space-y-6 text-center">
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                  <motion.div 
                    animate={{ rotate: audioPlaying ? 360 : 0 }}
                    transition={{ repeat: Infinity, ease: "linear", duration: 7 }}
                    className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111_0%,#1a1a1a_40%,#090909_100%)] rounded-full border-4 border-stone-950 flex items-center justify-center shadow-lg"
                  >
                    <div className="absolute inset-3 rounded-full border border-stone-800/80" />
                    <div className="absolute inset-8 rounded-full border border-stone-800/40" />
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-rose-950 to-amber-950 overflow-hidden flex items-center justify-center relative">
                      {formData.photoUrl ? (
                        <img 
                          src={formData.photoUrl} 
                          alt="Casal sticker" 
                          className="w-full h-full object-cover opacity-80"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-xl">❤️</div>
                      )}
                      <div className="absolute inset-x-0 inset-y-0 m-auto w-2 h-2 bg-stone-950 rounded-full" />
                    </div>
                  </motion.div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xxs font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15">
                    GÉNERO: {formData.musicStyle || 'Pop Romântico'}
                  </span>
                  <h4 className="font-serif text-lg font-bold text-stone-100 mt-1">
                    {aiSongTitle || `Presente Para ${formData.recipientName}`}
                  </h4>
                  <p className="text-xs text-stone-500 font-mono">
                    AUTOR: {formData.userNick || 'Dedicatória Especial'}
                  </p>
                </div>

                {/* Micro preview lyrics sheet snippet */}
                <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 text-left space-y-2">
                  <span className="text-[10px] text-stone-500 font-mono tracking-widest uppercase block border-b border-stone-900 pb-1">Letra de Dedicatória (Amostra):</span>
                  <p className="text-xs tracking-tight text-stone-300 italic font-serif leading-relaxed line-clamp-3">
                    {aiLyricsSnippet ? `"${aiLyricsSnippet}"` : `"${formData.recipientNick ? formData.recipientNick : 'Meu amor'}, quando ouço o teu riso alegre... sei que em Luanda ou Benguela nunca haverá luar mais lindo que o brilho do teu olhar..."`}
                  </p>
                </div>
              </div>

              {/* Right Side: Progressive Audio Playbar & Audio Synthesis Trigger */}
              <div className="md:col-span-7 bg-stone-900/30 rounded-3xl p-6 border border-stone-800 flex flex-col justify-between space-y-6 relative overflow-hidden">
                <div className="absolute -right-16 -top-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 bg-stone-950 border border-stone-800 text-stone-400 font-mono text-[10px] rounded-lg">
                      SISTEMA ESTÚDIO SEUBEAT
                    </span>
                    <span className="text-xs font-mono text-stone-400">
                      CÓD-SURPRESA: <strong className="text-amber-500">#SB-{(new Date().getFullYear())}</strong>
                    </span>
                  </div>

                  {/* INTERACTIVE PREVIEW CONTROLLER SHELL */}
                  <div className="bg-stone-950 rounded-2xl p-6 border border-stone-850 space-y-4 relative">
                    
                    {/* The Waveform Mock Visual representation */}
                    <div className="h-12 flex items-end gap-0.5 sm:gap-1 px-2 pt-2">
                      {Array.from({ length: 30 }).map((_, idx) => {
                        // random waves or wave peaks
                        const activeIndex = Math.floor((audioProgress / 20) * 30);
                        const isActive = idx < activeIndex;
                        const height = [28, 48, 12, 38, 44, 18, 52, 28, 40, 48, 10, 32, 42, 24, 48, 30, 18, 40, 44, 28, 52, 12, 36, 42, 22, 48, 32, 14, 28, 44][idx];
                        
                        return (
                          <div 
                            key={idx} 
                            style={{ height: `${height}%` }}
                            className={`w-full rounded-sm transition-all duration-300 ${
                              isActive 
                                ? 'bg-gradient-to-t from-emerald-500 to-amber-400' 
                                : 'bg-stone-900'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-400 font-mono px-1">
                      <span>0:{Math.floor(audioProgress).toString().padStart(2, '0')}</span>
                      <span className="text-amber-500">0:20 (Amostra Grátis)</span>
                      <span>3:15 (Total)</span>
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center gap-4">
                      {audioProgress >= 20 ? (
                        <div className="w-full text-center py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 animate-bounce" />
                          <span>Pré-visualização concluída! Escolha um plano abaixo para desbloquear.</span>
                        </div>
                      ) : (
                        <button
                          id="play-demo-btn"
                          onClick={() => setAudioPlaying(!audioPlaying)}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-stone-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer"
                        >
                          {audioPlaying ? (
                            <>
                              <Pause className="w-4 h-4 text-stone-950 fill-stone-950" />
                              <span>Pausar Amostra</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 text-stone-950 fill-stone-950" />
                              <span>Ouvir 20 Segundos Gratuitos</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Lock Screen overlay if progress completes */}
                    {audioProgress >= 20 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm flex flex-col justify-center items-center rounded-2xl p-4 text-center space-y-2 border border-amber-500/20"
                      >
                        <Lock className="w-8 h-8 text-amber-400" />
                        <h5 className="text-stone-100 font-serif font-bold text-sm">Fim da Amostra Grátis</h5>
                        <p className="text-stone-400 text-xxs max-w-xs leading-normal">
                          Adquira o seu download em MP3/WAV de alta resolução e a página exclusiva para a dedicatória de amor completa.
                        </p>
                      </motion.div>
                    )}

                  </div>
                </div>

                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-2.5 text-xs text-stone-400">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0 mt-0.5" />
                  <span>
                    A letra da canção ficou linda e cheia de romance angolano. Adicionámos rimas sobre a vossa memória e as vossas alcunhas preferidas para arrancar lágrimas de alegria.
                  </span>
                </div>
              </div>

            </div>

            {/* UPGRADE SELECTION GRID - THREE CARDS OF PRICE AS REQUESTED BY USER */}
            <div className="space-y-4 pt-6">
              <h3 className="text-left font-serif text-xl font-bold tracking-tight text-stone-200">
                Selecione o seu plano para receber a música completa:
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* PLAN 1: STANDARD */}
                <div className="bg-stone-900/40 rounded-2.5xl p-6 border border-stone-850 hover:border-stone-700 transition-all flex flex-col justify-between relative space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-stone-300">STANDARD</h4>
                      <p className="text-stone-500 text-xs mt-0.5">Música personalizada com entrega em 24h</p>
                    </div>
                    
                    <div className="text-left py-2">
                      <span className="text-2xl font-serif font-black text-stone-100">7.900 Kz</span>
                      <span className="text-[10px] text-stone-500 block">Kwanza Angola</span>
                    </div>

                    <ul className="text-xs text-stone-400 space-y-2 pt-2 border-t border-stone-900">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Música completa (3-4 min)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Pré-visualização antes de pagar</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Voz Masculina ou Feminina</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Página personalizada online</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Download MP3</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Entrega em 24h</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    id="standard-plan-btn"
                    onClick={() => handlePlanSelection('standard')}
                    className="w-full py-3 bg-stone-800 hover:bg-stone-750 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer text-center block"
                  >
                    Receber amanhã
                  </button>
                </div>

                {/* PLAN 2: EXPRESS */}
                <div className="bg-stone-900/40 rounded-2.5xl p-6 border-2 border-amber-500/70 shadow-2xl transition-all flex flex-col justify-between relative space-y-6">
                  {/* Badge */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 bg-gradient-to-r from-amber-500 to-rose-500 text-stone-950 font-mono text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                    🔥 MAIS POPULAR
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-amber-300 flex items-center gap-1.5">
                        EXPRESS
                      </h4>
                      <p className="text-amber-500/80 text-xs mt-0.5">Tudo do Standard, entrega imediata e dueto</p>
                    </div>
                    
                    <div className="text-left py-2">
                      <span className="text-2xl font-serif font-black text-stone-100">9.900 Kz</span>
                      <span className="text-[10px] text-stone-500 block">Kwanza Angola</span>
                    </div>

                    <ul className="text-xs text-stone-400 space-y-2 pt-2 border-t border-stone-900">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Tudo do Standard</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Voz em Dueto</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Entrega imediata</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>1 revisão de letra incluída</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-center text-[10px] text-amber-500/80 font-mono font-medium">
                      83% dos clientes escolhem esta opção.
                    </p>
                    <button
                      id="express-plan-btn"
                      onClick={() => handlePlanSelection('express')}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-bold text-xs rounded-xl transition-all cursor-pointer text-center block"
                    >
                      Receber agora
                    </button>
                  </div>
                </div>

                {/* PLAN 3: PREMIUM */}
                <div className="bg-stone-900/40 rounded-2.5xl p-6 border border-stone-850 hover:border-stone-700 transition-all flex flex-col justify-between relative space-y-6">
                  {/* Badge */}
                  <div className="absolute -top-3.5 right-4 bg-purple-600 text-stone-100 font-mono text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                    ❤️ MELHOR PRESENTE
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-stone-300">PREMIUM</h4>
                      <p className="text-stone-500 text-xs mt-0.5">Tudo do Express com a sua própria voz</p>
                    </div>
                    
                    <div className="text-left py-2">
                      <span className="text-2xl font-serif font-black text-stone-100">14.900 Kz</span>
                      <span className="text-[10px] text-stone-500 block">Kwanza Angola</span>
                    </div>

                    <ul className="text-xs text-stone-400 space-y-2 pt-2 border-t border-stone-900">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Tudo do Express</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Voz personalizada do cliente (timbre clonado)</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    id="premium-plan-btn"
                    onClick={() => handlePlanSelection('premium')}
                    className="w-full py-3 bg-stone-800 hover:bg-stone-750 text-stone-100 hover:text-white font-semibold text-xs rounded-xl transition-all cursor-pointer text-center block"
                  >
                    Quero a experiência Premium
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        )}

        {/* -------------------- THE UPSELL OVERLAY MODAL -------------------- */}
        <AnimatePresence>
          {showUpsellModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto p-4 bg-stone-950/90 backdrop-blur-md flex items-start justify-center md:items-center py-8 md:py-12">
              {/* Backing ambient glowing accent circles */}
              <div className="absolute w-[300px] h-[300px] bg-amber-500/10 rounded-full filter blur-[100px] pointer-events-none" />
              <div className="absolute w-[250px] h-[250px] bg-rose-500/5 rounded-full filter blur-[80px] pointer-events-none translate-x-[100px] translate-y-[-50px]" />

              <motion.div 
                initial={{ opacity: 0, scale: 0.93, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 180 }}
                className="bg-gradient-to-b from-stone-900 to-stone-950 border border-stone-800/80 rounded-[32px] p-6 md:p-8 max-w-lg w-full text-center space-y-6 shadow-2xl relative overflow-hidden"
              >
                {/* Upper Premium Badge */}
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold uppercase rounded-full tracking-wider shadow-sm">
                    <Sparkles className="w-3 h-3 animate-pulse" /> VOZ DE ESTÚDIO EXCLUSIVA
                  </span>
                </div>

                {/* Main Mic sphere badge with wave animation */}
                <div className="relative w-18 h-18 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-rose-500 rounded-full opacity-10 animate-ping" />
                  <div className="absolute inset-2 bg-gradient-to-tr from-amber-500 to-rose-500 rounded-full blur-md opacity-30" />
                  <div className="relative w-14 h-14 bg-stone-950 border border-stone-800/80 rounded-full flex items-center justify-center text-amber-500 shadow-inner">
                    <Mic className="w-6 h-6 text-amber-400" />
                  </div>
                </div>

                {/* Text titles */}
                <div className="space-y-2">
                  <h3 className="font-serif text-2xl md:text-3xl font-black text-stone-100 tracking-tight leading-none">
                    A música completa cantada com a <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-rose-400 bg-clip-text text-transparent">sua própria voz</span>!
                  </h3>
                  <p className="text-stone-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                    Surpreenda ao máximo. Grave 20 segundos de voz — o nosso estúdio clona o seu timbre com IA e cria uma <strong className="text-stone-200">música cantada inteiramente pela sua voz</strong>, mais uma carta de dedicatória narrada por si.
                  </p>
                </div>

                {/* Audiowave voice comparison cards block */}
                <div className="bg-stone-950/80 p-5 rounded-2.5xl border border-stone-850 text-left space-y-4 relative">
                  <div className="grid grid-cols-2 gap-3">
                    
                    {/* Standard Voice Choice */}
                    <div className="bg-stone-900/50 p-3 rounded-xl border border-stone-800 flex flex-col justify-between h-24">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-stone-500 font-mono">OPÇÃO PADRÃO</span>
                        <span className="text-xxs text-stone-500 font-sans italic bg-stone-950 px-1.5 py-0.5 rounded border border-stone-900">Incluído</span>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-semibold text-stone-300">Voz Inteligente</h4>
                        <p className="text-[10px] text-stone-550 leading-snug">Timbre estúdio predefinido de alta qualidade.</p>
                      </div>
                    </div>

                    {/* Cloned Voice Choice */}
                    <div className="bg-amber-500/[0.04] p-3 rounded-xl border-2 border-amber-500/50 flex flex-col justify-between h-24 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/10 rounded-bl-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">RECOMENDADO</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-amber-300">Sua Voz de Estúdio</h4>
                        <p className="text-[10px] text-amber-450 leading-snug">Usa o seu tom e expressão de verdade.</p>
                      </div>
                    </div>

                  </div>

                  {/* Value highlights bullet lists */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[9px] text-stone-500 font-mono tracking-widest uppercase block border-b border-stone-900 pb-1.55">PORQUE ADICIONAR ESTE UPGRADE?</span>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-stone-400 font-medium">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Fator surpresa inigualável</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Garantia de fortes lágrimas</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Grave em 20 seg por WhatsApp</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Disponível para sempre</span>
                      </li>
                    </ul>
                  </div>

                  {/* Single Premium Promotion Pricing Info Bubble */}
                  <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                    <div className="text-left">
                      <span className="text-xs text-stone-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Total com Voz Clonada:
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono block">Express 9.900 + Voz 5.000</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-amber-400 font-mono block">14.900 Kz</span>
                      <span className="text-[9px] text-stone-500 font-mono uppercase">Kwanza Angola</span>
                    </div>
                  </div>

                </div>

                {/* Actions Block */}
                <div className="space-y-3">
                  <button
                    id="upsell-accept-btn"
                    onClick={() => {
                      // Força sempre o plano Express como base antes de aplicar o upsell de voz
                      setSelectedPlanID('express');
                      setVoiceUpsellApplied(true);
                      setShowUpsellModal(false);
                      setShowVoiceCloningScreen(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-rose-600 text-stone-950 font-black text-xs md:text-sm rounded-2xl hover:opacity-95 active:scale-[0.98] transition-transform cursor-pointer uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                  >
                    <Mic className="w-4 h-4 text-stone-950 fill-stone-950" />
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
                    className="w-full py-2.5 text-stone-500 hover:text-stone-300 font-semibold text-xs rounded-xl hover:bg-stone-900/40 transition-colors cursor-pointer"
                  >
                    Não obrigado, usar voz padrão gratuita
                  </button>
                </div>

                {/* Footer terms trust micro info */}
                <div className="text-[9px] text-stone-600 font-mono tracking-wide flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3 text-stone-750" />
                  <span>Seguro & Protegido • Devolução 100% caso não goste do resultado</span>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

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

                {/* ATM / Express Step Guides */}
                <div className="space-y-3 text-left pt-2">
                  <h5 className="text-[10px] font-mono text-amber-500 uppercase tracking-wider block font-bold">Como Pagar por Multicaixa</h5>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-stone-900 rounded-xl p-1 border border-stone-850">
                    <button
                      onClick={() => setPaymentTab('express')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        paymentTab === 'express' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      📱 Multicaixa Express
                    </button>
                    <button
                      onClick={() => setPaymentTab('atm')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        paymentTab === 'atm' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      🏧 ATM (caixa físico)
                    </button>
                  </div>

                  {/* Express steps */}
                  {paymentTab === 'express' && (
                    <div className="space-y-2 text-xs text-stone-400 font-sans">
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-stone-900 border border-stone-850 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">1</div>
                        <p>App → Login PIN → <strong className="text-stone-200">Pagamentos</strong> → <strong className="text-stone-200">Pagamento de Serviços/Compras</strong></p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-stone-900 border border-stone-850 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">2</div>
                        <p>Digite: Entidade <strong className="text-white">{paymentDetails.entidade}</strong> · Ref. <strong className="text-white">{paymentDetails.referencia}</strong> · Valor <strong className="text-amber-400">{getPrice()}</strong></p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-stone-900 border border-stone-850 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">3</div>
                        <p>Confirme com PIN/biometria, faça <strong className="text-stone-200">printscreen</strong> da confirmação e carregue abaixo</p>
                      </div>
                    </div>
                  )}

                  {/* ATM steps */}
                  {paymentTab === 'atm' && (
                    <div className="space-y-2 text-xs text-stone-400 font-sans">
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-stone-900 border border-stone-850 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">1</div>
                        <p>Cartão → PIN → <strong className="text-stone-200">Pagamentos</strong> → <strong className="text-stone-200">Pagamento de Serviços</strong> → <strong className="text-stone-200">Compras/Outros</strong></p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-stone-900 border border-stone-850 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">2</div>
                        <p>Digite: Entidade <strong className="text-white">{paymentDetails.entidade}</strong> · Ref. <strong className="text-white">{paymentDetails.referencia}</strong> · Valor <strong className="text-amber-400">{getPrice()}</strong></p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-stone-900 border border-stone-850 shrink-0 flex items-center justify-center text-[10px] text-amber-500 font-bold font-mono mt-0.5">3</div>
                        <p>Confirme, guarde o <strong className="text-stone-200">comprovativo impresso</strong>, tire foto e carregue abaixo</p>
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
                      {/* Area de drag and drop ou select */}
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

                      {proofFile && (
                        <div className="bg-stone-950 p-3 rounded-xl border border-stone-850 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-stone-300 truncate font-mono text-[11px]">{proofFile.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProofFile(null);
                              setProofPreviewUrl('');
                            }}
                            className="text-stone-500 hover:text-rose-400 text-xs font-semibold cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      )}

                      {/* Preview: image ou ícone PDF */}
                      {proofFile && !proofPreviewUrl && proofFile.type === 'application/pdf' && (
                        <div className="mt-2 rounded-xl border border-stone-800 bg-stone-950 p-4 flex items-center gap-3">
                          <FileText className="w-8 h-8 text-rose-400 shrink-0" />
                          <div>
                            <p className="text-xs text-stone-300 font-medium">{proofFile.name}</p>
                            <p className="text-[10px] text-stone-500">PDF · {(proofFile.size / 1024 / 1024).toFixed(1)}MB</p>
                          </div>
                        </div>
                      )}
                      {proofPreviewUrl && (
                        <div className="mt-2 relative rounded-xl overflow-hidden border border-stone-800 max-h-40 bg-stone-950">
                          <img
                            src={proofPreviewUrl}
                            alt="Preview Comprovativo"
                            className="w-full h-full object-contain max-h-40 mx-auto"
                          />
                        </div>
                      )}

                      {paymentSubmitError && (
                        <>
                          <p className="text-rose-400 text-xs font-mono text-left">{paymentSubmitError}</p>
                          <div className="flex justify-start">
                            <WhatsAppHelp context="pagamento" label="Falar com apoio" />
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={submitPaymentProof}
                        disabled={!proofFile || paymentSubmitting}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 disabled:from-stone-800 disabled:to-stone-850 disabled:text-stone-500 text-stone-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {paymentSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                            <span>A Enviar Comprovativo...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-stone-950" />
                            <span>Confirmar e Enviar Comprovativo</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-left space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono">
                        <Check className="w-4 h-4" />
                        <span>COMPROVATIVO SUBMETIDO COM SUCESSO!</span>
                      </div>
                      <p className="text-stone-400 text-xs font-sans leading-relaxed">
                        Recebemos o seu comprovativo e associamos ao seu pedido. O nosso sistema ou equipa validará o pagamento nos próximos minutos.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/payment-status?email=${encodeURIComponent(formData.email)}&requestId=${dbSongRequestId}`);
                            const data = await res.json();
                            if (data.status === 'approved') {
                              showToast('Pagamento confirmado! A sua música será entregue em breve.', 'success');
                            } else if (data.status === 'rejected') {
                              showToast('Pagamento rejeitado. Fale connosco pelo WhatsApp.', 'error');
                            } else {
                              showToast('Pagamento ainda pendente. Voltamos a verificar mais tarde.', 'info');
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
                      setCopiedText('referencia');
                      setTimeout(() => setCopiedText(null), 2000);
                    }}
                    className="p-1.5 text-stone-400 hover:text-amber-400 hover:bg-stone-950 rounded-lg transition-colors cursor-pointer"
                    title="Copiar link"
                  >
                    {copiedText === 'referencia' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Email notification — enviado apenas após verificação do pagamento */}
                <div className="text-xs pt-1 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-stone-400 font-mono text-xxs uppercase">
                    Email com o link será enviado após verificação do pagamento
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
                    <span>💝 Ver prévia da dedicatória de {formData.recipientName.split(' ')[0]}</span>
                    <ArrowRight className="w-4 h-4 text-stone-950" />
                  </a>
                </div>
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
                    wrappedSetFormData(INITIAL_WIZARD_DATA);
                    setStep(1);
                    setIsSubmitting(false);
                    setShowPreviewPage(false);
                    setAudioPlaying(false);
                    setAudioProgress(0);
                    setSelectedPlanID(null);
                    setVoiceUpsellApplied(false);
                    setShowVoiceCloningScreen(false);
                    setIsRecording(false);
                    setHasRecorded(false);
                    setRecordingSeconds(0);
                    setClonedVoiceFile(null);
                    setIsDone(false);
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
        {!isSubmitting && !showPreviewPage && !isDone && !showVoiceCloningScreen && generationStatus === 'idle' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Form Content */}
            <div className="lg:col-span-7 bg-stone-900/40 rounded-3xl p-6 md:p-8 border border-stone-800 shadow-xl backdrop-blur relative overflow-hidden flex flex-col justify-between min-h-[580px]">
              
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
              <div className="flex items-center justify-between pt-6 border-t border-stone-900 mt-6 relative z-10">
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
                  disabled={!validateStep()}
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
