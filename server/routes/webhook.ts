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

export default router;
