import { logWarn } from '../../utils/logger';

export const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';
export const API_TOKEN = process.env.WHATSAPP_API_TOKEN || '';
export const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
export const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE || '244922058136';

export const DAILY_CAP = Number(process.env.WHATSAPP_DAILY_CAP || 30);
export const START_HOUR = Number(process.env.WHATSAPP_START_HOUR || 9);
export const END_HOUR = Number(process.env.WHATSAPP_END_HOUR || 20);
export const MIN_SEND_DELAY_MS = Number(process.env.WHATSAPP_MIN_SEND_DELAY_MS || 3000);
export const MAX_SEND_DELAY_MS = Number(process.env.WHATSAPP_MAX_SEND_DELAY_MS || 8000);

export function isConfigured(): boolean {
  return Boolean(API_TOKEN && PHONE_NUMBER_ID);
}

export async function getWhatsAppAppUrl(phone: string, text = '') {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function getLinkStatus() {
  return { linked: isConfigured(), phone: isConfigured() ? WHATSAPP_PHONE : null };
}
