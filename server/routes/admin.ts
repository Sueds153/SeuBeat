import express from 'express';
import { getAdminSupabase } from '../services/supabase';
import { 
  createSignedStorageUrl, 
  deleteStorageFile, 
  deleteStorageFiles,
  uploadFileToStorage,
  getPublicStorageUrl 
} from '../services/storage';
import { adminAuth, adminLogin } from '../middleware/auth';
import { 
  requestProgressMap, 
  resumeSunoTaskWorkflow, 
  runBackgroundSunoWorkflow, 
  processSunoVoice 
} from '../services/workflow';
import { sendPersonalizedEmail, sendPaymentRejectionEmail, sendConfirmationEmail, sendVideoUpsellOfferEmail } from '../services/email';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { logInfo, logError, logWarn } from '../utils/logger';
import { normalizeLyricsArray, querySunoTask } from '../services/suno';
import { persistGeneratedSunoAudio } from '../services/workflow';
import { publicErrorMessage, getAppUrl, logRouteError, kzToUsd } from '../utils/helpers';
import { logAdminAction } from '../utils/audit';
import { sendPurchaseEvent, generateServerEventId } from '../services/metaPixelCapi';
import { adminLimiter, whatsappBulkLimiter } from '../middleware/rateLimiter';
import {
  bucketForElapsed, bucketLabel, buildAbandonedMessage,
  normalizePhoneToE164, ABANDONED_BUCKET_ORDER,
  isAbandonedTimeRange, elapsedInRange,
} from '../services/abandonedMessages';
import { sendDeliveryWhatsApp, sendFeedbackRequestWhatsApp, sendPaymentApprovedWhatsApp, sendVideoUpsellWhatsApp } from '../services/whatsappSender';
import type { BulkClient } from '../services/whatsappSender';
import { templateForBucket, enabledWhatsAppBuckets } from '../services/whatsappTemplates';
import { getMetaAdsSpend } from '../services/metaAds';
import { getDeepSeekApiKey } from '../services/deepseekConfig';
import { logAnalyticsEvent } from '../services/analytics';

const router = express.Router();

// Login endpoint — devolve JWT
router.post('/login', adminLimiter, (req, res) => adminLogin(req, res));

function safeMessage(err: unknown): string {
  return publicErrorMessage(err);
}

function firstRelated<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

function mapRelated<T>(value: T | T[] | null | undefined, mapper: (item: T) => T): T | T[] | null | undefined {
  if (Array.isArray(value)) return value.map(mapper);
  if (value) return mapper(value);
  return value;
}

function parseMoneyAmount(value: unknown): number {
  return parseInt(String(value ?? '0').replace(/\D/g, ''), 10) || 0;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function checkDeepSeek(now: Date) {
  const apiKey = getDeepSeekApiKey();
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  if (!apiKey) return { ok: false, error: 'DEEPSEEK_API_KEY em falta no ambiente do servidor (ou alias DEEPSEEK_SECRET_KEY)', model, lastCheck: now.toISOString() };
  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, model, lastCheck: now.toISOString() };

    const balances = Array.isArray(data?.balance_infos) ? data.balance_infos : [];
    const usd = balances.find((b: any) => String(b.currency || '').toUpperCase() === 'USD') || balances[0];
    const totalBalance = Number(usd?.total_balance ?? usd?.granted_balance ?? 0);
    const toppedUpBalance = Number(usd?.topped_up_balance ?? 0);
    return {
      ok: true,
      model,
      currency: usd?.currency || 'USD',
      total_balance: totalBalance,
      topped_up_balance: toppedUpBalance,
      low: totalBalance < 1,
      estimatedLyricsRemaining: Math.floor(totalBalance / (Number(process.env.DEEPSEEK_COST_PER_GENERATION_USD) || 0.0005)),
      lastCheck: now.toISOString(),
    };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), model, lastCheck: now.toISOString() };
  }
}

