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
  | 'Romantic Pop';

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
      'Entrega digital em 5 dias',
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
      'Entrega prioritária em 24-48 horas',
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
      'Entrega express em 24 horas',
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
  audioUrl: string; // visual mock
}

export const DEMO_SONGS: DemoSong[] = [
  {
    id: 'kizomba-love',
    title: 'Minha Rainha',
    style: 'Kizomba',
    occasion: 'Casamento',
    recipient: 'Esposa (Cláudia)',
    duration: '3:15',
    audioUrl: 'kizomba',
    lyrics: [
      "Desde o dia em que te vi na Ilha de Luanda,",
      "Sabia que o meu peito tinha nova comandante.",
      "O teu sorriso brilha mais que o sol do deserto,",
      "Cláudia, o meu mundo é perfeito se te tenho por perto.",
      "No ritmo lento deste tarraxar doce,",
      "Parece que o tempo parou, que o amanhã já fosse.",
      "Prometo amar-te a cada bater do meu coração,",
      "És a minha kizomba, a minha mais linda canção."
    ]
  },
  {
    id: 'semba-bday',
    title: 'Sorriso de Mãe',
    style: 'Semba',
    occasion: 'Aniversário',
    recipient: 'Mãe (Dona Maria)',
    duration: '2:45',
    audioUrl: 'semba',
    lyrics: [
      "Mãe Maria, a senhora que tudo me deu,",
      "O maior pilar e orgulho deste peito meu.",
      "Na cozinha o cheiro a mufete a espalhar,",
      "A sua gargalhada alta sempre a nos confortar.",
      "Hoje o semba rebate vivo no nosso quintal,",
      "Para celebrar a força da rainha principal.",
      "Parabéns, minha mãe, pelo seu lindo dia,",
      "Angola inteira canta em sua harmonia!"
    ]
  },
  {
    id: 'acoustic-heart',
    title: 'Meu Porto Seguro',
    style: 'Romantic Pop',
    occasion: 'Dedicatória Especial',
    recipient: 'Namorado (Yuri)',
    duration: '3:05',
    audioUrl: 'acoustic',
    lyrics: [
      "O vento que sopra suave lá fora,",
      "Recorda o abraço que me deste há uma hora.",
      "Yuri, teu olhar é farol na minha escuridão,",
      "Acalmas a tempestade com um toque de mão.",
      "Sei que às vezes o percurso tem pedras no chão,",
      "Mas contigo a caminhar, toda rampa é canção.",
      "Este som é para ti, meu abrigo, meu bem,",
      "Como este nosso amor, sei que não há ninguém."
    ]
  }
];
