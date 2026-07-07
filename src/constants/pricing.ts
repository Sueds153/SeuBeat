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
      'Música completa (3-4 min)',
      'Pré-visualização antes de pagar',
      'Voz Masculina ou Feminina',
      'Página personalizada online',
      'Download MP3',
      'Entrega em 24h'
    ]
  },
  {
    id: 'express',
    name: 'SeuBeat Express ⚡',
    price: '9.900 Kz',
    subtitle: 'Tudo do Standard com entrega mais rápida e mais benefícios.',
    features: [
      'Tudo do Standard',
      'Voz em Dueto',
      'Entrega imediata',
      '1 revisão de letra incluída'
    ],
    badge: 'Mais Popular',
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium Voice 👑',
    price: '14.900 Kz',
    subtitle: 'Tudo do Express com a sua voz personalizada.',
    features: [
      'Tudo do Express',
      'Voz personalizada do cliente (timbre clonado)'
    ]
  }
];
