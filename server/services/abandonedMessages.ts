export type AbandonedBucketKey = '30min' | '24h' | '48h' | '72h';

export interface AbandonedBucketDef {
  key: AbandonedBucketKey;
  label: string;
  minElapsedMs: number;
}

// Limiares espelhando o abandonedRecoveryScheduler (30min / 24h / 48h / 72h)
const BUCKET_DEFS: AbandonedBucketDef[] = [
  { key: '30min', label: 'Pronto há 30min', minElapsedMs: 30 * 60 * 1000 },
  { key: '24h', label: 'Pronto há 24h', minElapsedMs: 24 * 60 * 60 * 1000 },
  { key: '48h', label: 'Pronto há 48h', minElapsedMs: 48 * 60 * 60 * 1000 },
  { key: '72h', label: 'Pronto há 72h+', minElapsedMs: 72 * 60 * 60 * 1000 },
];

// Ordem de prioridade de envio: 30min (fresco) → 72h (última chamada) → 24h → 48h
export const ABANDONED_BUCKET_ORDER: AbandonedBucketKey[] = ['30min', '72h', '24h', '48h'];

// Mensagens persuasivas por contexto — genéricas (sem letra/dados íntimos)
const MESSAGE_TEMPLATES: Record<AbandonedBucketKey, (name: string, link: string) => string> = {
  '30min': (name, link) =>
    `Olá ${name}! A tua música está quase pronta 🎵 — só falta escolheres o plano. Continua aqui em 1 minuto: ${link}`,
  '24h': (name, link) =>
    `Olá ${name}, sou eu de novo 😊 A tua música personalizada ainda te espera. Garante já a tua entrega: ${link}`,
  '48h': (name, link) =>
    `Olá ${name}! Não deixes a tua música especial por terminar — está guardada à tua espera. Continua aqui: ${link}`,
  '72h': (name, link) =>
    `Última chamada, ${name}! ⏰ A tua música guardada vai ser fechada em breve. Termina agora: ${link}`,
};

/** Bucket a que um pedido pertence dado o tempo decorrido desde a criação (ms). */
export function bucketForElapsed(elapsedMs: number): AbandonedBucketKey | null {
  for (let i = BUCKET_DEFS.length - 1; i >= 0; i--) {
    if (elapsedMs >= BUCKET_DEFS[i].minElapsedMs) return BUCKET_DEFS[i].key;
  }
  return null;
}

export function bucketLabel(key: AbandonedBucketKey): string {
  const def = BUCKET_DEFS.find((b) => b.key === key);
  return def ? def.label : key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros por tempo (presets) — aba Abandonados
// ─────────────────────────────────────────────────────────────────────────────

export type AbandonedTimeRange = 'lt1h' | '1-6h' | '6-24h' | '24-48h' | '48-72h' | 'gt72h';

export interface AbandonedTimeRangeDef {
  key: AbandonedTimeRange;
  label: string;
  minMs: number;
  maxMs: number | null; // null = sem limite superior
}

export const ABANDONED_TIME_RANGES: AbandonedTimeRangeDef[] = [
  { key: 'lt1h', label: '<1h', minMs: 0, maxMs: 60 * 60 * 1000 },
  { key: '1-6h', label: '1–6h', minMs: 60 * 60 * 1000, maxMs: 6 * 60 * 60 * 1000 },
  { key: '6-24h', label: '6–24h', minMs: 6 * 60 * 60 * 1000, maxMs: 24 * 60 * 60 * 1000 },
  { key: '24-48h', label: '24–48h', minMs: 24 * 60 * 60 * 1000, maxMs: 48 * 60 * 60 * 1000 },
  { key: '48-72h', label: '48–72h', minMs: 48 * 60 * 60 * 1000, maxMs: 72 * 60 * 60 * 1000 },
  { key: 'gt72h', label: '>72h', minMs: 72 * 60 * 60 * 1000, maxMs: null },
];

export function isAbandonedTimeRange(key: string): key is AbandonedTimeRange {
  return ABANDONED_TIME_RANGES.some((r) => r.key === key);
}

/** Devolve true se o tempo decorrido (ms) cai na faixa indicada. */
export function elapsedInRange(elapsedMs: number, range: AbandonedTimeRange): boolean {
  const def = ABANDONED_TIME_RANGES.find((r) => r.key === range);
  if (!def) return false;
  if (elapsedMs < def.minMs) return false;
  if (def.maxMs !== null && elapsedMs >= def.maxMs) return false;
  return true;
}

/** Monta a mensagem persuasiva de um bucket para um cliente. */
export function buildAbandonedMessage(key: AbandonedBucketKey, name: string, link: string): string {
  const tpl = MESSAGE_TEMPLATES[key];
  if (!tpl) throw new Error(`Bucket desconhecido: ${key}`);
  return tpl((name || '').trim().split(' ')[0] || 'amigo(a)', link);
}

/** Normaliza um telefone para E.164 (dígitos, prefixo 244 se for 9 dígitos local). */
export function normalizePhoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) return `244${digits}`;
  if (digits.length === 12 && digits.startsWith('244')) return digits;
  return null;
}
