import express from 'express';
import { getSupabase } from '../services/supabase';
import { adminAuth } from '../middleware/auth';
import { 
  requestProgressMap, 
  resumeSunoTaskWorkflow, 
  runBackgroundSunoWorkflow, 
  processSunoVoice 
} from '../services/workflow';
import { sendPersonalizedEmail, sendPaymentRejectionEmail } from '../services/email';
import Anthropic from '@anthropic-ai/sdk';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { publicErrorMessage } from '../utils/helpers';

const router = express.Router();

function safeMessage(err: any): string {
  return publicErrorMessage(err);
}

// A. Admin dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('payments')
      .select('*, song_requests(id, recipient_name, occasion, music_style, status, users(name, email))')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, payments: data });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// C. Admin approve payment
router.post('/payment/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const supabase = getSupabase();
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

    const hasGeneratedAudio = !!(songData.full_song_url || songData.audio_url);

    if (!hasGeneratedAudio) {
      // Gera a melodia pelo Suno (incluindo Suno Voice se houver amostra)
      await supabase.from('song_requests').update({ status: 'music_processing' }).eq('id', requestId);
      runBackgroundSunoWorkflow(requestId, songData.id, songRequest.music_style || 'Kizomba', songData.title || 'Música SeuBeat', songData.lyrics || []).catch(err => logError('[Admin] Background Suno workflow falhou apos aprovacao', err, { requestId }));
      return res.json({ success: true, message: 'Pagamento aprovado. Música em processamento no Suno.', hasVoiceSample: !!songRequest.voice_sample_url });
    } else {
      // Se a música já existe, entrega diretamente
      await supabase.from('song_requests').update({ status: 'delivered' }).eq('id', requestId);
      if (userEmail) {
        const slug = (songRequest.recipient_name || 'especial').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const personalizedUrl = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${songData.id}`;
        await sendPersonalizedEmail(userEmail, songRequest.recipient_name, personalizedUrl, letterText);
      }
      return res.json({ success: true, message: 'Pagamento aprovado. Música entregue por e-mail.', hasVoiceSample: !!songRequest.voice_sample_url });
    }
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// D. Admin reject payment
router.post('/payment/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: payment } = await supabase.from('payments').select('user_email, request_id').eq('id', id).single();
    await supabase.from('payments').update({ status: 'rejected', notes: notes || null }).eq('id', id);

    if (payment?.request_id) {
      await supabase.from('song_requests').update({ status: 'payment_rejected' }).eq('id', payment.request_id);
    }

    if (payment?.user_email) {
      sendPaymentRejectionEmail(payment.user_email, notes).catch(err => logWarn('[Admin] Falha ao enviar email de rejeicao', { userId: payment.user_email, error: err?.message || String(err) }));
    }

    res.json({ success: true, message: 'Pagamento rejeitado.' });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// E. Admin list requests
router.get('/requests', adminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
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

router.get('/progress', adminAuth, (req, res) => {
  res.json(requestProgressMap);
});

// H. Diagnostics
router.get('/diagnostics', adminAuth, async (req, res) => {
  try {
    const [supabaseDiag, claudeDiag, sunoDiag, sunoVoiceDiag, emailDiag] = await Promise.all([
      (async () => {
        const supabase = getSupabase();
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

    res.json({ supabase: supabaseDiag, claude: claudeDiag, suno: sunoDiag, sunoVoice: sunoVoiceDiag, email: emailDiag });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

router.post('/request/:id/retry', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*)').eq('id', id).single();
    if (!requestData || !requestData.songs?.[0]) return res.status(404).json({ error: 'Pedido ou música não encontrada' });
    if (!requestData.voice_sample_url) return res.status(400).json({ error: 'Sem amostra de voz.' });

    await supabase.from('song_requests').update({ status: 'voice_processing' }).eq('id', id);
    const voiceSampleUrl = requestData.voice_sample_url;
    processSunoVoice(id, requestData.songs[0].id, voiceSampleUrl).catch(err => logError('[Admin] Force Suno Voice falhou', err, { requestId: id }));
    res.json({ success: true, message: 'Processamento de voz Suno Voice forçado.' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/request/:id/resend-email', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });
    const { data, error } = await supabase.from('users').select('*, song_requests(id, status, created_at)').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: safeMessage(error) });
    res.json({ success: true, clients: data });
  } catch (err: any) { res.status(500).json({ error: safeMessage(err) }); }
});

export default router;