function extractStoragePath(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;

  // Supabase Storage URL patterns
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`
  ];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
    }
  }

  // Cloudflare R2 public URL: https://pub-xxx.r2.dev/{bucket}/{filename}
  const r2Match = url.match(/r2\.dev\/([^?]+)/);
  if (r2Match) {
    const fullPath = decodeURIComponent(r2Match[1]);
    const bucketPrefix = `${bucket}/`;
    return fullPath.startsWith(bucketPrefix) ? fullPath.slice(bucketPrefix.length) : fullPath;
  }

  // Bare storage path (e.g. "voices/123_sample.wav" — no URL prefix)
  if (!url.startsWith('http') && !url.startsWith('//') && url.includes('/')) {
    return url.split('?')[0];
  }

  return null;
}

function safeAudioFilename(title: string | null | undefined): string {
  const base = String(title || 'seubeat-musica')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `${base || 'seubeat-musica'}.mp3`;
}

// A. Admin dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const [usersRes, requestsRes, paymentsRes, songsRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact' }),
      supabase.from('song_requests').select('id, status', { count: 'exact' }),
      supabase.from('payments').select('id, status, amount, plan, created_at'),
      supabase.from('songs').select('id, audio_url, mureka_status, created_at')
    ]);

    const payments = paymentsRes.data || [];
    const pendingPayments = payments.filter(p => p.status === 'pending_verification').length;
    const approvedPayments = payments.filter(p => p.status === 'approved').length;
    const totalRevenue = payments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + parseMoneyAmount(p.amount), 0);

    const songs = songsRes.data || [];
    const musicGenerated = songs.filter(s => s.audio_url).length;

    const requests = requestsRes.data || [];
    const requestsByStatus: Record<string, number> = {};
    requests.forEach(r => {
      requestsByStatus[r.status] = (requestsByStatus[r.status] || 0) + 1;
    });

    res.json({
      totalUsers: usersRes.count || 0,
      totalRequests: requestsRes.count || 0,
      pendingPayments,
      approvedPayments,
      totalRevenue: `${totalRevenue.toLocaleString('pt')} Kz`,
      musicGenerated,
      requestsByStatus
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// A2. Funnel metrics
router.get('/funnel', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const now = new Date();
    const today = isoDateOnly(now);
    const weekAgo = isoDateOnly(new Date(now.getTime() - 7 * 86400000));
    const monthAgo = isoDateOnly(new Date(now.getTime() - 30 * 86400000));

    const [requestsRes, paymentsRes, deliveredRes, revenueByDayRes] = await Promise.all([
      supabase.from('song_requests').select('id, status, created_at'),
      supabase.from('payments').select('id, status, amount, plan, created_at'),
      supabase.from('song_requests').select('id', { count: 'exact' }).eq('status', 'delivered'),
      supabase.from('payments')
        .select('amount, created_at')
        .eq('status', 'approved')
        .gte('created_at', monthAgo)
        .order('created_at', { ascending: true }),
    ]);

    const requests = requestsRes.data || [];
    const payments = paymentsRes.data || [];
    const approvedPayments = payments.filter(p => p.status === 'approved');
    const lyricsGenerated = requests.filter(r => !['lyrics_generating'].includes(r.status)).length;
    const paymentSubmitted = payments.length;
    const paymentApproved = approvedPayments.length;
    const conversionRate = lyricsGenerated > 0 ? ((paymentApproved / lyricsGenerated) * 100).toFixed(1) : '0';

    const totalRevenue = approvedPayments.reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const revenueToday = approvedPayments
      .filter(p => p.created_at?.startsWith(today))
      .reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const revenueWeek = approvedPayments
      .filter(p => (p.created_at || '') >= weekAgo)
      .reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const revenueMonth = approvedPayments
      .filter(p => (p.created_at || '') >= monthAgo)
      .reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const aov = paymentApproved > 0 ? Math.round(totalRevenue / paymentApproved) : 0;

    // Revenue by day for chart (last 30 days)
    const revenueByDay: Record<string, number> = {};
    for (const p of revenueByDayRes.data || []) {
      const day = (p.created_at || '').slice(0, 10);
      if (day) revenueByDay[day] = (revenueByDay[day] || 0) + parseMoneyAmount(p.amount);
    }
    const revenueChart = Object.entries(revenueByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, amount]) => ({ day, amount }));

    res.json({
      funnel: {
        lyricsGenerated,
        paymentSubmitted,
        paymentApproved,
        delivered: deliveredRes.count || 0,
        conversionRate: `${conversionRate}%`,
      },
      revenue: {
        total: totalRevenue,
        today: revenueToday,
        week: revenueWeek,
        month: revenueMonth,
        aov,
        chart: revenueChart,
      },
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});


// B. Admin list payments
router.get('/payments', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('payments')
      .select('*, song_requests(id, recipient_name, occasion, music_style, status, users(name, email, phone))')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, payments: data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// B2. Get payment proof signed URL (bucket é privado)
router.get('/payment/:id/proof-url', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: payment, error } = await supabase
      .from('payments')
      .select('proof_path, proof_url, proof_filename, proof_mime_type')
      .eq('id', id)
      .single();

    if (error || !payment) return res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });

    // Normaliza o caminho: usa proof_path se existir, senão usa proof_url sem o prefixo "storage:"
    let path = payment.proof_path;
    if (!path && payment.proof_url) {
      path = payment.proof_url.replace(/^storage:/, '');
    }

    if (!path) return res.status(404).json({ success: false, error: 'Comprovativo não encontrado.' });

    // Gera URL assinada. O provider (R2 ou Supabase) é detectado automaticamente
    // pelo createSignedStorageUrl com base no STORAGE_PROVIDER do .env.
    // Como o bucket payment-proofs existe no Supabase Storage, a URL será gerada
    // usando o provider adequado (R2 fallback ou Supabase direto).
    const signedUrl = await createSignedStorageUrl('payment-proofs', path, 3600);

    if (!signedUrl) return res.status(500).json({ success: false, error: 'Não foi possível gerar URL do comprovativo.' });

    res.json({
      url: signedUrl,
      filename: payment.proof_filename || null,
      mimeType: payment.proof_mime_type || null,
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// C. Admin approve payment
router.post('/payment/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .update({ 
        status: 'approved', 
        notes: notes || null, 
        approved_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('status', 'pending_verification')
      .select('*, song_requests(*, songs(*), users(*))')
      .single();

    if (paymentError || !payment) {
      return res.status(409).json({ success: false, error: 'Pagamento não encontrado ou já processado.' });
    }

    const songRequest = payment.song_requests as any;
    const requestId = payment.request_id;
    const songData = firstRelated(songRequest?.songs);
    const userEmail = payment.user_email || songRequest?.users?.email;
    const letterText = songData?.letter_text || 'Preparámos uma dedicatória especial para si.';

    if (!requestId || !songData) {
      return res.status(400).json({ success: false, error: 'Dados da música em falta.' });
    }

    const numericAmount = parseInt(String(payment.amount || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const planName = (payment.plan || songRequest?.plan || 'standard') as string;

    logAdminAction({ action: 'approve', entityType: 'payment', entityId: id, notes: notes || undefined });
    logAnalyticsEvent('payment_approved', { requestId: requestId || undefined, metadata: { plan: planName, amount: numericAmount } }).catch(() => {});

    const userPhone = songRequest?.phone || null;
    const userFullName = songRequest?.users?.name || '';
    const lastName = userFullName.split(' ').filter(Boolean).slice(-1)[0] || undefined;
    const firePurchaseEvent = () => {
      if ((payment as { meta_purchase_sent_at?: string | null }).meta_purchase_sent_at) {
        logInfo('[Admin] Meta CAPI Purchase já enviado para este pagamento, a ignorar', { paymentId: id });
        return;
      }
      sendPurchaseEvent({
        eventId: generateServerEventId(id, 'Purchase'),
        email: payment.user_email || userEmail || '',
        phone: userPhone || undefined,
        value: kzToUsd(numericAmount),
        currency: 'USD',
        contentName: planName,
        eventSourceUrl: (req.headers.referer as string) || undefined,
        clientIp: req.ip || req.socket.remoteAddress || undefined,
        clientUserAgent: req.headers['user-agent'],
        externalId: payment.user_email || userEmail || undefined,
        ln: lastName,
      })
        .then(ok => {
          if (ok) {
            return supabase
              .from('payments')
              .update({ meta_purchase_sent_at: new Date().toISOString() })
              .eq('id', id)
              .eq('status', 'approved');
          }
          return undefined;
        })
        .catch(err =>
          logError('[Admin] Meta CAPI Purchase event failed after retries', err, { paymentId: id })
        );
    };

    const hasGeneratedAudio = !!(songData.full_song_url || songData.audio_url);
    const hasVoiceSample = !!songRequest.voice_sample_url;
    const isStandard = planName === 'standard';

    // Se já tem áudio E não tem voz clonada pendente, entrega diretamente
    if (hasGeneratedAudio && !hasVoiceSample) {
      const fullAudioUrl = songData.full_song_url || songData.audio_url;

      if (isStandard) {
        // Standard: agendar entrega para 24h após aprovação
        const approvedAt = payment.approved_at || payment.created_at || new Date().toISOString();
        const deliverAt = new Date(new Date(approvedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('song_requests')
          .update({
            status: 'approved',
            deliver_at: deliverAt,
            final_mixed_audio_url: fullAudioUrl || songRequest.final_mixed_audio_url || null
          })
          .eq('id', requestId);
        if (userEmail) {
          logInfo('[Admin] Enviando email de confirmacao (standard)', { requestId, userEmail });
          sendConfirmationEmail(userEmail, songRequest.recipient_name, requestId, 'standard_approved').catch(err =>
            logError('[Admin] Falha ao enviar email de confirmacao (standard)', err, { requestId, userEmail })
          );
        }
        // WhatsApp de aprovação Standard: notifica que a música está a ser preparada e chega em 24h
        const standardPhone = songRequest.phone || songRequest.users?.phone || null;
        if (standardPhone) {
          sendPaymentApprovedWhatsApp({
            requestId,
            phone: standardPhone,
            recipientName: songRequest.recipient_name,
          }).catch(err => logError('[Admin] Falha ao enviar WhatsApp de aprovacao (standard)', err, { requestId }));
        }
        firePurchaseEvent();
        // Video upsell: enviar offer de videoclipe (Standard)
        sendVideoUpsellOffer(requestId, songRequest, req);
        return res.json({ success: true, message: 'Pagamento aprovado. Música será entregue em 24h por e-mail.', isStandard: true });
      }

      // Express/Premium: entrega imediata
      await supabase
        .from('song_requests')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          final_mixed_audio_url: fullAudioUrl || songRequest.final_mixed_audio_url || null
        })
        .eq('id', requestId);
      firePurchaseEvent();
      const slug = (songRequest.recipient_name || 'especial').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const personalizedUrl = `${getAppUrl(req)}/song/${slug}?id=${songData.id}`;
      if (userEmail) {
        logInfo('[Admin] Enviando email de entrega (express/premium)', { requestId, userEmail });
        sendPersonalizedEmail(userEmail, songRequest.recipient_name, personalizedUrl, letterText).catch(err =>
          logError('[Admin] Falha ao enviar email de entrega (express/premium)', err, { requestId, userEmail })
        );
      }
      // WhatsApp automático: notificação de entrega + agendar feedback 24h
      if (songRequest.phone) {
        sendDeliveryWhatsApp({
          requestId,
          phone: songRequest.phone,
          recipientName: songRequest.recipient_name,
          songUrl: personalizedUrl,
        }).catch(err => logError('[Admin] Falha ao enviar WhatsApp de entrega (express/premium)', err, { requestId }));
        const feedbackTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        supabase.from('feedback_requests').upsert({
          request_id: requestId,
          scheduled_at: feedbackTime,
          status: 'pending',
          recipient_name: songRequest.recipient_name,
          email: userEmail,
          phone: songRequest.phone,
          song_url: personalizedUrl,
        }, { onConflict: 'request_id' }).select().single().then(() => {}, (err: unknown) =>
          logError('[Admin] Falha ao agendar pedido de feedback (express/premium)', err, { requestId })
        );
      }
      // Video upsell: enviar offer de videoclipe (Express/Premium)
      sendVideoUpsellOffer(requestId, songRequest, req);
      return res.json({ success: true, message: 'Pagamento aprovado. Música entregue por e-mail e WhatsApp.' });
    }

    // Precisa de gerar áudio ou processar voz clonada → workflow Suno

    // Evita iniciar um segundo workflow se já existe um em andamento
    const isProcessing = songData.mureka_status === 'generating' || songData.mureka_status === 'processing' || (songData.mureka_task_id && !hasGeneratedAudio);
    if (isProcessing) {
      firePurchaseEvent();
      return res.json({ success: true, message: 'Música já está em processamento. A entrega será automática quando concluída.', alreadyProcessing: true });
    }

    if (userEmail) {
      logInfo('[Admin] Enviando email de confirmacao (suno workflow)', { requestId, userEmail });
      sendConfirmationEmail(userEmail, songRequest.recipient_name, requestId, 'standard_approved').catch(err =>
        logError('[Admin] Falha ao enviar email de confirmacao (suno workflow)', err, { requestId, userEmail })
      );
    }
    // WhatsApp de aprovação Standard (workflow Suno): o cliente fica à espera da música
    const sunoStandardPhone = songRequest.phone || songRequest.users?.phone || null;
    if (sunoStandardPhone) {
      sendPaymentApprovedWhatsApp({
        requestId,
        phone: sunoStandardPhone,
        recipientName: songRequest.recipient_name,
      }).catch(err => logError('[Admin] Falha ao enviar WhatsApp de aprovacao (suno workflow)', err, { requestId }));
    }
    await supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', requestId).eq('status', 'approved');
    firePurchaseEvent();
    runBackgroundSunoWorkflow(requestId, songData.id, songRequest.music_style || 'Kizomba', songData.title || 'Música SeuBeat', songData.lyrics || [], {
      voiceType: songRequest.voice_type || undefined,
      desiredEmotion: songRequest.desired_emotion || undefined,
    }).catch(err => logError('[Admin] Background Suno workflow falhou apos aprovacao', err, { requestId }));
    return res.json({ success: true, message: 'Pagamento aprovado. Música em processamento no Suno.', hasVoiceSample });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// D. Admin reject payment
router.post('/payment/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: payment } = await supabase
      .from('payments')
      .select('user_email, request_id, status, proof_path')
      .eq('id', id)
      .eq('status', 'pending_verification')
      .single();

    if (!payment) return res.status(409).json({ success: false, error: 'Pagamento não encontrado ou já processado.' });

    await supabase.from('payments').update({ status: 'rejected', notes: notes || null }).eq('id', id).eq('status', 'pending_verification');

    logAdminAction({ action: 'reject', entityType: 'payment', entityId: id, previousData: { status: payment?.status }, notes: notes || undefined });

    if (payment?.request_id) {
      await supabase.from('song_requests').update({ status: 'payment_rejected' }).eq('id', payment.request_id).in('status', ['payment_submitted', 'approved']);
    }

    if (payment?.user_email) {
      logInfo('[Admin] Enviando email de rejeicao', { paymentId: id, userEmail: payment.user_email });
      sendPaymentRejectionEmail(payment.user_email, notes).catch(err => logError('[Admin] Falha ao enviar email de rejeicao', err, { userId: payment.user_email }));
    }

    res.json({ success: true, message: 'Pagamento rejeitado.' });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// E. Admin list requests
router.get('/requests', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: requestsData, error } = await supabase
      .from('song_requests')
      .select('*, users(name, email, phone), songs(id, title, audio_url, mureka_status, created_at, letter_text, lyrics)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });

    const requestIds = (requestsData || []).map(r => r.id).filter(Boolean);
    let paymentsMap: Record<string, any[]> = {};

    if (requestIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('id, plan, amount, status, created_at, payment_reference, user_email, request_id, proof_url, proof_filename, notes, approved_at')
        .in('request_id', requestIds);

      for (const p of paymentsData || []) {
        if (!paymentsMap[p.request_id]) paymentsMap[p.request_id] = [];
        paymentsMap[p.request_id].push(p);
      }
    }

    const data = (requestsData || []).map(r => ({
      ...r,
      payments: paymentsMap[r.id] || []
    }));

    res.json({ success: true, requests: data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// F. Admin list songs
router.get('/songs', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('songs')
      .select('*, song_requests(id, recipient_name, music_style, occasion, users(name, email, phone))')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });

    const songs = data || [];
    const requestIds = Array.from(new Set(
      songs
        .map(song => firstRelated(song.song_requests)?.id)
        .filter(Boolean)
    ));

    const planByRequestId = new Map<string, string>();
    if (requestIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('request_id, plan, created_at')
        .in('request_id', requestIds)
        .order('created_at', { ascending: false });

      if (paymentsError) {
        logWarn('[Admin] Falha ao carregar planos para músicas', { error: safeMessage(paymentsError) });
      } else {
        (payments || []).forEach(payment => {
          if (payment.request_id && payment.plan && !planByRequestId.has(payment.request_id)) {
            planByRequestId.set(payment.request_id, payment.plan);
          }
        });
      }
    }

    const songsWithPlans = songs.map(song => ({
      ...song,
      song_requests: mapRelated(song.song_requests, requestData => ({
        ...requestData,
        plan: planByRequestId.get(requestData.id)
      }))
    }));

    res.json({ success: true, songs: songsWithPlans });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// G. Admin manual Mureka
router.post('/song/:id/generate-music', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { forceNew } = req.body || {};
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: songData, error } = await supabase
      .from('songs')
      .select('*, song_requests(music_style, voice_type, desired_emotion)')
      .eq('id', id)
      .single();

    if (error || !songData) return res.status(404).json({ success: false, error: 'Música não encontrada' });

    if (!forceNew && songData.request_id && songData.mureka_task_id && !songData.audio_url) {
      resumeSunoTaskWorkflow(songData.request_id, id, songData.mureka_task_id).catch(err => logError('[Admin] Resume Suno task falhou', err, { songId: id }));
      return res.json({ success: true, message: 'Verificação da task Suno existente iniciada.' });
    }

    if (!songData.request_id) return res.status(400).json({ success: false, error: 'Musica sem pedido associado.' });

    await supabase.from('songs').update({
      mureka_status: 'generating',
      mureka_task_id: null,
      audio_url: forceNew ? null : songData.audio_url,
      full_song_url: forceNew ? null : songData.full_song_url,
      preview_url: null
    }).eq('id', id);
    await supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', songData.request_id);

    const sr = (songData.song_requests as any) || {};
    runBackgroundSunoWorkflow(
      songData.request_id,
      id,
      sr?.music_style || 'Kizomba',
      songData.title || 'Musica SeuBeat',
      normalizeLyricsArray(songData.lyrics),
      { voiceType: sr?.voice_type || undefined, desiredEmotion: sr?.desired_emotion || undefined }
    ).catch(err => logError('[Admin] Background Suno falhou apos iniciar', err, { songId: id }));

    res.json({ success: true, message: 'Geração Suno iniciada em background.' });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// I. API Credits
router.get('/credits', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [sunoResult, deepseekResult, claudeResult, openaiResult, geminiResult, emailResult, songsRes, songsMonthRes, songsByMonthRes] = await Promise.all([
      // Suno live credit check
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: 'SUNO_API_KEY em falta' };
        try {
          const creditsRes = await fetch('https://api.sunoapi.org/api/v1/generate/credit', { headers: { 'Authorization': `Bearer ${key}` } });
          if (!creditsRes.ok) return { ok: false, error: `HTTP ${creditsRes.status}` };
          const creditsData = await creditsRes.json();
          const credits = creditsData.data || 0;
          return { ok: true, credits, low: credits < 20, lastCheck: now.toISOString() };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      checkDeepSeek(now),
      // Claude live check
      (async () => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY em falta' };
        try {
          const client = new Anthropic({ apiKey });
          const response = await client.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }]
          });
          return { ok: !!(response && response.content), model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022', lastCheck: now.toISOString() };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('quota') || msg.includes('limit') || msg.includes('429')) {
            return { ok: true, quota_exceeded: true, error: msg, model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022', lastCheck: now.toISOString() };
          }
          return { ok: false, error: msg };
        }
      })(),
      // OpenAI live check
      (async () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY em falta' };
        try {
          const openai = new OpenAI({ apiKey });
          const models = await openai.models.list({ timeout: 5000 });
          const creditsRes = await fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          if (creditsRes.ok) {
            const data = await creditsRes.json();
            return {
              ok: true,
              total_granted: data.total_granted || 0,
              total_used: data.total_used || 0,
              total_available: data.total_available || 0,
              model: process.env.OPENAI_MODEL || 'gpt-4o',
              lastCheck: now.toISOString(),
            };
          }
          return { ok: true, model: process.env.OPENAI_MODEL || 'gpt-4o', lastCheck: now.toISOString() };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('quota') || msg.includes('limit') || msg.includes('429') || msg.includes('insufficient')) {
            return { ok: true, quota_exceeded: true, error: msg, model: process.env.OPENAI_MODEL || 'gpt-4o', lastCheck: now.toISOString() };
          }
          return { ok: false, error: msg };
        }
      })(),
      // Gemini live check
      (async () => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY em falta' };
        try {
          const genAI = new GoogleGenAI({ apiKey });
          const response = await genAI.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            config: { maxOutputTokens: 1 },
          });
          return { ok: true, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', lastCheck: now.toISOString() };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('quota') || msg.includes('limit') || msg.includes('429') || msg.includes('insufficient') || msg.includes('RATE_LIMIT') || msg.includes('dailyLimitExceeded') || msg.includes('quotaExceeded')) {
            return { ok: true, quota_exceeded: true, error: msg, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', lastCheck: now.toISOString() };
          }
          return { ok: false, error: msg };
        }
      })(),
      // Brevo API live check
      (async () => {
        const key = process.env.BREVO_API_KEY;
        if (!key) return { ok: false, error: 'BREVO_API_KEY em falta' };
        try {
          const test = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': key, accept: 'application/json' } });
          if (!test.ok) return { ok: false, error: `Brevo API error (${test.status})` };
          const data: any = await test.json();
          return { ok: true, provider: 'Brevo', email: data.email, lastCheck: now.toISOString() };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      // Total songs generated
      supabase.from('songs').select('id', { count: 'exact', head: true }).not('lyrics', 'is', null),
      // Songs this month
      supabase.from('songs').select('id', { count: 'exact', head: true }).not('lyrics', 'is', null).gte('created_at', firstOfMonth),
      // Songs by month for chart
      supabase.from('songs').select('created_at').not('lyrics', 'is', null).order('created_at', { ascending: true }),
    ]);

    const totalSongs = songsRes.count || 0;
    const songsThisMonth = songsMonthRes.count || 0;
    const songsData = songsByMonthRes.data || [];

    // Aggregate by month
    const monthlyCount: Record<string, number> = {};
    songsData.forEach((s: any) => {
      if (s.created_at) {
        const month = s.created_at.slice(0, 7);
        monthlyCount[month] = (monthlyCount[month] || 0) + 1;
      }
    });
    const songsByMonth = Object.entries(monthlyCount)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));

    const sunoCredits = sunoResult.ok ? (sunoResult as any).credits : 0;
    const CREDITS_PER_SONG = 24;
    const estCreditsUsed = totalSongs * CREDITS_PER_SONG;
    const estSongsRemaining = sunoCredits > 0 ? Math.floor(sunoCredits / CREDITS_PER_SONG) : 0;
    const sunoCostPerCredit = Number(process.env.SUNO_COST_PER_CREDIT_USD) || 0.005;
    const deepseekCostPerGen = Number(process.env.DEEPSEEK_COST_PER_GENERATION_USD) || 0.0005;
    const claudeCostPerGen = Number(process.env.CLAUDE_COST_PER_GENERATION_USD) || 0.03;
    const openaiCostPerGen = Number(process.env.OPENAI_COST_PER_GENERATION_USD) || 0.01;
    const estSunoCost = +(estCreditsUsed * sunoCostPerCredit).toFixed(2);
    const estDeepSeekCost = +(totalSongs * deepseekCostPerGen).toFixed(2);
    const estClaudeCost = +(totalSongs * claudeCostPerGen).toFixed(2);
    const estOpenAICost = +(totalSongs * openaiCostPerGen).toFixed(2);
    const estLyricCost = Math.min(estDeepSeekCost, estClaudeCost, estOpenAICost);
    const estTotalCost = +(estSunoCost + estLyricCost).toFixed(2);

    res.json({
      suno: sunoResult,
      deepseek: deepseekResult,
      claude: claudeResult,
      openai: openaiResult,
      gemini: geminiResult,
      email: emailResult,
      usage: {
        totalSongs,
        songsThisMonth,
        songsByMonth,
        estimatedSunoCreditsUsed: estCreditsUsed,
        estimatedSongsRemaining: estSongsRemaining,
        cost: {
          sunoUSD: estSunoCost,
          deepseekUSD: estDeepSeekCost,
          claudeUSD: estClaudeCost,
          openaiUSD: estOpenAICost,
          lyricUSD: +estLyricCost.toFixed(2),
          totalUSD: estTotalCost,
          perSong: +((sunoCostPerCredit * CREDITS_PER_SONG) + Math.min(deepseekCostPerGen, claudeCostPerGen, openaiCostPerGen)).toFixed(4),
        },
      },
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// J. Force status override
const VALID_STATUSES: Record<string, string[]> = {
  song_requests: ['lyrics_generating', 'lyrics_ready', 'approved', 'music_processing', 'voice_processing', 'music_ready', 'delivered', 'failed', 'payment_rejected', 'payment_submitted'],
  payments: ['pending_verification', 'approved', 'rejected', 'failed'],
  songs: ['not_started', 'generating', 'processing', 'completed', 'failed']
};

router.post('/request/:id/force-status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { table, status, field } = req.body;

    if (!table || !status) {
      return res.status(400).json({ success: false, error: 'Parâmetros "table" e "status" são obrigatórios.' });
    }

    const allowed = VALID_STATUSES[table];
    if (!allowed) {
      return res.status(400).json({ success: false, error: `Tabela inválida. Use: ${Object.keys(VALID_STATUSES).join(', ')}` });
    }

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `Status inválido para "${table}". Permitidos: ${allowed.join(', ')}` });
    }

    const ALLOWED_FIELDS: Record<string, string[]> = {
      song_requests: ['status'],
      payments: ['status'],
      songs: ['mureka_status'],
    };

    const statusField = field || (table === 'songs' ? 'mureka_status' : 'status');
    const allowedFields = ALLOWED_FIELDS[table] || [];
    if (!allowedFields.includes(statusField)) {
      return res.status(400).json({ success: false, error: `Campo "${statusField}" não é editável. Permitidos: ${allowedFields.join(', ')}` });
    }

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const updatePayload: Record<string, unknown> = { [statusField]: status };
    if (table === 'song_requests' && status === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    if (!data) return res.status(404).json({ success: false, error: 'Registo não encontrado.' });

    logInfo('[Admin] Status forçado manualmente', { table, id, status, field: statusField });
    logAdminAction({ action: 'force_status', entityType: table, entityId: id, previousData: { [statusField]: data[statusField] || data.status }, newData: { [statusField]: status }, notes: `Forçado para ${status}` });

    if (table === 'song_requests' && status === 'delivered') {
      const { data: songRequest } = await supabase
        .from('song_requests')
        .select('*, songs(*), users(*)')
        .eq('id', id)
        .single();

      const song = firstRelated(songRequest?.songs);
      if (songRequest?.users?.email && song) {
        const slug = (songRequest.recipient_name || 'especial')
          .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const url = `${getAppUrl(req)}/song/${slug}?id=${song.id}`;
        sendPersonalizedEmail(songRequest.users.email, songRequest.recipient_name, url, song.letter_text || 'Dedicatória.')
          .catch(err => logWarn('[Admin] Falha ao enviar email após force-status delivered', { error: err?.message }));

        const clientPhone = songRequest.phone || songRequest.users?.phone;
        if (clientPhone) {
          sendDeliveryWhatsApp({
            requestId: songRequest.id,
            phone: clientPhone,
            recipientName: songRequest.recipient_name,
            songUrl: url,
          }).catch(err => logWarn('[Admin] Falha ao enviar WhatsApp de entrega', { error: String(err) }));
        }
      }
    }

    res.json({ success: true, message: `Status atualizado para "${status}" em "${table}".`, data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// H. Diagnostics
router.get('/diagnostics', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const [supabaseDiag, deepseekDiag, claudeDiag, openaiDiag, geminiDiag, sunoDiag, sunoVoiceDiag, emailDiag] = await Promise.all([
      (async () => {
        const supabase = getAdminSupabase();
        if (!supabase) return { ok: false, error: 'Cliente não inicializado' };
        try {
          const { data, error } = await supabase.storage.listBuckets();
          if (error) return { ok: false, error: error.message };
          return { ok: true, buckets: data.map(b => ({ name: b.name, public: b.public })) };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      checkDeepSeek(now),
      (async () => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY em falta' };
        try {
          const client = new Anthropic({ apiKey });
          const response = await client.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'ping' }]
          });
          return { ok: !!(response && response.content) };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      (async () => {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return { ok: false, error: 'OPENAI_API_KEY em falta' };
        try {
          const openai = new OpenAI({ apiKey: key });
          await openai.models.list({ timeout: 5000 });
          return { ok: true };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      // Gemini diagnostic
      (async () => {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return { ok: false, error: 'GEMINI_API_KEY em falta' };
        try {
          const genAI = new GoogleGenAI({ apiKey: key });
          const response = await genAI.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            config: { maxOutputTokens: 8 },
          });
          return { ok: !!response };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: 'SUNO_API_KEY em falta' };
        try {
          const creditsRes = await fetch('https://api.sunoapi.org/api/v1/generate/credit', { headers: { 'Authorization': `Bearer ${key}` } });
          if (!creditsRes.ok) return { ok: false, error: `HTTP ${creditsRes.status}` };
          const creditsData = await creditsRes.json();
          return { ok: true, credits: creditsData.data || 0 };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: 'SUNO_API_KEY em falta' };
        try {
          const res = await fetch('https://api.sunoapi.org/api/v1/voice/record-info?taskId=ping_test', { headers: { 'Authorization': `Bearer ${key}` } });
          return { ok: res.status !== 401 && res.status !== 403 };
        } catch (err: unknown) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
      })(),
      (async () => {
        const key = process.env.BREVO_API_KEY;
        if (!key) return { ok: false, error: 'BREVO_API_KEY em falta' };
        return { ok: true, provider: 'Brevo' };
      })()
    ]);

    const mem = process.memoryUsage();
    res.json({
      supabase: supabaseDiag,
      deepseek: deepseekDiag,
      claude: claudeDiag,
      openai: openaiDiag,
      gemini: geminiDiag,
      suno: sunoDiag,
      sunoVoice: sunoVoiceDiag,
      email: emailDiag,
      server: {
        uptime: process.uptime(),
        node: process.version,
        platform: process.platform,
        memory: {
          rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        },
      },
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.post('/request/:id/retry', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*)').eq('id', id).single();
    if (!requestData) return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
    const songData = firstRelated(requestData.songs);
    if (!songData) return res.status(400).json({ success: false, error: 'Música associada em falta.' });

    if (songData.mureka_task_id && !songData.audio_url) {
      resumeSunoTaskWorkflow(id, songData.id, songData.mureka_task_id).catch(err => logError('[Admin] Resume Suno task falhou no retry', err, { requestId: id }));
      return res.json({ success: true, message: 'Retomado.' });
    }

    await supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', id);
    await supabase.from('songs').update({ mureka_status: 'generating' }).eq('id', songData.id);
    runBackgroundSunoWorkflow(id, songData.id, requestData.music_style || 'Kizomba', songData.title || 'Música SeuBeat', songData.lyrics || [], {
      voiceType: requestData.voice_type || undefined,
      desiredEmotion: requestData.desired_emotion || undefined,
    }).catch(err => logError('[Admin] Background Suno falhou no retry', err, { requestId: id }));
    res.json({ success: true, message: 'Reiniciado.' });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Admin] retry ERRO:', errMsg, { requestId: req.params?.id });
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post('/request/:id/recover', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB nao disponivel' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*)').eq('id', id).single();
    if (!requestData) return res.status(404).json({ success: false, error: 'Pedido nao encontrado' });
    const songData = firstRelated(requestData.songs);
    if (!songData) return res.status(400).json({ success: false, error: 'Música associada em falta.' });

    const knownTaskIds: string[] = [
      'f5ecb840034c7661a0c6f5b1868b7f44',
      '52d7f402a8cd806e7bd29796d23acb58',
      '6909cae212783daf684c2fe6db85fa87',
    ];

    logInfo('[Admin Recover] Iniciando recovery', { ourId: id });

    let foundAudioUrl: string | null = null;
    let usedTaskId: string | null = null;

    for (const taskId of knownTaskIds) {
      if (!taskId) continue;
      try {
        const result = await querySunoTask(taskId);
        if (result.audioUrl) {
          foundAudioUrl = result.audioUrl;
          usedTaskId = taskId;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!foundAudioUrl) {
      return res.json({ success: false, error: 'Nenhuma task tem áudio.' });
    }

    // persist with skipProcessing
    // usedTaskId is guaranteed to be set because we found audioUrl above
    const persistResult = await persistGeneratedSunoAudio(songData.id, usedTaskId!, foundAudioUrl, {
      skipProcessing: true,
      hintDuration: songData.duration ?? 239,
    });

    // update song
    await supabase.from('songs').update({
      audio_url: persistResult.fullAudioUrl,
      full_song_url: persistResult.fullAudioUrl,
      preview_url: null,
      duration: persistResult.duration,
      mureka_task_id: usedTaskId,
      mureka_status: 'completed'
    }).eq('id', songData.id);

    return res.json({ success: true, message: 'Recovery OK' });
  } catch (err: unknown) {
    logRouteError(req, err);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

router.post('/request/:id/force-voice', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*)').eq('id', id).single();
    const songData = firstRelated(requestData?.songs);
    if (!requestData || !songData) return res.status(404).json({ success: false, error: 'Pedido ou música não encontrada' });
    if (!requestData.voice_sample_url) return res.status(400).json({ success: false, error: 'Sem amostra de voz.' });

    await supabase.from('song_requests').update({ status: 'voice_processing' }).eq('id', id);
    const voiceSampleUrl = requestData.voice_sample_url;
    processSunoVoice(id, songData.id, voiceSampleUrl).then(voiceId => {
      if (voiceId) {
        supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', id).maybeSingle().then();
      }
    }).catch(err => logError('[Admin] Force Suno Voice falhou', err, { requestId: id }));
    res.json({ success: true, message: 'Processamento de voz Suno Voice forçado.' });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.post('/request/:id/resend-email', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*), users(*)').eq('id', id).single();
    const songData = firstRelated(requestData?.songs);
    if (!requestData || !songData || !requestData.users?.email) return res.status(404).json({ success: false, error: 'Dados insuficientes.' });

    const deliverableStatuses = ['delivered', 'approved', 'music_ready'];
    if (!deliverableStatuses.includes(requestData.status)) {
      return res.status(400).json({ success: false, error: `Estado "${requestData.status}" não permite reenvio de email.` });
    }

    const slug = (requestData.recipient_name || 'especial').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const personalizedUrl = `${getAppUrl(req)}/song/${slug}?id=${songData.id}`;
    await sendPersonalizedEmail(requestData.users.email, requestData.recipient_name, personalizedUrl, songData.letter_text || 'Dedicatória.');
    res.json({ success: true, message: 'Email reenviado.' });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.post('/song/:id/edit-lyrics', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, lyrics, letterText } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const lyricsArray = normalizeLyricsArray(lyrics);
    const { data, error } = await supabase.from('songs').update({ title, lyrics: lyricsArray, letter_text: letterText || null }).eq('id', id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, song: data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/song/:id/audio-url', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success: false, error: 'ID inválido.' });

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: song, error } = await supabase
      .from('songs')
      .select('id, title, audio_url, full_song_url, preview_url, audio_url_v2, full_song_url_v2')
      .eq('id', id)
      .single();

    if (error || !song) return res.status(404).json({ success: false, error: 'Música não encontrada.' });

    const wantV2 = req.query.version === '2';
    const fullUrl = wantV2
      ? (song.full_song_url_v2 || song.audio_url_v2 || null)
      : (song.full_song_url || song.audio_url);
    const fullPath = extractStoragePath(fullUrl, 'full-audio');
    if (fullPath) {
      const downloadName = safeAudioFilename(song.title);
      const options = req.query.download === '1' ? { download: downloadName } : undefined;
      const signedUrl = await createSignedStorageUrl('full-audio', fullPath, 3600);

      if (!signedUrl) return res.status(500).json({ success: false, error: 'Não foi possível gerar link seguro da música completa.' });
      return res.json({ success: true, url: signedUrl, filename: downloadName, source: 'full-audio' });
    }

    const fallbackUrl = fullUrl || song.preview_url;
    if (!fallbackUrl) return res.status(404).json({ success: false, error: 'Áudio indisponível.' });
    res.json({ success: true, url: fallbackUrl, filename: safeAudioFilename(song.title), source: 'audio' });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.post('/song/:id/upload-audio', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success: false, error: 'ID inválido.' });
    const { audioBase64, audioFilename, audioMimeType } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    if (typeof audioBase64 !== 'string') return res.status(400).json({ success: false, error: 'Áudio ausente ou inválido.' });
    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 50 * 1024 * 1024) return res.status(400).json({ success: false, error: 'Áudio demasiado grande. Máx. 50MB.' });
    const sanitizedAudioFilename = String(audioFilename || 'manual_audio.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `songs/${Date.now()}_${sanitizedAudioFilename}`;

    const fullAudioUrl = await uploadFileToStorage('full-audio', filename, buffer, audioMimeType || 'audio/mpeg');

    await supabase.from('songs').update({ audio_url: fullAudioUrl, full_song_url: fullAudioUrl, mureka_status: 'completed', preview_url: null }).eq('id', id);
    const { data: songData } = await supabase.from('songs').select('request_id').eq('id', id).single();
    if (songData?.request_id) {
      const { data: approvedPayment } = await supabase
        .from('payments')
        .select('id, plan, created_at')
        .eq('request_id', songData.request_id)
        .eq('status', 'approved')
        .maybeSingle();
      if (approvedPayment) {
        const isStandard = (approvedPayment as any).plan === 'standard';
        const paymentCreatedAt = (approvedPayment as any).created_at || new Date().toISOString();
        const deliverAt = isStandard ? new Date(new Date(paymentCreatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
        const retryUpdate: Record<string, unknown> = {
          status: isStandard ? 'approved' : 'delivered',
          deliver_at: deliverAt,
          final_mixed_audio_url: fullAudioUrl
        };
        if (!isStandard) retryUpdate.delivered_at = new Date().toISOString();
        await supabase
          .from('song_requests')
          .update(retryUpdate)
          .eq('id', songData.request_id);
      } else {
        await supabase.from('song_requests').update({ status: 'music_ready' }).eq('id', songData.request_id);
      }
    }
    res.json({ success: true });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.get('/clients', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const { data, error } = await supabase.from('users').select('*, song_requests(id, status, created_at)').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, clients: data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// P. GET progress map (exposed for frontend polling)
router.get('/progress', adminAuth, async (req, res) => {
  try {
    const progress = { ...requestProgressMap };
    const now = Date.now();
    const PROGRESS_TTL_MS = 5 * 60 * 1000;
    for (const [id, p] of Object.entries(progress)) {
      if (now - p.updatedAt > PROGRESS_TTL_MS) delete progress[id];
    }
    res.json(progress);
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// Q. Undo last admin action for an entity
router.post('/undo', adminAuth, async (req, res) => {
  try {
    const { entityType, entityId, action } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    if (!entityType || !entityId || !action) {
      return res.status(400).json({ success: false, error: 'Parâmetros "entityType", "entityId" e "action" obrigatórios.' });
    }

    if (action === 'approve' || action === 'reject') {
      if (entityType === 'payment') {
        const targetStatus = action === 'approve' ? 'approved' : 'rejected';
        const { error: undoError } = await supabase
          .from('payments')
          .update({ status: 'pending_verification', approved_at: null, notes: 'Desfeito pelo admin' })
          .eq('id', entityId)
          .eq('status', targetStatus);
        if (!undoError) {
          const { data: pay } = await supabase.from('payments').select('request_id, status').eq('id', entityId).single();
          if (pay?.request_id && pay.status === 'pending_verification') {
            await supabase.from('song_requests').update({ status: 'payment_submitted' }).eq('id', pay.request_id).in('status', ['payment_rejected', 'approved', 'delivered', 'music_ready', 'music_processing', 'voice_processing']);
          }
        }
        logAdminAction({ action: 'undo', entityType: 'payment', entityId, notes: `Undo: ${action}` });
        return res.json({ success: true, message: `Acção de "${action}" revertida. Pagamento voltou a "pending_verification".` });
      }
    }

    if (action === 'force_status') {
      const { previousStatus } = req.body;
      if (!previousStatus) return res.status(400).json({ success: false, error: 'Força-status undo requer "previousStatus".' });
      // Validar previousStatus contra a lista de status permitidos
      const undoAllowed = VALID_STATUSES[entityType] || [];
      if (undoAllowed.length > 0 && !undoAllowed.includes(previousStatus)) {
        return res.status(400).json({ success: false, error: `previousStatus "${previousStatus}" inválido para "${entityType}". Permitidos: ${undoAllowed.join(', ')}` });
      }
      if (entityType === 'song_requests' || entityType === 'payments') {
        await supabase.from(entityType).update({ status: previousStatus }).eq('id', entityId);
        logAdminAction({ action: 'undo', entityType, entityId, notes: `Undo force_status: revertido para ${previousStatus}` });
        return res.json({ success: true, message: `Estado revertido para "${previousStatus}".` });
      }
      if (entityType === 'songs') {
        await supabase.from('songs').update({ mureka_status: previousStatus }).eq('id', entityId);
        logAdminAction({ action: 'undo', entityType: 'songs', entityId, notes: `Undo force_status: revertido para ${previousStatus}` });
        return res.json({ success: true, message: `Estado revertido para "${previousStatus}".` });
      }
    }

    res.status(400).json({ success: false, error: 'Combinação entityType/action não suportada para undo.' });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// K. Update request style/voice
router.post('/request/:id/update-style', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { music_style, voice_type } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const updateData: Record<string, string> = {};
    if (music_style) updateData.music_style = music_style;
    if (voice_type) updateData.voice_type = voice_type;
    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: 'Nada para atualizar.' });
    const { data, error } = await supabase.from('song_requests').update(updateData).eq('id', id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// L. Edit client data (name, email, phone)
router.post('/user/:id/edit', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const updateData: Record<string, string | null> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 100) return res.status(400).json({ success: false, error: 'Nome inválido (max 100 caracteres).' });
      updateData.name = name.trim() || null;
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ success: false, error: 'Email inválido.' });
      const normalizedEmail = email.trim().toLowerCase();
      const { data: existing } = await supabase.from('users').select('id').eq('email', normalizedEmail).neq('id', id).maybeSingle();
      if (existing) return res.status(400).json({ success: false, error: 'Este email já está em uso por outro cliente.' });
      updateData.email = normalizedEmail;
    }
    if (phone !== undefined) {
      if (typeof phone === 'string' && phone.trim() && !/^\+?[\d\s()-]{7,18}$/.test(phone.trim())) {
        return res.status(400).json({ success: false, error: 'Telefone inválido (7-18 caracteres).' });
      }
      updateData.phone = phone?.trim() || null;
    }

    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: 'Nada para atualizar.' });

    const { data, error } = await supabase.from('users').update(updateData).eq('id', id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    logInfo('[Admin] Dados do cliente atualizados', { userId: id, fields: Object.keys(updateData) });
    res.json({ success: true, data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// M. Edit request details (recipient_name, relationship, occasion, language)
router.post('/request/:id/edit-details', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { recipient_name, relationship, occasion, language } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const updateData: Record<string, string> = {};
    if (recipient_name !== undefined) {
      if (typeof recipient_name !== 'string' || recipient_name.trim().length < 1 || recipient_name.trim().length > 100) {
        return res.status(400).json({ success: false, error: 'Nome do destinatário inválido (1-100 caracteres).' });
      }
      updateData.recipient_name = recipient_name.trim();
    }
    if (relationship !== undefined) {
      if (typeof relationship !== 'string' || !relationship.trim()) {
        return res.status(400).json({ success: false, error: 'Relação inválida.' });
      }
      updateData.relationship = relationship.trim().toLowerCase();
    }
    if (occasion !== undefined) {
      if (typeof occasion !== 'string' || !occasion.trim()) {
        return res.status(400).json({ success: false, error: 'Ocasião inválida.' });
      }
      updateData.occasion = occasion.trim().toLowerCase();
    }
    if (language !== undefined) {
      if (typeof language !== 'string' || !language.trim()) {
        return res.status(400).json({ success: false, error: 'Idioma inválido.' });
      }
      updateData.language = language.trim().toLowerCase();
    }

    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: 'Nada para atualizar.' });

    const { data, error } = await supabase.from('song_requests').update(updateData).eq('id', id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    logInfo('[Admin] Dados do pedido atualizados', { requestId: id, fields: Object.keys(updateData) });
    res.json({ success: true, data });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// N. Regenerate lyrics (re-call Claude)
router.post('/request/:id/regenerate-lyrics', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(id, title, lyrics, letter_text), users(name, email, phone)')
      .eq('id', id)
      .single();

    if (reqError || !requestData) return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
    const existingSong = firstRelated(requestData.songs);

    const formData = {
      userNick: requestData.users?.name || 'Autor',
      recipientName: requestData.recipient_name,
      recipientGender: requestData.recipient_gender || 'Masculino',
      recipientRelation: requestData.relationship,
      recipientNick: requestData.recipient_nick || '',
      occasion: requestData.occasion,
      musicStyle: requestData.music_style,
      voiceType: requestData.voice_type,
      unforgettableMemory: requestData.memory || '',
      whatMakesSpecial: requestData.special_traits || '',
      onlySheDoes: requestData.only_she_does || '',
      whereItHappened: requestData.where_it_happened || '',
      whyCreatedToday: requestData.why_created_today || '',
      referenceArtist: requestData.reference_artist || '',
      messageFromTheHeart: requestData.heart_message || '',
      hookPhrase: requestData.hook_phrase || '',
      desiredEmotion: requestData.desired_emotion || 'Emocionante',
      language: requestData.language || 'português'
    };

    const { generateLyrics } = await import('../services/ai');
    const { result: parsedData } = await generateLyrics(formData, {
      requestId: requestData.id,
      email: requestData.users?.email || undefined
    });

    if (existingSong) {
      const { data: updatedSong, error: songError } = await supabase
        .from('songs')
        .update({
          title: parsedData.songTitle,
          lyrics: parsedData.lyrics,
          lyrics_snippet: parsedData.lyricsSnippet,
          letter_text: parsedData.letterText
        })
        .eq('id', existingSong.id)
        .select()
        .single();

      if (songError) return res.status(500).json({ success: false, error: safeMessage(songError) });
      return res.json({ success: true, song: updatedSong, recovered: false });
    }

    // Pedido falhado sem música associada (ex.: falha de IA no /generate-lyrics):
    // gera a letra, cria a row de songs e marca lyrics_ready para o pedido retomar no pagamento.
    const { data: createdSong, error: createError } = await supabase
      .from('songs')
      .insert([{
        request_id: requestData.id,
        title: parsedData.songTitle,
        lyrics: parsedData.lyrics,
        lyrics_snippet: parsedData.lyricsSnippet,
        letter_text: parsedData.letterText,
        mureka_status: 'not_started'
      }])
      .select()
      .single();

    if (createError) return res.status(500).json({ success: false, error: safeMessage(createError) });

    if (requestData.status === 'failed') {
      const { error: statusError } = await supabase
        .from('song_requests')
        .update({ status: 'lyrics_ready', error_details: null })
        .eq('id', requestData.id);
      if (statusError) {
        logError('[API] Falha ao atualizar status após regenerar pedido falhado', statusError, { requestId: requestData.id });
      }
    }

    res.json({ success: true, song: createdSong, recovered: true });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// M. Request event logs
router.get('/request/:id/logs', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*), payments(*)').eq('id', id).single();
    if (!requestData) return res.status(404).json({ success: false, error: 'Pedido não encontrado' });

    const logs: { timestamp: string; event: string; detail: string }[] = [];
    const push = (ts: string, event: string, detail: string) => logs.push({ timestamp: ts, event, detail });

    if (requestData.created_at) push(requestData.created_at, 'Pedido Criado', `Por ${requestData.users?.name || '—'} (${requestData.users?.email || '—'})`);
    if (requestData.status) push(requestData.updated_at || requestData.created_at, `Status: ${requestData.status}`, '');
    const song = firstRelated(requestData.songs);
    if (song?.created_at) push(song.created_at, 'Letra Gerada', `Título: ${song.title}`);
    if (requestData.payments?.length) {
      requestData.payments.forEach((p: any) => {
        push(p.created_at, 'Pagamento Submetido', `${p.plan} — ${p.amount}`);
        if (p.status === 'approved') push(p.approved_at || p.created_at, 'Pagamento Aprovado', '');
        if (p.status === 'rejected') push(p.updated_at || p.created_at, 'Pagamento Rejeitado', p.notes || '');
      });
    }
    if (song?.audio_url) push(song.created_at, 'Áudio Gerado', 'URL do áudio disponível');

    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json({ success: true, logs });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// N. Advanced metrics
router.get('/metrics', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const [requestsRes, paymentsRes, songsRes] = await Promise.all([
      supabase.from('song_requests').select('id, status, created_at, music_style', { count: 'exact' }),
      supabase.from('payments').select('id, request_id, status, amount, plan, created_at, approved_at'),
      supabase.from('songs').select('id, created_at, request_id')
    ]);

    const requests = requestsRes.data || [];
    const payments = paymentsRes.data || [];
    const songs = songsRes.data || [];
    const firstActivityAt = [...requests.map(r => r.created_at), ...payments.map(p => p.created_at), ...songs.map(s => s.created_at)]
      .filter(Boolean)
      .sort()[0];
    const since = firstActivityAt ? isoDateOnly(new Date(firstActivityAt)) : isoDateOnly(new Date());
    const until = isoDateOnly(new Date());
    const metaAds = await getMetaAdsSpend({ since, until });
    const { ENV: MetricsEnv } = await import('../config/env');
    const usdToKz = MetricsEnv.USD_TO_KZ_RATE;

    // Conversion rate
    const totalRequests = requests.length;
    const paidRequests = new Set(payments.filter(p => p.status === 'approved' && p.request_id).map(p => p.request_id)).size;
    const conversionRate = totalRequests > 0 ? (paidRequests / totalRequests * 100).toFixed(1) : '0.0';

    // Average time from request creation to payment approval
    const approvedPayments = payments.filter(p => p.status === 'approved' && p.approved_at);
    let avgApprovalHours = 0;
    if (approvedPayments.length > 0) {
      const totalHours = approvedPayments.reduce((sum, p) => {
        const created = new Date(p.created_at).getTime();
        const approved = new Date(p.approved_at!).getTime();
        return sum + (approved - created) / (1000 * 60 * 60);
      }, 0);
      avgApprovalHours = Math.round(totalHours / approvedPayments.length);
    }

    // Popular music styles
    const styleCount: Record<string, number> = {};
    requests.forEach(r => {
      const style = r.music_style || 'Outro';
      styleCount[style] = (styleCount[style] || 0) + 1;
    });
    const popularStyles = Object.entries(styleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([style, count]) => ({ style, count }));

    // Monthly revenue
    const monthlyRevenue: Record<string, number> = {};
    approvedPayments.forEach(p => {
      const month = new Date(p.approved_at!).toISOString().slice(0, 7);
      const num = parseMoneyAmount(p.amount);
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + num;
    });
    const revenueByMonth = Object.entries(monthlyRevenue)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, revenue]) => ({ month, revenue }));

    // Revenue by plan
    const planRevenue: Record<string, number> = {};
    approvedPayments.forEach(p => {
      const plan = p.plan || 'standard';
      const num = parseMoneyAmount(p.amount);
      planRevenue[plan] = (planRevenue[plan] || 0) + num;
    });
    const revenueByPlan = Object.entries(planRevenue)
      .map(([plan, revenue]) => ({ plan, revenue }));

    // Pending requests count (comprovativos a aguardar verificação)
    const pendingCount =
      requests.filter(r => r.status === 'payment_submitted').length +
      payments.filter(p => p.status === 'pending_verification').length;

    const totalRevenue = approvedPayments
      .reduce((sum, p) => sum + parseMoneyAmount(p.amount), 0);
    const adSpendKz = +(metaAds.spendUSD * usdToKz).toFixed(0);
    const netAfterAdsKz = +(totalRevenue - adSpendKz).toFixed(0);
    const roas = metaAds.spendUSD > 0 ? +((totalRevenue / usdToKz) / metaAds.spendUSD).toFixed(2) : null;

    // Conversion Funnel breakdown
    const lyricsReadyCount = requests.filter(r => ['lyrics_ready', 'payment_submitted', 'approved', 'delivered'].includes(r.status)).length;
    const paymentSubmittedCount = requests.filter(r => ['payment_submitted', 'approved', 'delivered'].includes(r.status)).length;
    const completedCount = requests.filter(r => ['approved', 'delivered'].includes(r.status)).length;
    const failedCount = requests.filter(r => r.status === 'failed').length;

    const funnel = {
      totalRequests,
      lyricsReady: lyricsReadyCount,
      paymentSubmitted: paymentSubmittedCount,
      completed: completedCount,
      failed: failedCount,
      step1To2Pct: totalRequests > 0 ? Number(((lyricsReadyCount / totalRequests) * 100).toFixed(1)) : 0,
      step2To3Pct: lyricsReadyCount > 0 ? Number(((paymentSubmittedCount / lyricsReadyCount) * 100).toFixed(1)) : 0,
      step3To4Pct: paymentSubmittedCount > 0 ? Number(((completedCount / paymentSubmittedCount) * 100).toFixed(1)) : 0,
      overallConversionPct: Number(conversionRate),
    };

    res.json({
      totalRequests,
      paidRequests,
      conversionRate: `${conversionRate}%`,
      avgApprovalHours,
      popularStyles,
      revenueByMonth,
      revenueByPlan,
      pendingCount,
      totalRevenue,
      funnel,
      metaAds: {
        ...metaAds,
        spendKz: adSpendKz,
        netAfterAdsKz,
        roas,
      },
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// P. Profitability
router.get('/profitability', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { ENV } = await import('../config/env');
    const sunoCostPerCreditUSD = ENV.SUNO_COST_PER_CREDIT_USD;
    const deepseekCostPerGenUSD = Number(process.env.DEEPSEEK_COST_PER_GENERATION_USD) || 0.0005;
    const claudeCostPerGenUSD = ENV.CLAUDE_COST_PER_GENERATION_USD;
    const monthlyFixedUSD = ENV.MONTHLY_FIXED_COST_USD;
    const usdToKz = ENV.USD_TO_KZ_RATE;

    const [paymentsRes, songsRes] = await Promise.all([
      supabase.from('payments').select('amount, plan, created_at, approved_at').eq('status', 'approved'),
      supabase.from('songs').select('id, created_at, request_id', { count: 'exact' }).not('lyrics', 'is', null)
    ]);

    const approvedPayments = paymentsRes.data || [];
    const songsGenerated = songsRes.data || [];
    const songCount = songsGenerated.length;

    // Revenue (convert from Kz to USD using rate)
    const totalRevenueKz = approvedPayments.reduce((sum, p) => {
      return sum + parseMoneyAmount(p.amount);
    }, 0);
    const totalRevenueUSD = +(totalRevenueKz / usdToKz).toFixed(2);
    const firstActivityAt = [...approvedPayments.map(p => p.created_at), ...songsGenerated.map(s => s.created_at)]
      .filter(Boolean)
      .sort()[0];
    const since = firstActivityAt ? isoDateOnly(new Date(firstActivityAt)) : isoDateOnly(new Date());
    const until = isoDateOnly(new Date());
    const metaAds = await getMetaAdsSpend({ since, until });
    const metaAdsCostUSD = metaAds.ok ? metaAds.spendUSD : 0;

    // Revenue by plan (in USD)
    const revenueByPlanBreakdown: Record<string, number> = {};
    approvedPayments.forEach(p => {
      const plan = p.plan || 'standard';
      revenueByPlanBreakdown[plan] = (revenueByPlanBreakdown[plan] || 0) + (parseMoneyAmount(p.amount) / usdToKz);
    });

    // Costs — each song: 24 Suno credits (12 start + 12 continue) + lyric generation
    const CREDITS_PER_SONG = 24;
    const sunoCreditsUsed = songCount * CREDITS_PER_SONG;
    const sunoCostUSD = +(sunoCreditsUsed * sunoCostPerCreditUSD).toFixed(2);
    const deepseekCostUSD = +(songCount * deepseekCostPerGenUSD).toFixed(2);
    const claudeCostUSD = +(songCount * claudeCostPerGenUSD).toFixed(2);
    const lyricCostUSD = Math.min(deepseekCostUSD, claudeCostUSD);
    const totalAPIcostUSD = +(sunoCostUSD + lyricCostUSD).toFixed(2);
    const totalCostsUSD = +(totalAPIcostUSD + monthlyFixedUSD + metaAdsCostUSD).toFixed(2);
    const apiCostPerSong = totalAPIcostUSD / Math.max(songCount, 1);

    // Profit
    const netProfitUSD = +(totalRevenueUSD - totalCostsUSD).toFixed(2);
    const profitMargin = totalRevenueUSD > 0 ? ((netProfitUSD / totalRevenueUSD) * 100).toFixed(1) : '0.0';

    // Cost per song breakdown
    const costPerSong = {
      suno: +((sunoCostPerCreditUSD * CREDITS_PER_SONG)).toFixed(2),
      deepseek: +(deepseekCostPerGenUSD).toFixed(4),
      claude: +(claudeCostPerGenUSD).toFixed(2),
      total: +((sunoCostPerCreditUSD * CREDITS_PER_SONG) + Math.min(deepseekCostPerGenUSD, claudeCostPerGenUSD)).toFixed(4),
    };

    // Profitability by plan
    const paymentsWithPlanCount = await supabase
      .from('payments')
      .select('plan, request_id')
      .eq('status', 'approved')
      .not('request_id', 'is', null);
    const planCount: Record<string, number> = {};
    if (paymentsWithPlanCount.data) {
      paymentsWithPlanCount.data.forEach((p: any) => {
        const pl = p.plan || 'standard';
        planCount[pl] = (planCount[pl] || 0) + 1;
      });
    }
    const totalPlanCount = Object.values(planCount).reduce((a: number, b: number) => a + b, 0);
    const planDetails = Object.entries(revenueByPlanBreakdown).map(([plan, rev]) => {
      const count = planCount[plan] || 0;
      const share = totalPlanCount > 0 ? count / totalPlanCount : 0;
      const cost = +((totalAPIcostUSD + metaAdsCostUSD) * share).toFixed(2);
      return {
        plan,
        revenueUSD: +rev.toFixed(2),
        costUSD: cost,
        profitUSD: +(rev - cost).toFixed(2),
        songCount: count,
      };
    });

    res.json({
      summary: {
        totalRevenueUSD,
        totalCostsUSD,
        netProfitUSD,
        margin: `${profitMargin}%`,
        songCount,
      },
      costs: {
        sunoUSD: sunoCostUSD,
        deepseekUSD: deepseekCostUSD,
        claudeUSD: claudeCostUSD,
        lyricUSD: +lyricCostUSD.toFixed(2),
        metaAdsUSD: +metaAdsCostUSD.toFixed(2),
        totalUSD: totalAPIcostUSD,
        fixedUSD: monthlyFixedUSD,
        costPerSong,
      },
      metaAds,
      byPlan: planDetails,
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// O. Export CSV
router.get('/export/:type', adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    let rows: Record<string, any>[] = [];
    let headers: string[] = [];

    const MAX_EXPORT_ROWS = 5000;

    if (type === 'requests') {
      const { data } = await supabase.from('song_requests').select('*, users(name, email)').order('created_at', { ascending: false }).limit(MAX_EXPORT_ROWS);
      if (data) {
        headers = ['ID', 'Criado em', 'Cliente', 'Email', 'Destinatário', 'Relação', 'Ocasião', 'Estilo', 'Status'];
        rows = data.map(r => ({
          ID: r.id, 'Criado em': r.created_at, Cliente: r.users?.name || '', Email: r.users?.email || '',
          Destinatário: r.recipient_name, Relação: r.relationship, Ocasião: r.occasion, Estilo: r.music_style, Status: r.status
        }));
      }
    } else if (type === 'payments') {
      const { data } = await supabase.from('payments').select('*, song_requests(recipient_name)').order('created_at', { ascending: false }).limit(MAX_EXPORT_ROWS);
      if (data) {
        headers = ['ID', 'Criado em', 'Email', 'Plano', 'Valor', 'Status', 'Destinatário', 'Notas'];
        rows = data.map(p => ({
          ID: p.id, 'Criado em': p.created_at, Email: p.user_email, Plano: p.plan,
          Valor: p.amount, Status: p.status, Destinatário: (p.song_requests as any)?.recipient_name || '', Notas: p.notes || ''
        }));
      }
    } else if (type === 'clients') {
      const { data } = await supabase.from('users').select('*, song_requests(id)').order('created_at', { ascending: false }).limit(MAX_EXPORT_ROWS);
      if (data) {
        headers = ['ID', 'Nome', 'Email', 'Telefone', 'Criado em', 'Total Pedidos'];
        rows = data.map(u => ({
          ID: u.id, Nome: u.name || '', Email: u.email || '', Telefone: u.phone || '',
          'Criado em': u.created_at || '', 'Total Pedidos': (u.song_requests as any[])?.length || 0
        }));
      }
    } else {
      return res.status(400).json({ success: false, error: 'Tipo inválido. Use: requests, payments, clients' });
    }

    const csvHeader = headers.join(',');
    const csvRows = rows.map(row => headers.map(h => {
      const val = String(row[h] || '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(','));
    const csv = [csvHeader, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// Q2. Delete request and all its resources from storage
router.delete('/request/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    // 1. Obter todos os caminhos dos ficheiros associados para apagar da Storage
    const { data: requestData, error: fetchError } = await supabase
      .from('song_requests')
      .select('*, songs(*), payments(*)')
      .eq('id', id)
      .single();

    if (fetchError || !requestData) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
    }

    // Coleções de remoções de Storage agrupadas por bucket
    const storageDeletions: Record<string, string[]> = {
      'photos': [],
      'voice-samples': [],
      'full-audio': [],
      'preview': [],
      'payment-proofs': []
    };

    // a) Foto da dedicatória
    if (requestData.photo_url) {
      const path = extractStoragePath(requestData.photo_url, 'photos');
      if (path) storageDeletions['photos'].push(path);
    }

    // b) Amostra de voz
    if (requestData.voice_sample_url) {
      const path = requestData.voice_sample_url.startsWith('http')
        ? extractStoragePath(requestData.voice_sample_url, 'voice-samples')
        : requestData.voice_sample_url;
      if (path) storageDeletions['voice-samples'].push(path);
    }

    // c) Ficheiros da música (full-audio e preview)
    const songs = Array.isArray(requestData.songs) ? requestData.songs : (requestData.songs ? [requestData.songs] : []);
    for (const song of songs) {
      if (song.audio_url) {
        const path = extractStoragePath(song.audio_url, 'full-audio');
        if (path) storageDeletions['full-audio'].push(path);
      }
      if (song.full_song_url) {
        const path = extractStoragePath(song.full_song_url, 'full-audio');
        if (path) storageDeletions['full-audio'].push(path);
      }
      if (song.preview_url) {
        const path = extractStoragePath(song.preview_url, 'preview');
        if (path) storageDeletions['preview'].push(path);
      }
    }

    // d) Comprovativos de pagamento
    const payments = Array.isArray(requestData.payments) ? requestData.payments : (requestData.payments ? [requestData.payments] : []);
    for (const payment of payments) {
      if (payment.proof_path) {
        storageDeletions['payment-proofs'].push(payment.proof_path);
      } else if (payment.proof_url) {
        const path = payment.proof_url.startsWith('storage:')
          ? payment.proof_url.replace(/^storage:/, '')
          : extractStoragePath(payment.proof_url, 'payment-proofs');
        if (path) storageDeletions['payment-proofs'].push(path);
      }
    }

    // Executar as remoções da Storage em background (não bloqueia a eliminação na BD se falhar)
    Promise.all(
      Object.entries(storageDeletions).map(async ([bucket, paths]) => {
        const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
        if (uniquePaths.length === 0) return;
        try {
          await deleteStorageFiles(bucket, uniquePaths);
          logInfo(`[Admin Delete] Ficheiros removidos do bucket "${bucket}" com sucesso`, { paths: uniquePaths });
        } catch (err: unknown) {
          logWarn(`[Admin Delete] Excepção ao remover do bucket "${bucket}"`, { error: err instanceof Error ? err.message : String(err) });
        }
      })
    ).catch(err => logError('[Admin Delete] Erro crítico no cleanup de storage', err));

    // 2. Apagar da base de dados (o CASCADE apagará registos associados nas tabelas songs e payments)
    const { error: deleteError } = await supabase
      .from('song_requests')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({ success: false, error: `Falha ao apagar pedido: ${deleteError.message}` });
    }

    logAdminAction({
      action: 'delete',
      entityType: 'song_requests',
      entityId: id,
      previousData: {
        recipient_name: requestData.recipient_name,
        email: requestData.users?.email,
        status: requestData.status
      },
      notes: 'Pedido e todos os ficheiros de Storage associados eliminados permanentemente.'
    });

    res.json({ success: true, message: 'Pedido e ficheiros associados apagados com sucesso.' });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// UTM Campaign Stats
router.get('/utm-stats', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const { data, error } = await supabase
      .from('song_requests')
      .select('utm_campaign, utm_source, utm_medium, utm_term, utm_content, status, payments(amount)')
      .not('utm_campaign', 'is', null)
      .neq('utm_campaign', '');

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const campaignMap = new Map<string, {
      campaign: string;
      source: string;
      medium: string;
      total_requests: number;
      converted: number;
      delivered: number;
      revenue: number;
    }>();

    for (const row of data || []) {
      const key = row.utm_campaign || 'Sem nome';
      const existing = campaignMap.get(key) || {
        campaign: key,
        source: row.utm_source || '—',
        medium: row.utm_medium || '—',
        total_requests: 0,
        converted: 0,
        delivered: 0,
        revenue: 0,
      };
      existing.total_requests++;
      if (row.status === 'approved' || row.status === 'delivered') {
        existing.converted++;
        const paymentArr = (row as any).payments as { amount: string | number }[] | undefined;
        const amount = parseMoneyAmount(paymentArr?.[0]?.amount);
        if (!isNaN(amount)) existing.revenue += amount;
      }
      if (row.status === 'delivered') existing.delivered++;
      campaignMap.set(key, existing);
    }

    const campaigns = Array.from(campaignMap.values())
      .sort((a, b) => b.total_requests - a.total_requests);

    res.json({ success: true, data: campaigns });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar estatísticas UTM';
    res.status(500).json({ success: false, error: message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Painel de Abandonados + envio WhatsApp (lazy para não afetar o boot)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/abandoned', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { range } = req.query as { range?: string };
    let rangeFilter: ((elapsedMs: number) => boolean) | null = null;
    if (range !== undefined && range !== '' && range !== 'all') {
      if (!isAbandonedTimeRange(range)) {
        return res.status(400).json({ success: false, error: 'Filtro de tempo inválido.' });
      }
      const matchRange = range;
      rangeFilter = (elapsedMs: number) => elapsedInRange(elapsedMs, matchRange);
    }

    const { data, error } = await supabase
      .from('song_requests')
      .select(
        'id, email, phone, recipient_name, created_at, status, abandoned_30min_sent_at, abandoned_24h_sent_at, abandoned_48h_sent_at, abandoned_72h_sent_at, abandoned_7d_sent_at, whatsapp_30min_sent_at, whatsapp_24h_sent_at, whatsapp_48h_sent_at, whatsapp_72h_sent_at, manual_contacted_at, users(name, phone)'
      )
      .in('status', ['lyrics_ready', 'lyrics_generating'])
      .is('deleted_at', null)
      .not('email', 'is', null)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });

    const appUrl = getAppUrl(req);
    const now = Date.now();
    const bucketMap: Record<string, { key: string; label: string; clients: unknown[] }> = {};
    for (const key of ABANDONED_BUCKET_ORDER) {
      bucketMap[key] = { key, label: bucketLabel(key), clients: [] };
    }

    for (const row of data || []) {
      const elapsedMs = now - new Date(row.created_at).getTime();
      const bucket = bucketForElapsed(elapsedMs);
      if (!bucket) continue;
      if (rangeFilter && !rangeFilter(elapsedMs)) continue;

      const phoneRaw = row.phone || row.users?.[0]?.phone;
      const resumePath = `/wizard?resume=${row.id}&step=payment`;
      const client = {
        id: row.id,
        recipientName: row.recipient_name || '',
        email: row.email,
        phone: phoneRaw || '',
        waDigits: normalizePhoneToE164(phoneRaw),
        status: row.status,
        createdAt: row.created_at,
        elapsedMs,
        reminders: [
          row.abandoned_30min_sent_at ? '30min' : null,
          row.abandoned_24h_sent_at ? '24h' : null,
          row.abandoned_48h_sent_at ? '48h' : null,
          row.abandoned_72h_sent_at ? '72h' : null,
          row.abandoned_7d_sent_at ? '7d' : null,
        ].filter((r): r is string => Boolean(r)),
        whatsappSent: [
          row.whatsapp_30min_sent_at ? '30min' : null,
          row.whatsapp_24h_sent_at ? '24h' : null,
          row.whatsapp_48h_sent_at ? '48h' : null,
          row.whatsapp_72h_sent_at ? '72h' : null,
        ].filter((r): r is string => Boolean(r)),
        manualContactedAt: row.manual_contacted_at,
        message: buildAbandonedMessage(bucket, row.recipient_name || '', `${appUrl}${resumePath}`),
        resumePath,
      };
      bucketMap[bucket].clients.push(client);
    }

    const buckets = ABANDONED_BUCKET_ORDER
      .map((key) => bucketMap[key])
      .filter((b) => b.clients.length > 0);

    const bucketedRows = (data || []).filter((row) => {
      const elapsedMs = now - new Date(row.created_at).getTime();
      if (bucketForElapsed(elapsedMs) === null) return false;
      if (rangeFilter && !rangeFilter(elapsedMs)) return false;
      return true;
    });

    let linked = false;
    let waPhone: string | null = null;
    let codeVerificationStatus: string | null = null;
    try {
      const wa = await import('../services/whatsappSender');
      const st = await wa.getLinkStatus();
      linked = !!st.linked;
      waPhone = typeof st.phone === 'string' ? st.phone : null;
      codeVerificationStatus = wa.getCachedVerificationStatus() || (await wa.getPhoneNumberVerificationStatus()).status || null;
    } catch {
      linked = false;
    }

    res.json({
      success: true,
      buckets,
      total: bucketedRows.length,
      notContacted: bucketedRows.filter((r) => !r.manual_contacted_at).length,
      linked,
      phone: waPhone,
      codeVerificationStatus,
    });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.get('/abandoned/send-status', adminAuth, async (req, res) => {
  try {
    const wa = await import('../services/whatsappSender');
    res.json({ success: true, progress: wa.getSendProgress() });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.post('/abandoned/:id/mark-contacted', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido.' });
    }
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });
    const { error } = await supabase
      .from('song_requests')
      .update({ manual_contacted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.get('/whatsapp/config-status', adminAuth, async (req, res) => {
  try {
    const wa = await import('../services/whatsappSender');
    const status = await wa.getConfigStatus();
    res.json({ success: true, ...status });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// POST /whatsapp/test-send — envia uma mensagem de teste real à Meta API para validar
// que WHATSAPP_API_TOKEN + PHONE_NUMBER_ID estão corretos e o número consegue enviar.
router.post('/whatsapp/test-send', adminAuth, async (req, res) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Indica o número de destino para o teste (campo "phone").' });
    }

    const wa = await import('../services/whatsappSender');
    if (!wa.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp API não configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente.'
      });
    }

    const { normalizePhoneToE164: normalize } = await import('../services/abandonedMessages');
    const normalized = normalize(phone.trim());
    if (!normalized) {
      return res.status(400).json({ success: false, error: `Número inválido: "${phone}". Usa formato E.164 (ex: +244922058136).` });
    }

    // Usa o template do bucket 30min ou hello_world como fallback universal.
    const { templateForBucket: tpl } = await import('../services/whatsappTemplates');
    const testTemplate = tpl('30min')?.name || 'hello_world';

    logInfo('[WhatsApp] Envio de teste iniciado', { phone: normalized, template: testTemplate });
    const result = await wa.sendTemplate(normalized, testTemplate, ['Teste', 'https://seubeat.com']);

    if (result.ok) {
      logInfo('[WhatsApp] Teste de envio bem-sucedido', { phone: normalized, messageId: result.messageId });
      return res.json({ success: true, messageId: result.messageId, phone: normalized, template: testTemplate });
    } else {
      logWarn('[WhatsApp] Teste de envio falhou', { phone: normalized, error: result.error, code: result.code });
      return res.status(422).json({ success: false, error: result.error, code: result.code, phone: normalized });
    }
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.get('/whatsapp/verification-status', adminAuth, async (req, res) => {
  try {
    const wa = await import('../services/whatsappSender');
    if (!wa.isConfigured()) {
      return res.status(400).json({ success: false, error: 'WhatsApp API não configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente.' });
    }
    const info = await wa.getPhoneNumberVerificationStatus();
    res.json({ success: true, ...info, cached: wa.getCachedVerificationStatus() });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// POST /whatsapp/request-code — pede o código de verificação (SMS/chamada) da Meta
// para o dono do número. Sem `code_verification_status: VERIFIED` a Cloud API
// bloqueia envios a clientes reais (#100 Invalid parameter).
router.post('/whatsapp/request-code', adminAuth, whatsappBulkLimiter, async (req, res) => {
  try {
    const { method, language } = (req.body || {}) as { method?: string; language?: string };
    const wa = await import('../services/whatsappSender');
    if (!wa.isConfigured()) {
      return res.status(400).json({ success: false, error: 'WhatsApp API não configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente.' });
    }
    const m: 'SMS' | 'VOICE' = method === 'VOICE' ? 'VOICE' : 'SMS';
    const lang = typeof language === 'string' && language ? language : 'en_US';
    const result = await wa.requestVerificationCode(m, lang);
    if (!result.ok) return res.status(422).json({ success: false, error: result.error });
    logInfo('[WhatsApp] Código de verificação pedido pelo admin', { method: m, language: lang });
    res.json({ success: true, method: m, language: lang });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// POST /whatsapp/verify-code — confirma o código recebido pelo dono do número.
router.post('/whatsapp/verify-code', adminAuth, whatsappBulkLimiter, async (req, res) => {
  try {
    const { code } = (req.body || {}) as { code?: string };
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, error: 'Indica o código de verificação recebido (campo "code").' });
    }
    const wa = await import('../services/whatsappSender');
    if (!wa.isConfigured()) {
      return res.status(400).json({ success: false, error: 'WhatsApp API não configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente.' });
    }
    const result = await wa.submitVerificationCode(code.trim());
    if (!result.ok) return res.status(422).json({ success: false, error: result.error });
    // Relê o estado para confirmar VERIFIED e atualizar a cache.
    const info = await wa.getPhoneNumberVerificationStatus();
    logInfo('[WhatsApp] Código de verificação confirmado pelo admin', { codeVerificationStatus: info.status });
    res.json({ success: true, codeVerificationStatus: info.status });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.post('/abandoned/send-bulk', adminAuth, whatsappBulkLimiter, async (req, res) => {
  try {
    const { requestIds } = req.body || {};
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    let query = supabase
      .from('song_requests')
      .select('id, phone, recipient_name, created_at, email, users(phone)')
      .in('status', ['lyrics_ready', 'lyrics_generating'])
      .is('deleted_at', null)
      .not('email', 'is', null)
      .order('created_at', { ascending: false });

    if (Array.isArray(requestIds) && requestIds.length > 0) {
      const ids = (requestIds as unknown[])
        .map((id) => String(id))
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
      if (!ids.length) return res.status(400).json({ success: false, error: 'IDs inválidos.' });
      query = query.in('id', ids);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });

    const appUrl = getAppUrl(req);
    const now = Date.now();
    const clients: BulkClient[] = [];
    for (const row of data || []) {
      const phone = normalizePhoneToE164(row.phone || row.users?.[0]?.phone);
      if (!phone) continue;
      const bucket = bucketForElapsed(now - new Date(row.created_at).getTime());
      if (!bucket) continue;
      // Só buckets com WhatsApp ativo (env WHATSAPP_ENABLED_BUCKETS, default 30min);
      // os restantes continuam só por email (outros schedulers).
      if (!enabledWhatsAppBuckets().includes(bucket)) continue;
      clients.push({
        requestId: row.id,
        phone,
        bucket,
        templateName: templateForBucket(bucket)?.name || '',
        params: [row.recipient_name || '', `${appUrl}/wizard?resume=${row.id}&step=payment`],
        message: buildAbandonedMessage(bucket, row.recipient_name || '', `${appUrl}/wizard?resume=${row.id}&step=payment`),
      });
    }

    if (!clients.length) {
      return res.status(400).json({ success: false, error: 'Nenhum cliente com telefone válido para enviar.' });
    }

    const wa = await import('../services/whatsappSender');
    if (wa.getSendProgress().running) {
      return res.status(409).json({ success: false, error: 'Já existe um envio em curso.' });
    }

    const linkStatus = await wa.getLinkStatus();
    if (!linkStatus.linked) {
      return res.status(400).json({ success: false, error: 'WhatsApp API não configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente.' });
    }

    // Corre em background — a request não bloqueia durante os atrasos da fila.
    // O progresso e eventuais erros são expostos via /abandoned/send-status.
    void wa.runSendBulk(clients).catch((err) => {
      logError('[WhatsApp] Erro ao iniciar campanha', err instanceof Error ? err : new Error(String(err)));
    });

    res.json({ success: true, started: true, total: clients.length });
  } catch (err: unknown) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// ─────────────────────────────────────────────────────────────
// Video Upsell: envio automático de offer pós-aprovação
// ─────────────────────────────────────────────────────────────

async function sendVideoUpsellOffer(
  requestId: string,
  songRequest: { recipient_name?: string; phone?: string; users?: { phone?: string }; user_email?: string; music_style?: string; video_upsell_sent_at?: string },
  req?: express.Request
) {
  try {
    // Dedupe: não enviar se já foi enviado
    if (songRequest.video_upsell_sent_at) return;

    const supabase = getAdminSupabase();
    if (!supabase) return;

    // Buscar título da música
    let songTitle = 'a tua música';
    try {
      const { data: songData } = await supabase
        .from('songs')
        .select('title')
        .eq('request_id', requestId)
        .single();
      if (songData?.title) songTitle = songData.title;
    } catch {}

    const upsellUrl = `${getAppUrl(req)}/video-upsell?requestId=${requestId}&email=${encodeURIComponent(songRequest.user_email || '')}`;

    // Marcar como enviado (antes do envio para evitar duplicatas por race condition)
    try {
      await supabase
        .from('song_requests')
        .update({ video_upsell_sent_at: new Date().toISOString() })
        .eq('id', requestId);
    } catch {}

    // Enviar WhatsApp
    const phone = songRequest.phone || songRequest.users?.phone || null;
    if (phone) {
      sendVideoUpsellWhatsApp({
        requestId,
        phone,
        recipientName: songRequest.recipient_name,
        songTitle,
      }).catch(err => logError('[Admin] Falha ao enviar offer de videoclipe (WhatsApp)', err, { requestId }));
    }

    // Enviar email
    if (songRequest.user_email) {
      sendVideoUpsellOfferEmail(songRequest.user_email, songRequest.recipient_name || '', songTitle, upsellUrl)
        .catch(err => logError('[Admin] Falha ao enviar offer de videoclipe (email)', err, { requestId }));
    }

    logInfo('[Admin] Video upsell offer enviada', { requestId, phone: !!phone, email: !!songRequest.user_email });
  } catch (err) {
    logError('[Admin] Falha ao enviar offer de videoclipe', err, { requestId });
  }
}

// ─── TEMPORÁRIO: Recuperar áudio de pedido falhado via taskId Suno ───────
// Remover após recuperar todos os pedidos órfãos.
router.post('/recover-audio', adminAuth, async (req, res) => {
  const { requestId, taskId } = (req.body || {}) as { requestId?: string; taskId?: string };
  try {
    if (!requestId || !taskId) {
      return res.status(400).json({ success: false, error: 'requestId e taskId obrigatórios' });
    }

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB não disponível' });

    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('id, request_id, mureka_status')
      .eq('request_id', requestId)
      .single();
    if (songErr || !song) return res.status(404).json({ success: false, error: 'Song não encontrada' });

    logInfo('[Admin] recover-audio: a consultar Suno', { requestId, taskId });

    const sunoResult = await querySunoTask(taskId);
    if (!sunoResult.audioUrl) {
      return res.status(400).json({ success: false, error: `Suno não tem áudio pronto. Status: ${sunoResult.status}` });
    }

    logInfo('[Admin] recover-audio: áudio encontrado no Suno', { requestId, taskId, audioUrl: sunoResult.audioUrl.slice(0, 80) });

    const persistResult = await persistGeneratedSunoAudio(song.id, taskId, sunoResult.audioUrl, { skipProcessing: false });

    await supabase.from('songs').update({
      audio_url: persistResult.fullAudioUrl,
      audio_url_v2: null,
      full_song_url: persistResult.fullAudioUrl,
      mureka_task_id: taskId,
      mureka_status: 'completed',
      duration: persistResult.duration,
      updated_at: new Date().toISOString(),
    }).eq('id', song.id);

    const { error: reqUpdateErr } = await supabase.from('song_requests').update({
      status: 'approved',
      deliver_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', requestId).eq('status', 'failed');

    if (reqUpdateErr) {
      logWarn('[Admin] recover-audio: falha ao atualizar request status', reqUpdateErr);
    }

    logInfo('[Admin] recover-audio: sucesso', { requestId, taskId, duration: persistResult.duration });
    res.json({ success: true, data: { fullAudioUrl: persistResult.fullAudioUrl, duration: persistResult.duration } });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : '';
    console.error('[Admin] recover-audio ERRO:', errMsg, errStack, { requestId, taskId });
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

export default router;
