import { logInfo } from '../../utils/logger';
import { normalizePhoneToE164 } from '../abandonedMessages';
import { DELIVERY_TEMPLATE_NAME, FEEDBACK_TEMPLATE_NAME, PAYMENT_APPROVED_TEMPLATE_NAME, PAYMENT_REJECTED_TEMPLATE_NAME, VIDEO_UPSELL_TEMPLATE_NAME } from '../whatsappTemplates';
import { isConfigured } from './config';
import { insertSendLog, markContacted } from './sendLog';
import { sendTemplate } from './templateSender';

export async function sendDeliveryWhatsApp(client: {
  requestId: string;
  phone?: string | null;
  recipientName?: string | null;
  songUrl: string;
}): Promise<'sent' | 'skipped' | 'failed' | 'unconfigured'> {
  if (!isConfigured()) return 'unconfigured';
  const phone = normalizePhoneToE164(client.phone || '');
  if (!phone) return 'skipped';

  const templateName = DELIVERY_TEMPLATE_NAME;
  const params = [client.recipientName || 'Destinatário', client.songUrl];
  const res = await sendTemplate(phone, templateName, params);

  if (res.ok) {
    await markContacted(client.requestId);
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: 'sent',
      bucket: 'delivery',
      messageId: res.messageId || undefined,
      templateName,
    });
    logInfo('[WhatsApp] Notificação de entrega enviada', { phone, requestId: client.requestId });
    return 'sent';
  }

  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', bucket: 'delivery', error: res.error });
  return 'failed';
}

export async function sendPaymentApprovedWhatsApp(client: {
  requestId: string;
  phone?: string | null;
  recipientName?: string | null;
}): Promise<'sent' | 'skipped' | 'failed' | 'unconfigured'> {
  if (!isConfigured()) return 'unconfigured';
  const phone = normalizePhoneToE164(client.phone || '');
  if (!phone) return 'skipped';

  const templateName = PAYMENT_APPROVED_TEMPLATE_NAME;
  const params = [client.recipientName || 'Destinatário', '24 horas'];
  const res = await sendTemplate(phone, templateName, params);

  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: 'sent',
      bucket: 'payment_approved',
      messageId: res.messageId || undefined,
      templateName,
    });
    logInfo('[WhatsApp] Notificação de pagamento aprovado enviada (Standard)', { phone, requestId: client.requestId });
    return 'sent';
  }

  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', bucket: 'payment_approved', error: res.error });
  return 'failed';
}

export async function sendPaymentRejectedWhatsApp(client: {
  requestId: string;
  phone?: string | null;
  recipientName?: string | null;
  reason?: string | null;
}): Promise<'sent' | 'skipped' | 'failed' | 'unconfigured'> {
  if (!isConfigured()) return 'unconfigured';
  const phone = normalizePhoneToE164(client.phone || '');
  if (!phone) return 'skipped';

  const templateName = PAYMENT_REJECTED_TEMPLATE_NAME;
  const params = [client.recipientName || 'Destinatário', client.reason || 'reprovado'];
  const res = await sendTemplate(phone, templateName, params);

  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: 'sent',
      bucket: 'payment_rejected',
      messageId: res.messageId || undefined,
      templateName,
    });
    logInfo('[WhatsApp] Notificação de pagamento rejeitado enviada', { phone, requestId: client.requestId });
    return 'sent';
  }

  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', bucket: 'payment_rejected', error: res.error });
  return 'failed';
}

export async function sendVideoUpsellWhatsApp(client: {
  requestId: string;
  phone?: string | null;
  recipientName?: string | null;
  songTitle?: string | null;
}): Promise<'sent' | 'skipped' | 'failed' | 'unconfigured'> {
  if (!isConfigured()) return 'unconfigured';
  const phone = normalizePhoneToE164(client.phone || '');
  if (!phone) return 'skipped';

  const templateName = VIDEO_UPSELL_TEMPLATE_NAME;
  const res = await sendTemplate(phone, templateName, []);

  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: 'sent',
      bucket: 'video_upsell',
      messageId: res.messageId || undefined,
      templateName,
    });
    logInfo('[WhatsApp] Offer de videoclipe enviada', { phone, requestId: client.requestId });
    return 'sent';
  }

  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', bucket: 'video_upsell', error: res.error });
  return 'failed';
}

export interface FeedbackRequestClient {
  requestId: string;
  phone?: string | null;
  recipientName?: string | null;
  songUrl: string;
  email?: string;
}

export async function sendFeedbackRequestWhatsApp(client: FeedbackRequestClient): Promise<'sent' | 'skipped' | 'failed' | 'unconfigured'> {
  if (!isConfigured()) return 'unconfigured';
  const rawPhone = normalizePhoneToE164(client.phone || '');
  if (!rawPhone) return 'skipped';
  const phone: string = rawPhone;

  const templateName = FEEDBACK_TEMPLATE_NAME;
  const appUrl = process.env.APP_URL || 'https://seubeat.onrender.com';
  const params = [
    client.recipientName || 'Destinatário',
    `${appUrl}/feedback?requestId=${client.requestId}&email=${encodeURIComponent(client.email || '')}`,
  ];

  const res = await sendTemplate(phone, templateName, params);

  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: 'sent',
      bucket: 'feedback',
      messageId: res.messageId ?? undefined,
      templateName: 'feedback_request',
    });
    logInfo('[WhatsApp] Pedido de feedback em vídeo enviado', { phone, requestId: client.requestId });
    return 'sent';
  }

  await insertSendLog({ requestId: client.requestId, phone, status: 'failed', bucket: 'feedback', error: res.error });
  return 'failed';
}
