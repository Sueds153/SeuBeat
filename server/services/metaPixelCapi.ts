import crypto from 'node:crypto';
import { getEnv } from '../config/env';
import { logError, logInfo } from '../utils/logger';

const PIXEL_ID = getEnv('META_PIXEL_ID', '1928777041139855');
const ACCESS_TOKEN = getEnv('META_ACCESS_TOKEN', '');
const IS_ENABLED = Boolean(ACCESS_TOKEN);
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

export async function sendPurchaseEvent(params: {
  eventId: string;
  email: string;
  value: number;
  currency?: string;
  contentName?: string;
  eventSourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
}): Promise<boolean> {
  if (!IS_ENABLED) return false;

  const { eventId, email, value, currency = 'AOA', contentName, eventSourceUrl, clientIp, clientUserAgent } = params;

  const userData: Record<string, any> = {
    em: [hashEmail(email)],
  };
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: unixNow(),
        event_id: eventId,
        user_data: userData,
        custom_data: {
          value,
          currency,
          content_name: contentName,
        },
        action_source: 'website',
        event_source_url: eventSourceUrl || getEnv('APP_URL', 'https://seubeat.ao'),
      },
    ],
    access_token: ACCESS_TOKEN,
  };

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      logError('[MetaCAPI] Erro ao enviar evento Purchase', new Error(`HTTP ${res.status}`), { response: body });
      return false;
    }

    const json = await res.json();
    logInfo('[MetaCAPI] Evento Purchase enviado com sucesso', { eventId, value, currency, contentName, eventsReceived: json.events_received });
    return true;
  } catch (err: any) {
    logError('[MetaCAPI] Erro de rede ao enviar evento', err);
    return false;
  }
}
