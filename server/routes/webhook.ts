import express from 'express';
import { getAdminSupabase } from '../services/supabase';
import { logInfo, logWarn, logError } from '../utils/logger';

const router = express.Router();

const CRITICAL_EVENTS = ['hardBounce', 'blocked', 'spam', 'invalid'];

router.post('/webhooks/brevo', async (req, res) => {
  res.status(200).json({ received: true });

  const payload = req.body;
  const event = payload.event;
  const email = payload.email;

  if (!event || !email) {
    logWarn('[Brevo Webhook] Payload sem event ou email', { payload });
    return;
  }

  const messageId = payload['message-id'] || payload.messageId || null;

  logInfo('[Brevo Webhook] Evento recebido', { event, email, messageId });

  const supabase = getAdminSupabase();
  if (!supabase) {
    logError('[Brevo Webhook] Supabase não disponível');
    return;
  }

  const { error: insertError } = await supabase.from('email_events').insert({
    event,
    recipient_email: email,
    message_id: messageId,
    reason: payload.reason || null,
    subject: payload.subject || null,
    raw_payload: payload,
  }).maybeSingle();

  if (insertError) {
    logError('[Brevo Webhook] Erro ao inserir evento', insertError, { event, email });
  }

  if (CRITICAL_EVENTS.includes(event)) {
    logWarn('[Brevo Webhook] Evento crítico', { event, email, reason: payload.reason, messageId });
  }
});

const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';

// Handshake de verificação exigido pela Meta ao configurar o webhook da WhatsApp API
router.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN && typeof challenge === 'string') {
    logInfo('[WhatsApp Webhook] Verificação aceite');
    res.status(200).send(challenge);
  } else {
    logWarn('[WhatsApp Webhook] Verificação falhada');
    res.status(403).send('Verification failed');
  }
});

// Delivery status dos templates (sent/delivered/read/failed)
router.post('/webhooks/whatsapp', async (req, res) => {
  res.status(200).json({ received: true });

  try {
    const wa = await import('../services/whatsappSender');
    await wa.handleDeliveryWebhook(req.body);
  } catch (err) {
    logError('[WhatsApp Webhook] Erro ao processar payload', err instanceof Error ? err : new Error(String(err)));
  }
});

export default router;
