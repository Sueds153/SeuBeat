/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RecipientType =
  | 'Mãe'
  | 'Pai'
  | 'Esposa'
  | 'Marido'
  | 'Namorado'
  | 'Ex-namorado'
  | 'Filho'
  | 'Irmão'
  | 'Amigo'
  | 'Avó-Avô'
  | 'Professor'
  | 'Pastor'
  | 'Colega'
  | 'Para-mim'
  | 'Outro';

export type OccasionType =
  | 'Aniversário'
  | 'Aniversário de namoro'
  | 'Casamento'
  | 'Declaração de amor'
  | 'Agradecimento'
  | 'Homenagem'
  | 'Pedido de desculpas'
  | 'Saudade'
  | 'Sem motivo';

export type MusicStyleType =
  | 'Kizomba'
  | 'Semba'
  | 'Afrobeat'
  | 'Gospel'
  | 'Acoustic'
  | 'Romantic Pop'
  | 'Zouk'
  | 'Balada'
  | 'Pop'
  | 'R&B'
  | 'Rap';

export type VoiceType =
  | 'Masculina'
  | 'Feminina'
  | 'Dueto'
  | 'Sem preferência';

export type EmotionType =
  | 'Amor'
  | 'Emoção'
  | 'Gratidão'
  | 'Carinho'
  | 'Saudade'
  | 'Inspiração';

export interface WizardData {
  // Step 1
  recipientRelation: RecipientType | '';
  recipientName: string;
  userNick: string;       // Como gosta de ser chamado(a)?
  recipientNick: string;  // Como chama essa pessoa?
  
  // Step 2
  occasion: OccasionType | '';
  whyCreatedToday: string; // O que aconteceu para esta música ser criada hoje?
  
  // Step 3
  musicStyle: MusicStyleType | '';
  referenceArtist: string; // Anselmo Ralph, Matias Damásio, etc.
  
  // Step 4
  voiceType: VoiceType | '';
  
  // Step 5
  whatMakesSpecial: string; // Carinhosa, Paciente etc.
  onlySheDoes: string;      // O que ela faz que só ela faz?
  
  // Step 6
  unforgettableMemory: string;
  whereItHappened: string;  // Luanda, Benguela, etc.
  
  // Step 7
  messageFromTheHeart: string; // O que gostarias que esta pessoa nunca esquecesse? (was messageFromTheHeart)
  desiredEmotion: EmotionType | ''; // Emoções adicionais
  
  // Step 8
  photoFile?: File | null;
  photoUrl?: string; // object URL for preview
  
  // Step 9
  email: string;
  phone: string;
  language: string; 
}

export const INITIAL_WIZARD_DATA: WizardData = {
  recipientRelation: '',
  recipientName: '',
  userNick: '',
  recipientNick: '',
  
  occasion: '',
  whyCreatedToday: '',
  
  musicStyle: '',
  referenceArtist: '',
  
  voiceType: '',
  
  whatMakesSpecial: '',
  onlySheDoes: '',
  
  unforgettableMemory: '',
  whereItHappened: '',
  
  messageFromTheHeart: '',
  desiredEmotion: '',
  
  photoFile: null,
  photoUrl: '',
  
  email: '',
  phone: '',
  language: 'Português',
};

export interface PricingPlan {
  id: 'standard' | 'express' | 'premium';
  name: string;
  price: string;
  subtitle: string;
  features: string[];
  badge?: string;
  popular?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'standard',
    name: 'SeuBeat Standard',
    price: '7.900 Kz',
    subtitle: 'Música personalizada criada no estilo ideal.',
    features: [
      'Entrega digital em 24 horas',
      'Até 2 retoques de letra',
      'Qualidade de áudio standard (MP3)',
      'Estilo de voz Masculino ou Feminino'
    ]
  },
  {
    id: 'express',
    name: 'SeuBeat Express ⚡',
    price: '9.900 Kz',
    subtitle: 'Mais rápido, com letra expandida e maior prioridade.',
    features: [
      'Entrega prioritária na mesma hora',
      'Retoques ilimitados de letra',
      'Áudio em Alta Definição (WAV + MP3)',
      'Vozes em Dueto disponíveis',
      'Página de dedicatória personalizada'
    ],
    badge: 'Mais Popular',
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium Voice 👑',
    price: '14.900 Kz',
    subtitle: 'A sua surpresa! Gravação de timbre personalizada.',
    features: [
      'Entrega express',
      'Sintonia acústica fina do seu timbre de voz',
      'O vocalista assume a letra com a sua assinatura vocal',
      'Acompanhamento VIP por produtor musical',
      'Vídeo-dedicatória com fotos integrado'
    ]
  }
];

export interface DemoSong {
  id: string;
  title: string;
  style: string;
  occasion: string;
  recipient: string;
  lyrics: string[];
  duration: string;
  audioUrl: string;
}

export const DEMO_SONGS: DemoSong[] = [
  {
    id: 'kizomba-mae',
    title: 'Para a Lúcia',
    style: 'Kizomba',
    occasion: '60º Aniversário',
    recipient: 'Mãe (Lúcia)',
    duration: '4:30',
    audioUrl: '/assets/kizomba_lucia.mp3',
    lyrics: [
      "Lúcia, nos teus sessenta anos de luz,",
      "cada ruga é um mapa do amor que me conduziu.",
      "No kizomba lento que o teu coração tece,",
      "vejo a mulher mais forte que a vida me merece.",
      "Mãe, és o primeiro som que o meu mundo soube ouvir,",
      "o teu nome é a canção que me ensinaste a sorrir.",
      "Sessenta anos de graça, de força e de paz,",
      "és a minha rainha — ontem, hoje e sempre mais."
    ]
  },
  {
    id: 'semba-avo',
    title: 'Para o Avô Carlos',
    style: 'Semba',
    occasion: 'Memorial — 1 ano',
    recipient: 'Avô (Carlos)',
    duration: '3:45',
    audioUrl: '/assets/semba_carlos.mp3',
    lyrics: [
      "Um ano passou, mas o teu semba ainda toca,",
      "ressoa lá no quintal onde a família se convoca.",
      "Avô Carlos, a tua voz ainda aqui está,",
      "no cheiro do funje, no sorriso de quem ficou cá.",
      "A terra levou o teu corpo, mas não o teu calor,",
      "cada filho que dançou contigo guarda o teu amor.",
      "Hoje o semba é saudade, é choro, é memória viva —",
      "és presença eterna, Carlos, e a nossa alma revive."
    ]
  },
  {
    id: 'gospel-marido',
    title: 'Para o Paulo',
    style: 'Gospel',
    occasion: 'Declaração de Amor',
    recipient: 'Marido (Paulo)',
    duration: '4:35',
    audioUrl: '/assets/gospel_paulo.mp3',
    lyrics: [
      "Paulo, há um amor que Deus pôs no meu caminho,",
      "e esse amor tem o teu sorriso e o teu carinho.",
      "No evangelho que a vida nos escreveu juntos,",
      "cada capítulo confirma: somos um, não dois — mas juntos.",
      "Agradeço ao Senhor por me ter guiado até ti,",
      "és a oração respondida que sempre pedi.",
      "Paulo, meu marido, meu companheiro de fé,",
      "este amor que Deus abençoou — eterno ele é."
    ]
  }
];
