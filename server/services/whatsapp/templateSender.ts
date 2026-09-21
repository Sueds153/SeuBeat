import { logInfo, logWarn } from '../../utils/logger';
import { GRAPH_API_VERSION, API_TOKEN, PHONE_NUMBER_ID, isConfigured } from './config';
import { mapWhatsAppApiError } from './errors';
import { TEMPLATE_LANGUAGE } from '../whatsappTemplates';

export async function sendTemplate(
  phone: string,
  templateName: string,
  params: string[]
): Promise<{ ok: true; messageId: string | null } | { ok: false; error: string; code?: number }> {
  if (!isConfigured()) {
    return { ok: false, error: 'WhatsApp API não configurada (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID).' };
  }
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: TEMPLATE_LANGUAGE },
      components: params.length
        ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) }]
        : undefined,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logWarn('[WhatsApp] Falha de rede ao enviar template', { phone, templateName });
    return { ok: false, error: 'Falha de rede ao contactar a WhatsApp API.' };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const mapped = mapWhatsAppApiError(res.status, data);
    logWarn('[WhatsApp] Template rejeitado pela API', { phone, templateName, code: mapped.code, message: mapped.message });
    return { ok: false, error: mapped.message, code: mapped.code };
  }
  const messageId: string | null = data?.messages?.[0]?.id || null;
  logInfo('[WhatsApp] Template enviado', { phone, templateName, messageId });
  return { ok: true, messageId };
}
