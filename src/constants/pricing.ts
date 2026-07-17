interface PricingPlan {
  id: 'standard' | 'express' | 'premium';
  name: string;
  price: string;
  originalPrice?: string;
  subtitle: string;
  features: string[];
  badge?: string;
  popular?: boolean;
  bestFor?: string;
  guarantee?: string;
  popularity?: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'standard',
    name: 'SeuBeat Standard',
    price: '7.900 Kz',
    originalPrice: '10.500 Kz',
    subtitle: 'Música personalizada criada no estilo ideal.',
    bestFor: 'orçamento',
    features: [
      'Música completa (3-4 min)',
      'Voz Masculina ou Feminina',
      'Página personalizada online',
      'Download MP3',
      'Entrega em 24h'
    ],
    guarantee: '100% satisfação ou reembolso'
  },
  {
    id: 'express',
    name: 'SeuBeat Express ⚡',
    price: '9.900 Kz',
    originalPrice: '13.500 Kz',
    subtitle: 'Tudo do Standard com entrega mais rápida e mais benefícios.',
    bestFor: 'resultado rápido',
    features: [
      'Tudo do Standard',
      'Voz em Dueto',
      'Entrega imediata',
      '1 revisão de letra incluída'
    ],
    badge: 'Mais Popular',
    popular: true,
    popularity: '83%',
    guarantee: '100% satisfação ou reembolso'
  },
  {
    id: 'premium',
    name: 'Premium Voice 👑',
    price: '14.900 Kz',
    originalPrice: '19.900 Kz',
    subtitle: 'Tudo do Express com a sua voz personalizada.',
    bestFor: 'presente inesquecível',
    features: [
      'Tudo do Express',
      'Voz personalizada do cliente (timbre clonado)'
    ],
    guarantee: '100% satisfação ou reembolso'
  }
];
