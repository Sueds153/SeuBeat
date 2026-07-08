import express from 'express';
import { getAdminSupabase } from '../services/supabase';
import { adminAuth, adminLogin } from '../middleware/auth';
import { 
  requestProgressMap, 
  resumeSunoTaskWorkflow, 
  runBackgroundSunoWorkflow, 
  processSunoVoice 
} from '../services/workflow';
import { sendPersonalizedEmail, sendPaymentRejectionEmail } from '../services/email';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { publicErrorMessage } from '../utils/helpers';
import { logAdminAction } from '../utils/audit';
import { sendPurchaseEvent } from '../services/metaPixelCapi';

const router = express.Router();

// Login endpoint — devolve JWT
router.post('/login', (req, res) => adminLogin(req, res));

function safeMessage(err: any): string {
  return publicErrorMessage(err);
}

// A. Admin dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

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
      .reduce((sum, p) => {
        const num = typeof p.amount === 'number'
          ? p.amount
          : parseInt(String(p.amount || '0').replace(/\D/g, ''), 10) / 100;
        return sum + num;
      }, 0);

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
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// B. Admin list payments
router.get('/payments', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('payments')
      .select('*, song_requests(id, recipient_name, occasion, music_style, status, users(name, email, phone))')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, payments: data });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// B2. Get payment proof signed URL (bucket é privado)
router.get('/payment/:id/proof-url', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: payment, error } = await supabase
      .from('payments')
      .select('proof_path, proof_url')
      .eq('id', id)
      .single();

    if (error || !payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });

    let path = payment.proof_path;
    if (!path && payment.proof_url) {
      const match = payment.proof_url.match(/\/payment-proofs\/(.+)$/);
      path = match ? match[1] : null;
    }

    if (!path) return res.status(404).json({ error: 'Comprovativo não encontrado.' });

    const { data: signedData } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(path, 3600);

    if (!signedData?.signedUrl) return res.status(500).json({ error: 'Não foi possível gerar URL do comprovativo.' });

    res.json({ url: signedData.signedUrl });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// C. Admin approve payment
