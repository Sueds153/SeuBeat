import { useEffect } from 'react';

/** SEO meta por rota — title, description e canonical únicos por página. */
const SEO_ROUTES: Record<string, { title: string; description: string; path: string; noindex?: boolean }> = {
  landing: {
    title: 'Canções Personalizadas com IA — Dedicatórias Musicais | SeuBeat',
    description: 'Crie uma canção personalizada com IA para quem ama: dedicatórias em kizomba, semba e pop com as vossas memórias reais. Presente único para aniversários, dia dos namorados e mais. Entrega em 24h em Angola.',
    path: '/',
  },
  wizard: {
    title: 'Criar a Minha Canção Personalizada | SeuBeat',
    description: 'Começa a criar a tua canção personalizada com IA em minutos. Responde 5 perguntas sobre a vossa história e recebe uma letra única antes de pagares. Kizomba, semba, pop e mais.',
    path: '/wizard',
    noindex: true,
  },
  song: {
    title: 'A Tua Canção Personalizada | SeuBeat',
    description: 'Ouve e partilha a tua canção personalizada criada com IA. Página de dedicatória com música completa, letra e carta.',
    path: '/song',
  },
  terms: {
    title: 'Termos de Serviço | SeuBeat',
    description: 'Termos de serviço do SeuBeat — canções personalizadas com IA em Angola. Direitos, garantias, pagamento e privacidade.',
    path: '/terms',
  },
  privacy: {
    title: 'Política de Privacidade | SeuBeat',
    description: 'Política de privacidade do SeuBeat. Como tratamos os teus dados, voz clonada e pagamentos na criação de canções personalizadas.',
    path: '/privacy',
  },
  recover: {
    title: 'Retomar o Meu Pedido | SeuBeat',
    description: 'Retoma a tua canção personalizada por onde paraste. Introduz o email do pedido para continuar.',
    path: '/retomar',
    noindex: true,
  },
  voice: {
    title: 'Gravar a Minha Voz | SeuBeat Premium',
    description: 'Grava a tua amostra de voz para clonagem Premium. A tua canção será cantada com o teu próprio timbre.',
    path: '/voice',
    noindex: true,
  },
  'video-upsell': {
    title: 'Vídeo da Tua Canção | SeuBeat',
    description: 'Transforma a tua canção personalizada num vídeo memorável para partilhar com quem mais amas.',
    path: '/video-upsell',
    noindex: true,
  },
};

/** Structured Data (JSON-LD) por rota — injectado dinamicamente no <head> */
const JSONLD_ROUTES: Record<string, object[]> = {
  wizard: [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Criar Canção Personalizada',
      description: 'Assistente de 5 passos para criar a tua canção personalizada com IA. Escolhe estilo, voz, conta a tua história e recebe a letra antes de pagares.',
      url: 'https://seubeat.vercel.app/wizard',
      inLanguage: 'pt-AO',
      isPartOf: { '@id': 'https://seubeat.vercel.app/#website' },
      mainEntity: {
        '@type': 'WebApplication',
        name: 'SeuBeat Wizard',
        applicationCategory: 'EntertainmentApplication',
        operatingSystem: 'Web',
        featureList: [
          'Seleção de ocasião e relacionamento',
          'Escolha de estilo musical (Kizomba, Semba, Pop, Gospel)',
          'Escolha de voz (Masculina, Feminina, Dueto, Clonada)',
          'Editor de história com sugestões inteligentes',
          'Pré-visualização da letra gerada por IA',
          'Pagamento por Multicaixa Referência ou Express'
        ]
      }
    }
  ],
  terms: [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Termos de Serviço',
      description: 'Termos e condições de uso do SeuBeat — canções personalizadas com IA.',
      url: 'https://seubeat.vercel.app/terms',
      inLanguage: 'pt-AO',
      isPartOf: { '@id': 'https://seubeat.vercel.app/#website' }
    }
  ],
  privacy: [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Política de Privacidade',
      description: 'Como o SeuBeat recolhe, usa e protege os teus dados pessoais e de voz.',
      url: 'https://seubeat.vercel.app/privacy',
      inLanguage: 'pt-AO',
      isPartOf: { '@id': 'https://seubeat.vercel.app/#website' }
    }
  ],
  song: [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Canção Personalizada',
      description: 'Página de dedicatória com música completa, letra, carta personalizada e download MP3.',
      url: 'https://seubeat.vercel.app/song',
      inLanguage: 'pt-AO',
      isPartOf: { '@id': 'https://seubeat.vercel.app/#website' }
    }
  ]
};

function upsertMeta(selector: string, keyAttr: string, key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(keyAttr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Injeta/atualiza JSON-LD scripts no <head> com data-seo-route attribute */
function upsertJsonLd(routeKey: string): void {
  const schemas = JSONLD_ROUTES[routeKey];
  if (!schemas || schemas.length === 0) return;

  // Remove existing SEO-injected JSON-LD scripts
  document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"][data-seo-route]').forEach(el => el.remove());

  // Inject new ones
  schemas.forEach((schema, i) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-route', routeKey);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

const BASE_URL = 'https://seubeat.vercel.app';

export function useSeoMeta(view: string, urlPath: string): void {
  useEffect(() => {
    const conf = SEO_ROUTES[view] || SEO_ROUTES.landing;
    const canonicalPath = conf.path.endsWith('/')
      ? conf.path
      : conf.path;

    document.title = conf.title;
    upsertMeta('meta[name="description"]', 'name', 'description', conf.description);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', conf.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', conf.description);

    // Canonical: para rotas dinâmicas usa o path real (ex.: /song/abc)
    const canonicalPathReal =
      view === 'song' && urlPath ? urlPath : canonicalPath;
    upsertCanonical(`${BASE_URL}${canonicalPathReal}`);

    // Páginas dinâmicas não devem ser indexadas (conteúdo único por cliente)
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) {
      robots.setAttribute('content', conf.noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:150, max-image-preview:large');
    }

    // Inject structured data for this route
    upsertJsonLd(view);
  }, [view, urlPath]);
}
