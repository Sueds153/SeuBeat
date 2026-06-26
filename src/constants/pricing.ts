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
