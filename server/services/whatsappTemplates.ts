import type { AbandonedBucketKey } from './abandonedMessages';

export const TEMPLATE_LANGUAGE = 'pt_PT';

export interface WhatsAppTemplateDef {
  name: string;
  body: (name: string, link: string) => string;
}

// Corpos usados pelos templates aprovados na Meta (placeholder {{1}} = nome, {{2}} = link).
// Mantêm o mesmo tom das mensagens em abandonedMessages.ts — quando registares um template
// novo na Meta Business, o corpo tem de corresponder a estas strings (com {{1}}/{{2}}).
export const WHATSAPP_TEMPLATES: Record<AbandonedBucketKey, WhatsAppTemplateDef> = {
  '30min': {
    name: 'seubeat_abandono_30min',
    body: () => `Olá {{1}}! A tua música está quase pronta 🎵 — só falta escolheres o plano. Continua aqui em 1 minuto: {{2}}`,
  },
  '24h': {
    name: 'seubeat_abandono_24h',
    body: () => `Olá {{1}}, sou eu de novo 😊 A tua música personalizada ainda te espera. Garante já a tua entrega: {{2}}`,
  },
  '48h': {
    name: 'seubeat_abandono_48h',
    body: () => `Olá {{1}}! Não deixes a tua música especial por terminar — está guardada à tua espera. Continua aqui: {{2}}`,
  },
  '72h': {
    name: 'seubeat_abandono_72h',
    body: () => `Última chamada, {{1}}! ⏰ A tua música guardada vai ser fechada em breve. Termina agora: {{2}}`,
  },
};

export function templateForBucket(bucket: AbandonedBucketKey | string | undefined): WhatsAppTemplateDef | null {
  if (!bucket) return null;
  return WHATSAPP_TEMPLATES[bucket as AbandonedBucketKey] || null;
}

export function listTemplates(): Array<{ bucket: string; name: string; language: string }> {
  return (Object.keys(WHATSAPP_TEMPLATES) as AbandonedBucketKey[]).map((k) => ({
    bucket: k,
    name: WHATSAPP_TEMPLATES[k].name,
    language: TEMPLATE_LANGUAGE,
  }));
}

// Buckets com envio por WhatsApp (env WHATSAPP_ENABLED_BUCKETS, default '30min').
// Os restantes continuam só por email.
export function enabledWhatsAppBuckets(): AbandonedBucketKey[] {
  const raw = process.env.WHATSAPP_ENABLED_BUCKETS;
  const enabled = (raw && raw.trim() !== '' ? raw : '30min').split(',').map((s) => s.trim()) as AbandonedBucketKey[];
  return (Object.keys(WHATSAPP_TEMPLATES) as AbandonedBucketKey[]).filter((k) => enabled.includes(k));
}