router.post('/payment/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

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
      return res.status(409).json({ error: 'Pagamento não encontrado ou já processado.' });
    }

    const songRequest = payment.song_requests as any;
    const requestId = payment.request_id;
    const songData = songRequest?.songs?.[0];
    const userEmail = songRequest?.users?.email;
    const letterText = songData?.letter_text || 'Preparámos uma dedicatória especial para si.';

    if (!requestId || !songData) {
      return res.status(400).json({ error: 'Dados da música em falta.' });
    }

    logAdminAction({ action: 'approve', entityType: 'payment', entityId: id, notes: notes || undefined });

    const numericAmount = parseInt(String(payment.amount || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const planName = (payment.plan || songRequest?.plan || 'standard') as string;
    sendPurchaseEvent({
      eventId: `payment-${id}-approved`,
      email: payment.user_email || userEmail || '',
      value: numericAmount,
      currency: 'AOA',
      contentName: planName,
    });

    const hasGeneratedAudio = !!(songData.full_song_url || songData.audio_url);
    const hasVoiceSample = !!songRequest.voice_sample_url;

    // Se já tem áudio E não tem voz clonada pendente, entrega diretamente
    if (hasGeneratedAudio && !hasVoiceSample) {
      await supabase.from('song_requests').update({ status: 'delivered' }).eq('id', requestId);
      if (userEmail) {
        const slug = (songRequest.recipient_name || 'especial').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const personalizedUrl = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${songData.id}`;
        await sendPersonalizedEmail(userEmail, songRequest.recipient_name, personalizedUrl, letterText);
        return res.json({ success: true, message: 'Pagamento aprovado. Música entregue por e-mail.' });
      }
      return res.json({ success: true, message: 'Pagamento aprovado. Música entregue (email do cliente não disponível).' });
    }

    // Precisa de gerar áudio ou processar voz clonada → workflow Suno

    // Evita iniciar um segundo workflow se já existe um em andamento
    const isProcessing = songData.mureka_status === 'generating' || songData.mureka_status === 'processing' || (songData.mureka_task_id && !hasGeneratedAudio);
    if (isProcessing) {
      return res.json({ success: true, message: 'Música já está em processamento. A entrega será automática quando concluída.', alreadyProcessing: true });
    }

    await supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', requestId);
    runBackgroundSunoWorkflow(requestId, songData.id, songRequest.music_style || 'Kizomba', songData.title || 'Música SeuBeat', songData.lyrics || []).catch(err => logError('[Admin] Background Suno workflow falhou apos aprovacao', err, { requestId }));
    return res.json({ success: true, message: 'Pagamento aprovado. Música em processamento no Suno.', hasVoiceSample });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// D. Admin reject payment
router.post('/payment/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: payment } = await supabase.from('payments').select('user_email, request_id, status, proof_path').eq('id', id).single();
    await supabase.from('payments').update({ status: 'rejected', notes: notes || null }).eq('id', id);

    logAdminAction({ action: 'reject', entityType: 'payment', entityId: id, previousData: { status: payment?.status }, notes: notes || undefined });

    if (payment?.request_id) {
      await supabase.from('song_requests').update({ status: 'payment_rejected' }).eq('id', payment.request_id);
    }

    if (payment?.user_email) {
      sendPaymentRejectionEmail(payment.user_email, notes).catch(err => logError('[Admin] Falha ao enviar email de rejeicao', err, { userId: payment.user_email }));
    }

    res.json({ success: true, message: 'Pagamento rejeitado.' });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// E. Admin list requests
router.get('/requests', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('song_requests')
      .select('*, users(name, email, phone), songs(id, title, audio_url, mureka_status, created_at, letter_text, lyrics), payments(plan, amount, status)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, requests: data });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// F. Admin list songs
router.get('/songs', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('songs')
      .select('*, song_requests(recipient_name, music_style, occasion, users(name, email))')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, songs: data });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// G. Admin manual Mureka
router.post('/song/:id/generate-music', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: songData, error } = await supabase
      .from('songs')
      .select('*, song_requests(music_style)')
      .eq('id', id)
      .single();

    if (error || !songData) return res.status(404).json({ error: 'Música não encontrada' });

    if (songData.request_id && songData.mureka_task_id && !songData.audio_url) {
      resumeSunoTaskWorkflow(songData.request_id, id, songData.mureka_task_id).catch(err => logError('[Admin] Resume Suno task falhou', err, { songId: id }));
      return res.json({ success: true, message: 'Verificação da task Suno existente iniciada.' });
    }

    if (!songData.request_id) return res.status(400).json({ error: 'Musica sem pedido associado.' });

    await supabase.from('songs').update({ mureka_status: 'generating' }).eq('id', id);
    await supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', songData.request_id);

    runBackgroundSunoWorkflow(
      songData.request_id,
      id,
      (songData.song_requests as any)?.music_style || 'Kizomba',
      songData.title || 'Musica SeuBeat',
      songData.lyrics || []
    ).catch(err => logError('[Admin] Background Suno falhou apos iniciar', err, { songId: id }));

    res.json({ success: true, message: 'Geração Suno iniciada em background.' });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// I. API Credits
router.get('/credits', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [sunoResult, claudeResult, openaiResult, geminiResult, emailResult, songsRes, songsMonthRes, songsByMonthRes] = await Promise.all([
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
        } catch (e: any) { return { ok: false, error: e.message }; }
      })(),
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
        } catch (e: any) {
          if (e.message?.includes('quota') || e.message?.includes('limit') || e.message?.includes('429')) {
            return { ok: true, quota_exceeded: true, error: e.message, model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022', lastCheck: now.toISOString() };
          }
          return { ok: false, error: e.message };
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
        } catch (e: any) {
          if (e.message?.includes('quota') || e.message?.includes('limit') || e.message?.includes('429') || e.message?.includes('insufficient')) {
            return { ok: true, quota_exceeded: true, error: e.message, model: process.env.OPENAI_MODEL || 'gpt-4o', lastCheck: now.toISOString() };
          }
          return { ok: false, error: e.message };
        }
      })(),
      // Gemini live check
      (async () => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY em falta' };
        try {
          const genAI = new GoogleGenAI({ apiKey });
          const response = await genAI.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            config: { maxOutputTokens: 1 },
          });
          return { ok: true, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash', lastCheck: now.toISOString() };
        } catch (e: any) {
          if (e.message?.includes('quota') || e.message?.includes('limit') || e.message?.includes('429') || e.message?.includes('insufficient') || e.message?.includes('RATE_LIMIT') || e.message?.includes('dailyLimitExceeded') || e.message?.includes('quotaExceeded')) {
            return { ok: true, quota_exceeded: true, error: e.message, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash', lastCheck: now.toISOString() };
          }
          return { ok: false, error: e.message };
        }
      })(),
      // Brevo SMTP live check
      (async () => {
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER;
        if (!host || !user) return { ok: false, error: 'SMTP_HOST ou SMTP_USER em falta' };
        return { ok: true, provider: 'Brevo', host, lastCheck: now.toISOString() };
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
    const estCreditsUsed = totalSongs * 2;
    const estSongsRemaining = sunoCredits > 0 ? Math.floor(sunoCredits / 2) : 0;
    const sunoCostPerCredit = Number(process.env.SUNO_COST_PER_CREDIT_USD) || 0.15;
    const claudeCostPerGen = Number(process.env.CLAUDE_COST_PER_GENERATION_USD) || 0.03;
    const openaiCostPerGen = Number(process.env.OPENAI_COST_PER_GENERATION_USD) || 0.01;
    const estSunoCost = +(estCreditsUsed * sunoCostPerCredit).toFixed(2);
    const estClaudeCost = +(totalSongs * claudeCostPerGen).toFixed(2);
    const estOpenAICost = +(totalSongs * openaiCostPerGen).toFixed(2);
    const estTotalCost = +(estSunoCost + estClaudeCost + estOpenAICost).toFixed(2);

    res.json({
      suno: sunoResult,
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
          claudeUSD: estClaudeCost,
          openaiUSD: estOpenAICost,
          totalUSD: estTotalCost,
          perSong: +((sunoCostPerCredit * 2) + Math.min(claudeCostPerGen, openaiCostPerGen)).toFixed(2),
        },
      },
    });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// J. Force status override
const VALID_STATUSES: Record<string, string[]> = {
  song_requests: ['lyrics_generating', 'lyrics_ready', 'music_processing', 'voice_processing', 'music_ready', 'delivered', 'failed', 'payment_rejected', 'payment_submitted'],
  payments: ['pending_verification', 'approved', 'rejected'],
  songs: ['not_started', 'generating', 'processing', 'completed', 'failed']
};

router.post('/request/:id/force-status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { table, status, field } = req.body;

    if (!table || !status) {
      return res.status(400).json({ error: 'Parâmetros "table" e "status" são obrigatórios.' });
    }

    const allowed = VALID_STATUSES[table];
    if (!allowed) {
      return res.status(400).json({ error: `Tabela inválida. Use: ${Object.keys(VALID_STATUSES).join(', ')}` });
    }

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status inválido para "${table}". Permitidos: ${allowed.join(', ')}` });
    }

    const statusField = field || (table === 'songs' ? 'mureka_status' : 'status');

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from(table)
      .update({ [statusField]: status })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: safeMessage(error) });
    if (!data) return res.status(404).json({ error: 'Registo não encontrado.' });

    logInfo('[Admin] Status forçado manualmente', { table, id, status, field: statusField });
    logAdminAction({ action: 'force_status', entityType: table, entityId: id, previousData: { [statusField]: data[statusField] || data.status }, newData: { [statusField]: status }, notes: `Forçado para ${status}` });

    if (table === 'song_requests' && status === 'delivered') {
      const { data: songRequest } = await supabase
        .from('song_requests')
        .select('*, songs(*), users(*)')
        .eq('id', id)
        .single();

      if (songRequest?.users?.email && songRequest?.songs?.[0]) {
        const song = songRequest.songs[0];
        const slug = (songRequest.recipient_name || 'especial')
          .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const url = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${song.id}`;
        sendPersonalizedEmail(songRequest.users.email, songRequest.recipient_name, url, song.letter_text || 'Dedicatória.')
          .catch(err => logWarn('[Admin] Falha ao enviar email após force-status delivered', { error: err?.message }));
      }
    }

    res.json({ success: true, message: `Status atualizado para "${status}" em "${table}".`, data });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// H. Diagnostics
router.get('/diagnostics', adminAuth, async (req, res) => {
  try {
    const [supabaseDiag, claudeDiag, openaiDiag, geminiDiag, sunoDiag, sunoVoiceDiag, emailDiag] = await Promise.all([
      (async () => {
        const supabase = getAdminSupabase();
        if (!supabase) return { ok: false, error: 'Cliente não inicializado' };
        try {
          const { data, error } = await supabase.storage.listBuckets();
          if (error) return { ok: false, error: error.message };
          return { ok: true, buckets: data.map(b => ({ name: b.name, public: b.public })) };
        } catch (e: any) { return { ok: false, error: e.message }; }
      })(),
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
        } catch (e: any) { return { ok: false, error: e.message }; }
      })(),
      (async () => {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return { ok: false, error: 'OPENAI_API_KEY em falta' };
        try {
          const openai = new OpenAI({ apiKey: key });
          await openai.models.list({ timeout: 5000 });
          return { ok: true };
        } catch (e: any) { return { ok: false, error: e.message }; }
      })(),
      // Gemini diagnostic
      (async () => {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return { ok: false, error: 'GEMINI_API_KEY em falta' };
        try {
          const genAI = new GoogleGenAI({ apiKey: key });
          const response = await genAI.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            config: { maxOutputTokens: 1 },
          });
          return { ok: !!(response && response.text) };
        } catch (e: any) { return { ok: false, error: e.message }; }
      })(),
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: 'SUNO_API_KEY em falta' };
        try {
          const creditsRes = await fetch('https://api.sunoapi.org/api/v1/generate/credit', { headers: { 'Authorization': `Bearer ${key}` } });
          if (!creditsRes.ok) return { ok: false, error: `HTTP ${creditsRes.status}` };
          const creditsData = await creditsRes.json();
          return { ok: true, credits: creditsData.data || 0 };
        } catch (e: any) { return { ok: false, error: e.message }; }
      })(),
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: 'SUNO_API_KEY em falta' };
        try {
          const res = await fetch('https://api.sunoapi.org/api/v1/voice/record-info?taskId=ping_test', { headers: { 'Authorization': `Bearer ${key}` } });
          return { ok: res.status !== 401 && res.status !== 403 };
        } catch (e: any) { return { ok: false, error: e.message }; }
      })(),
      (async () => {
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER;
        if (!host || !user) return { ok: false, error: 'SMTP_HOST ou SMTP_USER em falta' };
        return { ok: true, provider: 'Brevo', host };
      })()
    ]);

    const mem = process.memoryUsage();
    res.json({
      supabase: supabaseDiag,
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
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

router.post('/request/:id/retry', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*)').eq('id', id).single();
    if (!requestData) return res.status(404).json({ error: 'Pedido não encontrado' });
    const songData = requestData.songs?.[0];
    if (!songData) return res.status(400).json({ error: 'Música associada em falta.' });

    if (songData.mureka_task_id && !songData.audio_url) {
      resumeSunoTaskWorkflow(id, songData.id, songData.mureka_task_id).catch(err => logError('[Admin] Resume Suno task falhou no retry', err, { requestId: id }));
      return res.json({ success: true, message: 'Retomado.' });
    }

    await supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', id);
    await supabase.from('songs').update({ mureka_status: 'generating' }).eq('id', songData.id);
    runBackgroundSunoWorkflow(id, songData.id, requestData.music_style || 'Kizomba', songData.title || 'Música SeuBeat', songData.lyrics || []).catch(err => logError('[Admin] Background Suno falhou no retry', err, { requestId: id }));
    res.json({ success: true, message: 'Reiniciado.' });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

router.post('/request/:id/force-voice', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*)').eq('id', id).single();
    if (!requestData || !requestData.songs?.[0]) return res.status(404).json({ error: 'Pedido ou música não encontrada' });
    if (!requestData.voice_sample_url) return res.status(400).json({ error: 'Sem amostra de voz.' });

    await supabase.from('song_requests').update({ status: 'voice_processing' }).eq('id', id);
    const voiceSampleUrl = requestData.voice_sample_url;
    processSunoVoice(id, requestData.songs[0].id, voiceSampleUrl).catch(err => logError('[Admin] Force Suno Voice falhou', err, { requestId: id }));
    res.json({ success: true, message: 'Processamento de voz Suno Voice forçado.' });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

router.post('/request/:id/resend-email', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*), users(*)').eq('id', id).single();
    if (!requestData || !requestData.songs?.[0] || !requestData.users?.email) return res.status(404).json({ error: 'Dados insuficientes.' });

    const slug = (requestData.recipient_name || 'especial').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const personalizedUrl = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${requestData.songs[0].id}`;
    await sendPersonalizedEmail(requestData.users.email, requestData.recipient_name, personalizedUrl, requestData.songs[0].letter_text || 'Dedicatória.');
    res.json({ success: true, message: 'Email reenviado.' });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

router.post('/song/:id/edit-lyrics', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, lyrics, letterText } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const lyricsArray = Array.isArray(lyrics) ? lyrics : typeof lyrics === 'string' ? lyrics.split('\n').filter((l: string) => l.trim().length > 0) : [];
    const { data, error } = await supabase.from('songs').update({ title, lyrics: lyricsArray, letter_text: letterText || null }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, song: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/song/:id/upload-audio', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'ID inválido.' });
    const { audioBase64, audioFilename, audioMimeType } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    if (typeof audioBase64 !== 'string') return res.status(400).json({ error: 'Áudio ausente ou inválido.' });
    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 50 * 1024 * 1024) return res.status(400).json({ error: 'Áudio demasiado grande. Máx. 50MB.' });
    const sanitizedAudioFilename = String(audioFilename || 'manual_audio.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `songs/${Date.now()}_${sanitizedAudioFilename}`;

    await supabase.storage.from('full-audio').upload(filename, buffer, { contentType: audioMimeType || 'audio/mpeg', upsert: true });
    const { data: urlData } = supabase.storage.from('full-audio').getPublicUrl(filename);
    const fullAudioUrl = urlData?.publicUrl || '';

    const previewFilename = `previews/${id}_preview.mp3`;
    await supabase.storage.from('preview').upload(previewFilename, buffer, { contentType: 'audio/mpeg', upsert: true });
    const { data: previewUrlData } = supabase.storage.from('preview').getPublicUrl(previewFilename);

    await supabase.from('songs').update({ audio_url: fullAudioUrl, full_song_url: fullAudioUrl, mureka_status: 'completed', preview_url: previewUrlData?.publicUrl || null }).eq('id', id);
    const { data: songData } = await supabase.from('songs').select('request_id').eq('id', id).single();
    if (songData?.request_id) {
      await supabase.from('song_requests').update({ status: 'music_ready' }).eq('id', songData.request_id);
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

router.get('/clients', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const { data, error } = await supabase.from('users').select('*, song_requests(id, status, created_at)').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, clients: data });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
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
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// Q. Undo last admin action for an entity
router.post('/undo', adminAuth, async (req, res) => {
  try {
    const { entityType, entityId, action } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    if (!entityType || !entityId || !action) {
      return res.status(400).json({ error: 'Parâmetros "entityType", "entityId" e "action" obrigatórios.' });
    }

    if (action === 'approve' || action === 'reject') {
      if (entityType === 'payment') {
        await supabase.from('payments').update({ status: 'pending_verification', approved_at: null, notes: 'Desfeito pelo admin' }).eq('id', entityId);
        const { data: pay } = await supabase.from('payments').select('request_id').eq('id', entityId).single();
        if (pay?.request_id) {
          await supabase.from('song_requests').update({ status: 'payment_submitted' }).eq('id', pay.request_id);
        }
        logAdminAction({ action: 'undo', entityType: 'payment', entityId, notes: `Undo: ${action}` });
        return res.json({ success: true, message: `Acção de "${action}" revertida. Pagamento voltou a "pending_verification".` });
      }
    }

    if (action === 'force_status') {
      const { previousStatus } = req.body;
      if (!previousStatus) return res.status(400).json({ error: 'Força-status undo requer "previousStatus".' });
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

    res.status(400).json({ error: 'Combinação entityType/action não suportada para undo.' });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// K. Update request style/voice
router.post('/request/:id/update-style', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { music_style, voice_type } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const updateData: Record<string, string> = {};
    if (music_style) updateData.music_style = music_style;
    if (voice_type) updateData.voice_type = voice_type;
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'Nada para atualizar.' });
    const { data, error } = await supabase.from('song_requests').update(updateData).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, data });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// L. Regenerate lyrics (re-call Claude)
router.post('/request/:id/regenerate-lyrics', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(id, title, lyrics, letter_text), users(name, email, phone)')
      .eq('id', id)
      .single();

    if (reqError || !requestData) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!requestData.songs?.[0]) return res.status(400).json({ error: 'Música associada em falta.' });

    const existingSong = requestData.songs[0];
    const formData = {
      userNick: requestData.users?.name || 'Autor',
      recipientName: requestData.recipient_name,
      recipientRelation: requestData.relationship,
      recipientNick: '',
      occasion: requestData.occasion,
      musicStyle: requestData.music_style,
      voiceType: requestData.voice_type,
      unforgettableMemory: requestData.memory || '',
      whatMakesSpecial: requestData.special_traits || '',
      onlySheDoes: '',
      whereItHappened: '',
      messageFromTheHeart: requestData.heart_message || '',
      desiredEmotion: 'Emocionante',
      language: requestData.language || 'português'
    };

    const { generateLyrics } = await import('../services/ai');
    const { result: parsedData } = await generateLyrics(formData);

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

    if (songError) return res.status(500).json({ error: safeMessage(songError) });
    res.json({ success: true, song: updatedSong });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// M. Request event logs
router.get('/request/:id/logs', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*), payments(*)').eq('id', id).single();
    if (!requestData) return res.status(404).json({ error: 'Pedido não encontrado' });

    const logs: { timestamp: string; event: string; detail: string }[] = [];
    const push = (ts: string, event: string, detail: string) => logs.push({ timestamp: ts, event, detail });

    if (requestData.created_at) push(requestData.created_at, 'Pedido Criado', `Por ${requestData.users?.name || '—'} (${requestData.users?.email || '—'})`);
    if (requestData.status) push(requestData.updated_at || requestData.created_at, `Status: ${requestData.status}`, '');
    if (requestData.songs?.[0]?.created_at) push(requestData.songs[0].created_at, 'Letra Gerada', `Título: ${requestData.songs[0].title}`);
    if (requestData.payments?.length) {
      requestData.payments.forEach((p: any) => {
        push(p.created_at, 'Pagamento Submetido', `${p.plan} — ${p.amount}`);
        if (p.status === 'approved') push(p.approved_at || p.created_at, 'Pagamento Aprovado', '');
        if (p.status === 'rejected') push(p.updated_at || p.created_at, 'Pagamento Rejeitado', p.notes || '');
      });
    }
    if (requestData.songs?.[0]?.audio_url) push(requestData.songs[0].created_at, 'Áudio Gerado', 'URL do áudio disponível');

    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json({ success: true, logs });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// N. Advanced metrics
router.get('/metrics', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const [requestsRes, paymentsRes, songsRes] = await Promise.all([
      supabase.from('song_requests').select('id, status, created_at, music_style', { count: 'exact' }),
      supabase.from('payments').select('id, status, amount, plan, created_at, approved_at'),
      supabase.from('songs').select('id, created_at, request_id')
    ]);

    const requests = requestsRes.data || [];
    const payments = paymentsRes.data || [];
    const songs = songsRes.data || [];

    // Conversion rate
    const totalRequests = requests.length;
    const paidRequests = new Set(payments.filter(p => p.status === 'approved').map(p => p.id)).size;
    const conversionRate = totalRequests > 0 ? (paidRequests / totalRequests * 100).toFixed(1) : '0.0';

    // Average time to delivery
    const approvedPayments = payments.filter(p => p.status === 'approved' && p.approved_at);
    let avgHours = 0;
    if (approvedPayments.length > 0) {
      const totalHours = approvedPayments.reduce((sum, p) => {
        const created = new Date(p.created_at).getTime();
        const approved = new Date(p.approved_at!).getTime();
        return sum + (approved - created) / (1000 * 60 * 60);
      }, 0);
      avgHours = Math.round(totalHours / approvedPayments.length);
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
      const num = typeof p.amount === 'number' ? p.amount : parseInt(String(p.amount || '0').replace(/\D/g, ''), 10) / 100;
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + num;
    });
    const revenueByMonth = Object.entries(monthlyRevenue)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, revenue]) => ({ month, revenue }));

    // Revenue by plan
    const planRevenue: Record<string, number> = {};
    approvedPayments.forEach(p => {
      const plan = p.plan || 'standard';
      const num = typeof p.amount === 'number' ? p.amount : parseInt(String(p.amount || '0').replace(/\D/g, ''), 10) / 100;
      planRevenue[plan] = (planRevenue[plan] || 0) + num;
    });
    const revenueByPlan = Object.entries(planRevenue)
      .map(([plan, revenue]) => ({ plan, revenue }));

    // Pending requests count
    const pendingCount = requests.filter(r => r.status === 'payment_submitted' || r.status === 'pending_verification').length;

    res.json({
      totalRequests,
      paidRequests,
      conversionRate: `${conversionRate}%`,
      avgDeliveryHours: avgHours,
      popularStyles,
      revenueByMonth,
      revenueByPlan,
      pendingCount,
      totalRevenue: approvedPayments
        .reduce((sum, p) => {
          const num = typeof p.amount === 'number' ? p.amount : parseInt(String(p.amount || '0').replace(/\D/g, ''), 10) / 100;
          return sum + num;
        }, 0)
    });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// P. Profitability
router.get('/profitability', adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { ENV } = await import('../config/env');
    const sunoCostPerCreditUSD = ENV.SUNO_COST_PER_CREDIT_USD;
    const claudeCostPerGenUSD = ENV.CLAUDE_COST_PER_GENERATION_USD;
    const monthlyFixedUSD = ENV.MONTHLY_FIXED_COST_USD;

    const [paymentsRes, songsRes] = await Promise.all([
      supabase.from('payments').select('amount, plan, created_at, approved_at').eq('status', 'approved'),
      supabase.from('songs').select('id, created_at, request_id', { count: 'exact' }).not('lyrics', 'is', null)
    ]);

    const approvedPayments = paymentsRes.data || [];
    const songsGenerated = songsRes.data || [];
    const songCount = songsGenerated.length;

    // Revenue (convert from Kz cents to USD using rate)
    const totalRevenueKz = approvedPayments.reduce((sum, p) => {
      const num = typeof p.amount === 'number' ? p.amount : parseInt(String(p.amount || '0').replace(/\D/g, ''), 10) / 100;
      return sum + num;
    }, 0);
    const totalRevenueUSD = +(totalRevenueKz / 900).toFixed(2);

    // Revenue by plan (in USD)
    const revenueByPlanBreakdown: Record<string, number> = {};
    approvedPayments.forEach(p => {
      const plan = p.plan || 'standard';
      const num = typeof p.amount === 'number' ? p.amount : parseInt(String(p.amount || '0').replace(/\D/g, ''), 10) / 100;
      revenueByPlanBreakdown[plan] = (revenueByPlanBreakdown[plan] || 0) + (num / 900);
    });

    // Costs — each song: 2 Suno credits (generate + continue) + 1 Claude generation
    const sunoCreditsUsed = songCount * 2;
    const sunoCostUSD = +(sunoCreditsUsed * sunoCostPerCreditUSD).toFixed(2);
    const claudeCostUSD = +(songCount * claudeCostPerGenUSD).toFixed(2);
    const totalAPIcostUSD = +(sunoCostUSD + claudeCostUSD).toFixed(2);
    const totalCostsUSD = +(totalAPIcostUSD + monthlyFixedUSD).toFixed(2);
    const apiCostPerSong = totalAPIcostUSD / Math.max(songCount, 1);

    // Profit
    const netProfitUSD = +(totalRevenueUSD - totalCostsUSD).toFixed(2);
    const profitMargin = totalRevenueUSD > 0 ? ((netProfitUSD / totalRevenueUSD) * 100).toFixed(1) : '0.0';

    // Cost per song breakdown
    const costPerSong = {
      suno: +((sunoCostPerCreditUSD * 2)).toFixed(2),
      claude: +(claudeCostPerGenUSD).toFixed(2),
      total: +((sunoCostPerCreditUSD * 2) + claudeCostPerGenUSD).toFixed(2),
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
      const cost = +(totalAPIcostUSD * share).toFixed(2);
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
        claudeUSD: claudeCostUSD,
        totalUSD: totalAPIcostUSD,
        fixedUSD: monthlyFixedUSD,
        costPerSong,
      },
      byPlan: planDetails,
    });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

// O. Export CSV
router.get('/export/:type', adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

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
      return res.status(400).json({ error: 'Tipo inválido. Use: requests, payments, clients' });
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
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

export default router;
