import type { AbandonedBucketKey } from './abandonedMessages';

export const TEMPLATE_LANGUAGE = 'pt_PT';

// ── Templates de ciclo de vida (entrega + feedback) ──────────────────────
// Estes nomes devem corresponder EXACTAMENTE aos templates aprovados na Meta
// Business Manager → WhatsApp Manager → Message Templates.
// Configuráveis por env vars para flexibilidade sem mudar código.
export const DELIVERY_TEMPLATE_NAME = process.env.WHATSAPP_DELIVERY_TEMPLATE || 'seubeat_entrega_v1';
export const FEEDBACK_TEMPLATE_NAME = process.env.WHATSAPP_FEEDBACK_TEMPLATE || 'seubeat_feedback_v1';
/** Template enviado ao cliente quando o admin aprova o pagamento Standard (entrega em 24h). */
export const PAYMENT_APPROVED_TEMPLATE_NAME = process.env.WHATSAPP_PAYMENT_APPROVED_TEMPLATE || 'seubeat_pagamento_aprovado_v2';

export interface WhatsAppTemplateDef {
  name: string;
  body: (name: string, link: string) => string;
}

// Corpos usados pelos templates aprovados na Meta (placeholder {{1}} = nome, {{2}} = link).
// Nota Meta: as variáveis não podem estar no início nem no fim do texto — por isso cada
// corpo tem texto estático após o {{2}}. Sem acentos/emojis (ASCII) para evitar rejeições
// INVALID_FORMAT e garantir consistência com o texto criado na API (v6).
export const WHATSAPP_TEMPLATES: Record<AbandonedBucketKey, WhatsAppTemplateDef> = {
  '30min': {
    name: 'seubeat_abandono_30min_v6',
    body: () => `Ola {{1}}! A tua musica esta quase pronta. So falta escolheres o plano. Continua aqui em 1 minuto: {{2}}. Esta tudo a tua espera!`,
  },
  '24h': {
    name: 'seubeat_abandono_24h_v6',
    body: () => `Ola {{1}}, sou eu de novo. A tua musica personalizada ainda te espera. Garante ja a tua entrega: {{2}}. Nao demores!`,
  },
  '48h': {
    name: 'seubeat_abandono_48h_v6',
    body: () => `Ola {{1}}! Nao deixes a tua musica especial por terminar. Esta guardada a tua espera. Continua aqui: {{2}}. Ainda vais a tempo!`,
  },
  '72h': {
    name: 'seubeat_abandono_72h_v6',
    body: () => `Ultima chamada, {{1}}! A tua musica guardada vai ser fechada em breve. Termina agora: {{2}}. Vamos la!`,
  },
};

export function templateForBucket(bucket: AbandonedBucketKey | string | undefined): WhatsAppTemplateDef | null {
  if (!bucket) return null;
  return WHATSAPP_TEMPLATES[bucket as AbandonedBucketKey] || null;
}

export function listTemplates(): Array<{ bucket: string; name: string; language: string }> {
  const abandoned: Array<{ bucket: string; name: string; language: string }> = (Object.keys(WHATSAPP_TEMPLATES) as AbandonedBucketKey[]).map((k) => ({
    bucket: k,
    name: WHATSAPP_TEMPLATES[k].name,
    language: TEMPLATE_LANGUAGE,
  }));
  // Incluir templates de ciclo de vida (entrega + feedback + aprovação) no painel admin
  abandoned.push({ bucket: 'delivery', name: DELIVERY_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  abandoned.push({ bucket: 'feedback', name: FEEDBACK_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  abandoned.push({ bucket: 'payment_approved', name: PAYMENT_APPROVED_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  return abandoned;
}

// Buckets com envio por WhatsApp (env WHATSAPP_ENABLED_BUCKETS, default '30min').
// Os restantes continuam só por email.
export function enabledWhatsAppBuckets(): AbandonedBucketKey[] {
  const raw = process.env.WHATSAPP_ENABLED_BUCKETS;
  const enabled = (raw && raw.trim() !== '' ? raw : '30min').split(',').map((s) => s.trim()) as AbandonedBucketKey[];
  return (Object.keys(WHATSAPP_TEMPLATES) as AbandonedBucketKey[]).filter((k) => enabled.includes(k));
}
