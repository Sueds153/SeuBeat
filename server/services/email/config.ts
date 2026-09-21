import { logWarn } from '../../utils/logger';

export function parseEmail(raw: string): { name: string; email: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?$/);
  if (match) {
    return { name: (match[1] || '').trim(), email: match[2] };
  }
  return { name: '', email: raw.trim() };
}

export function getConfig() {
  const rawFrom = process.env.EMAIL_FROM || 'josuemiguelsued@gmail.com';
  const parsed = parseEmail(rawFrom);
  return {
    apiKey: process.env.BREVO_API_KEY || '',
    fromName: process.env.EMAIL_FROM_NAME || parsed.name || 'SeuBeat',
    fromEmail: parsed.email,
  };
}

export function warnIfMissing(cfg: { apiKey: string }): boolean {
  if (!cfg.apiKey) {
    logWarn('BREVO_API_KEY não configurada. Simulando envio de email.');
    return true;
  }
  return false;
}

export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || 'suporte@seubeat.ao';
}
