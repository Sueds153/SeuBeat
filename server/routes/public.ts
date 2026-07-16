import express from 'express';
import { randomUUID } from 'node:crypto';
import { getAdminSupabase } from '../services/supabase';
import { generateLyrics } from '../services/ai';
import { sendPersonalizedEmail, sendConfirmationEmail } from '../services/email';
import DOMPurify from 'isomorphic-dompurify';

function sanitize(str: string): string {
  return DOMPurify.sanitize(str.trim().slice(0, 5000));
}
import { setProgress, updateRequestStatus } from '../services/workflow';
import { publicErrorMessage, getAppUrl } from '../utils/helpers';
import { 
  GenerateLyricsSchema, 
  UpdateLyricsSchema,
  validateInput 
} from '../middleware/validation';
import { 
  globalLimiter,
  generateLyricsLimiter, 
  emailLimiter,
  getSongLimiter,
  paymentLimiter
} from '../middleware/rateLimiter';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';

const router = express.Router();

router.use(globalLimiter);

function safeMessage(err: any) {
  return publicErrorMessage(err);
}

async function markRequestFailed(requestId: string, err: any) {
  try {
    await updateRequestStatus(requestId, 'failed', err);
  } catch (statusErr: any) {
    logError('[API] Falha ao marcar pedido como failed.', statusErr, {
      requestId,
      error: safeMessage(statusErr)
    });
  }
}

function decodeBase64Payload(base64: string) {
  return Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
}

function parseAngolanAmount(value: string): number {
  const cleaned = value.replace(/[^\d.,]/g, '');
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return Number(cleaned.replace(/\./g, '')) || 0;
}

function publicUrlForStoragePath(supabase: NonNullable<ReturnType<typeof getAdminSupabase>>, bucket: string, path: string) {
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  if (!publicUrl) {
    throw new Error(`Não foi possível obter a URL pública para o ficheiro ${bucket}/${path}.`);
  }
  return publicUrl;
}

export async function ensureUserProfile(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  params: { email: string; name: string; phone?: string | null }
) {
  const { data: existingUser, error: userLookupError } = await supabase
    .from('users')
    .select('*')
    .eq('email', params.email)
    .maybeSingle();

  if (userLookupError) {
    logError('[API] Falha ao procurar utilizador', userLookupError);
    throw new Error('Nao foi possivel preparar o seu perfil.');
  }

  if (existingUser?.id) return existingUser;

  let userId: string | null = null;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
        email: params.email,
        password: `SeuBeat-${randomUUID()}!`,
        email_confirm: true,
        user_metadata: { name: params.name, phone: params.phone || null, source: 'seubeat_wizard' }
      });
      if (!authCreateError && authData?.user?.id) {
        userId = authData.user.id;
        const { data: triggerProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (triggerProfile?.id) return triggerProfile;
      } else {
        logError('[API] Auth createUser falhou, fallback para upsert direto', authCreateError);
      }
    } catch (authErr) {
      logError('[API] Excecao Auth createUser, fallback para upsert direto', authErr as Error);
    }
  }

  if (!userId) {
    userId = randomUUID();
  }

  const { data: newProfile, error: profileCreateError } = await supabase
    .from('users')
    .upsert(
      { id: userId, name: params.name, email: params.email, phone: params.phone || null },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (profileCreateError || !newProfile?.id) {
    const { data: retryUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', params.email)
      .maybeSingle();
    if (retryUser?.id) return retryUser;

    logError('[API] Falha ao criar perfil', profileCreateError, {
      supabaseMessage: (profileCreateError as any)?.message,
      supabaseDetails: (profileCreateError as any)?.details,
      supabaseHint: (profileCreateError as any)?.hint,
      supabaseCode: (profileCreateError as any)?.code,
    });
    throw new Error('Nao foi possivel criar o seu perfil.');
  }

  return newProfile;
}

router.post('/suno-callback', async (req, res) => {
  logInfo('[Suno Callback] Recebido', {
    code: req.body?.code,
    msg: req.body?.msg,
    taskId: req.body?.data?.taskId || req.body?.taskId,
    callbackType: req.body?.data?.callbackType || req.body?.callbackType
  });
  res.json({ success: true });
});

router.post('/generate-lyrics', generateLyricsLimiter, async (req, res) => {
  const supabase = getAdminSupabase();
  let dbSongRequestId: string | null = null;
  let dbSongId: string | null = null;

  try {
    // Validar input
    const validation = validateInput(GenerateLyricsSchema, req.body);
    if ('errors' in validation) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        validation_errors: validation.errors
      });
    }

    const {
      userNick,
      recipientName,
      recipientRelation,
      recipientNick,
      occasion,
      whyCreatedToday,
      musicStyle,
      referenceArtist,
      voiceType,
      photoBase64,
      photoFilename,
      photoMimeType,
      email,
      phone,
      unforgettableMemory,
      whatMakesSpecial,
      onlySheDoes,
      whereItHappened,
      messageFromTheHeart,
      desiredEmotion,
      language
    } = validation.data;

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Banco de dados indisponivel no momento.' });
    }

    let photoUrl: string | null = null;
    if (photoBase64) {
      const buffer = decodeBase64Payload(photoBase64);
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error('A foto e demasiado grande (max 5MB). Comprima a imagem ou escolha outra.');
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (photoMimeType && !allowedMimes.includes(photoMimeType)) {
        throw new Error('Formato de imagem nao suportado. Use JPG, PNG ou WebP.');
      }

      const filename = `photos/${Date.now()}_${String(photoFilename || 'foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, buffer, { contentType: photoMimeType || 'image/jpeg' });

      if (uploadError || !uploadData) {
        logError('[API] Falha ao carregar foto', uploadError, {
          mime: photoMimeType,
          bytes: buffer.length
        });
        throw new Error('Nao foi possivel carregar a foto. Tente novamente.');
      }

      photoUrl = publicUrlForStoragePath(supabase, 'photos', uploadData.path);
    }

    if (!email) {
      throw new Error('O email é obrigatório para criar o pedido.');
    }
    const userEmail = email;
    const userData = await ensureUserProfile(supabase, {
      email: userEmail,
      name: userNick || 'Autor',
      phone: phone || null
    });

    if (!userData?.id) throw new Error('Perfil de utilizador invalido.');

    const { data: requestData, error: requestError } = await supabase.from('song_requests').insert([{
      user_id: userData.id,
      recipient_name: recipientName || 'Destinatario',
      recipient_nick: recipientNick || null,
      relationship: recipientRelation || 'Parceiro',
      occasion: occasion || 'Homenagem',
      music_style: musicStyle || 'Kizomba',
      voice_type: voiceType || 'masculina',
      special_traits: sanitize(whatMakesSpecial || ''),
      memory: sanitize(unforgettableMemory || ''),
      heart_message: sanitize(messageFromTheHeart || ''),
      desired_emotion: desiredEmotion || 'Amor',
      language: language || 'português',
      email: userEmail,
      phone: phone || null,
      status: 'lyrics_generating',
      photo_url: photoUrl
    }]).select().single();

    if (requestError || !requestData?.id) {
      logError('[API] Falha ao criar song_request', requestError, {
        supabaseMessage: (requestError as any)?.message,
        supabaseDetails: (requestError as any)?.details,
        supabaseHint: (requestError as any)?.hint,
        supabaseCode: (requestError as any)?.code,
      });
      throw new Error('Nao foi possivel registrar o seu pedido no banco de dados.');
    }

    dbSongRequestId = requestData.id!;
    logInfo('Song request created', { requestId: requestData.id, email: userEmail });
    setProgress(dbSongRequestId!, { status: 'lyrics_generating', progress: 10, message: 'A gerar letra personalizada com IA...' });

    const { result: parsedData } = await generateLyrics({
      userNick: userNick || 'Autor',
      recipientName: recipientName || 'Destinatario',
      recipientRelation: recipientRelation || 'Parceiro',
      recipientNick: recipientNick || '',
      occasion: occasion || 'Homenagem',
      whyCreatedToday: whyCreatedToday || '',
      musicStyle: musicStyle || 'Kizomba',
      referenceArtist: referenceArtist || '',
      voiceType: voiceType || 'Masculina',
      unforgettableMemory: unforgettableMemory || '',
      whatMakesSpecial: whatMakesSpecial || '',
      onlySheDoes: onlySheDoes || '',
      whereItHappened: whereItHappened || '',
      messageFromTheHeart: messageFromTheHeart || '',
      desiredEmotion: desiredEmotion || 'Emocionante',
      language: language || 'português'
    });

    const { data: songData, error: songError } = await supabase.from('songs').insert([{
      request_id: requestData.id,
      title: parsedData.songTitle,
      lyrics: parsedData.lyrics,
      lyrics_snippet: parsedData.lyricsSnippet,
      letter_text: parsedData.letterText,
      mureka_status: 'not_started'
    }]).select().single();

    if (songError || !songData?.id) {
      logError('[API] Falha ao criar registro de musica', songError, { requestId: requestData.id });
      await markRequestFailed(requestData.id, songError || new Error('Sem musica retornada'));
      throw new Error('A letra foi gerada, mas nao conseguimos guarda-la. Tente novamente.');
    }

    dbSongId = songData.id;

    const { error: lyricsReadyError } = await supabase
      .from('song_requests')
      .update({ status: 'lyrics_ready' })
      .eq('id', requestData.id);

    if (lyricsReadyError) {
      logError('[API] Falha ao atualizar status lyrics_ready', lyricsReadyError, { requestId: requestData.id });
      await markRequestFailed(requestData.id, lyricsReadyError);
      throw new Error('A letra foi criada, mas nao conseguimos atualizar o estado do pedido.');
    }

    setProgress(requestData.id, { status: 'lyrics_ready', progress: 35, message: 'Letra criada com sucesso!' });

    logInfo('Lyrics created successfully', {
      requestId: requestData.id,
      songId: songData.id,
      style: musicStyle || req.body.musicStyle || 'Kizomba'
    });

    res.json({
      success: true,
      dbSongId: songData.id,
      dbSongRequestId: requestData.id,
      ...parsedData,
      photoUrl,
      status: 'lyrics_ready',
      message: 'Letra criada com sucesso!'
    });

    sendConfirmationEmail(email, recipientName, requestData.id)
      .catch((emailErr) => {
        logError('[API] Falha ao enviar email de confirmacao', emailErr, { requestId: requestData.id, email });
      });
  } catch (err: any) {
    if (dbSongRequestId) {
      await markRequestFailed(dbSongRequestId, err);
      setProgress(dbSongRequestId, { status: 'failed', progress: 100, message: 'Erro ao gerar.', error: safeMessage(err) });
    }

    if (dbSongId && supabase) {
      try {
        await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', dbSongId);
      } catch (songUpdateErr) {
        logError('[API] Falha ao atualizar mureka_status no catch', songUpdateErr, { songId: dbSongId });
      }
    }

    logError('[API] /generate-lyrics falhou', err, {
      requestId: dbSongRequestId,
      songId: dbSongId
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: publicErrorMessage(err) });
    }
  }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/song/:id', getSongLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ error: 'ID inválido.' });

    const adminSupabase = getAdminSupabase();
    if (!adminSupabase) return res.status(500).json({ error: 'Banco de dados indisponivel.' });

    logDebug('Fetching song', { songId: id });

    const { data: songData, error } = await adminSupabase
      .from('songs')
      .select('*, song_requests!inner(id, recipient_name, status, photo_url, final_mixed_audio_url, elevenlabs_voice_id, music_style, memory, deliver_at, users!inner(name))')
      .eq('id', req.params.id)
      .single();

    if (error || !songData) {
      logWarn('[API] Musica nao encontrada ou inacessivel', {
        songId: id,
        supabaseMessage: (error as any)?.message,
        supabaseCode: (error as any)?.code
      });
      return res.status(404).json({ error: 'Musica nao encontrada.' });
    }

    const sr = songData.song_requests as any;
    let requestStatus = sr?.status;
    const deliverAt = sr?.deliver_at;
    let audioUrl = songData.preview_url || null;

    // Auto-delivery: se status='approved' e deliver_at já passou, entrega automaticamente
    if (requestStatus === 'approved' && deliverAt && new Date(deliverAt) <= new Date()) {
      const fullUrl = sr?.final_mixed_audio_url || songData.full_song_url || songData.audio_url;
      const { error: deliveryError } = await adminSupabase
        .from('song_requests')
        .update({ status: 'delivered', deliver_at: null })
        .eq('id', songData.request_id)
        .eq('status', 'approved');

      if (!deliveryError) {
        requestStatus = 'delivered';

        const userEmail = sr?.users?.email;
        if (userEmail) {
          const slug = (sr?.recipient_name || 'especial').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
          const personalizedUrl = `${getAppUrl(req)}/song/${slug}?id=${songData.id}`;
          sendPersonalizedEmail(userEmail, sr?.recipient_name, personalizedUrl, songData.letter_text || 'Dedicatória.').catch(err => logError('[API] Falha ao enviar email de entrega', err, { songId: id }));
        }

        if (fullUrl) {
          const match = fullUrl.match(/full-audio\/(.+)/);
          if (match && adminSupabase) {
            const { data } = await adminSupabase.storage.from('full-audio').createSignedUrl(match[1], 3600);
            audioUrl = data?.signedUrl || fullUrl;
          } else {
            audioUrl = fullUrl;
          }
        }
      }
    }

    const song_requests = songData.song_requests;
    const publicData = {
      id: songData.id,
      request_id: songData.request_id,
      title: songData.title,
      lyrics: songData.lyrics,
      lyrics_snippet: songData.lyrics_snippet,
      regeneration_count: songData.regeneration_count,
      letter_text: songData.letter_text,
      dedication_letter: songData.dedication_letter,
      duration: songData.duration,
      created_at: songData.created_at,
      updated_at: songData.updated_at,
      mureka_status: songData.mureka_status,
      preview_url: songData.preview_url,
      audio_url: audioUrl,
      recipient_name: (song_requests as any)?.recipient_name,
      photo_url: (song_requests as any)?.photo_url,
      user_name: (song_requests as any)?.users?.name,
      music_style: (song_requests as any)?.music_style,
      memory: (song_requests as any)?.memory,
      elevenlabs_voice_id: (song_requests as any)?.elevenlabs_voice_id,
      status: requestStatus
    };

    return res.json({ success: true, data: publicData });
  } catch (err: any) {
    logError('[API] Falha ao consultar musica publica', err, { songId: req.params.id });
    res.status(500).json({ error: 'Nao foi possivel consultar a musica.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/song/:id/lyrics — Editar letra manualmente (gratuito)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/song/:id/lyrics', globalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ error: 'ID inválido.' });

    const validation = validateInput(UpdateLyricsSchema, req.body);
    if ('errors' in validation) {
      return res.status(400).json({ success: false, error: 'Dados inválidos', validation_errors: validation.errors });
    }

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'Banco de dados indisponivel.' });

    const { data: existing } = await supabase.from('songs').select('id, request_id').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Música não encontrada.' });

    const { error: updateError } = await supabase
      .from('songs')
      .update({
        lyrics: sanitize(validation.data.lyrics),
        lyrics_snippet: validation.data.lyrics_snippet ? sanitize(validation.data.lyrics_snippet) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    logInfo('[API] Letra editada manualmente', { songId: id });
    res.json({ success: true, message: 'Letra atualizada com sucesso.' });
  } catch (err: any) {
    logError('[API] Falha ao editar letra', err, { songId: req.params.id });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/song/:id/regenerate-lyrics — Regenerar letra com IA (max 2x)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/song/:id/regenerate-lyrics', generateLyricsLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ error: 'ID inválido.' });

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'Banco de dados indisponivel.' });

    const { data: songData, error: songError } = await supabase
      .from('songs')
      .select('*, song_requests!inner(*)')
      .eq('id', id)
      .single();

    if (songError || !songData) {
      return res.status(404).json({ error: 'Música não encontrada.' });
    }

    const sr = songData.song_requests as any;

    // Verificar limite de regenerações
    const currentCount = (songData as any).regeneration_count || 0;
    if (currentCount >= 2) {
      return res.status(429).json({ error: 'Limite de regenerações atingido (máx. 2). Edite manualmente a letra.' });
    }

    const userData = await supabase.from('users').select('name').eq('id', sr.user_id).single();
    const userName = (userData.data as any)?.name || 'Autor';

    const { onlySheDoes, whereItHappened, whyCreatedToday, referenceArtist } = req.body;

    const { result: parsedData } = await generateLyrics({
      userNick: userName,
      recipientName: sr.recipient_name || 'Destinatario',
      recipientRelation: sr.relationship || 'Parceiro',
      recipientNick: sr.recipient_nick || '',
      occasion: sr.occasion || 'Homenagem',
      whyCreatedToday: whyCreatedToday || '',
      musicStyle: sr.music_style || 'Kizomba',
      referenceArtist: referenceArtist || '',
      voiceType: sr.voice_type || 'Masculina',
      unforgettableMemory: sr.memory || '',
      whatMakesSpecial: sr.special_traits || '',
      onlySheDoes: onlySheDoes || '',
      whereItHappened: whereItHappened || '',
      messageFromTheHeart: sr.heart_message || '',
      desiredEmotion: sr.desired_emotion || 'Emocionante',
      language: sr.language || 'português'
    });

    const newCount = currentCount + 1;

    const { error: updateError } = await supabase
      .from('songs')
      .update({
        title: parsedData.songTitle,
        lyrics: parsedData.lyrics,
        lyrics_snippet: parsedData.lyricsSnippet,
        letter_text: parsedData.letterText,
        regeneration_count: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    logInfo('[API] Letra regenerada com IA', { songId: id, regenerationCount: newCount });

    res.json({
      success: true,
      songTitle: parsedData.songTitle,
      lyrics: parsedData.lyrics,
      lyricsSnippet: parsedData.lyricsSnippet,
      letterText: parsedData.letterText,
      regeneration_count: newCount,
      regenerations_remaining: 2 - newCount,
      message: newCount >= 2 ? 'Última regeneração utilizada.' : `Letra regenerada (${newCount}/2).`
    });
  } catch (err: any) {
    logError('[API] Falha ao regenerar letra', err, { songId: req.params.id });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats/today-count — Contador de músicas criadas hoje (prova social)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats/today-count', async (_req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.json({ count: 847 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('songs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    if (error) {
      logWarn('[API] Falha ao contar músicas de hoje', error);
      return res.json({ count: 847 });
    }

    res.json({ count: count || 0 });
  } catch {
    res.json({ count: 847 });
  }
});

router.get('/speech-preview', emailLimiter, async (req, res) => {
  res.status(501).json({ error: 'Preview de voz indisponivel de momento.' });
});

router.post('/submit-payment', paymentLimiter, async (req, res) => {
  try {
    const { songRequestId, userEmail, plan, amount, proofBase64, proofFilename, proofMimeType, voiceSampleBase64, voiceSampleFilename, voiceSampleMimeType } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'Banco de dados indisponivel.' });
    if (!songRequestId) return res.status(400).json({ error: 'ID do pedido em falta.' });
    if (!userEmail) return res.status(400).json({ error: 'Email do cliente em falta.' });
    if (typeof userEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) return res.status(400).json({ error: 'Email inválido.' });
    if (!['standard', 'express', 'premium'].includes(plan)) return res.status(400).json({ error: 'Plano invalido.' });

    const parsedAmount = typeof amount === 'string' ? parseAngolanAmount(amount) : typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const ALLOWED_AMOUNTS: Record<string, number[]> = {
      standard: [7900],
      express: [9900, 14900],
      premium: [14900],
    };
    if (!ALLOWED_AMOUNTS[plan]?.includes(parsedAmount)) {
      return res.status(400).json({ error: 'O montante não corresponde ao plano selecionado.' });
    }

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('request_id', songRequestId)
      .eq('status', 'pending_verification')
      .maybeSingle();
    if (existingPayment) {
      return res.status(409).json({ error: 'Já existe um comprovativo pendente para este pedido.' });
    }

    let proofPath: string | null = null;
    if (proofBase64) {
      const resolvedMime = proofMimeType || 'image/jpeg';
      const ALLOWED_PROOF_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!ALLOWED_PROOF_MIMES.includes(resolvedMime)) {
        return res.status(400).json({ error: 'Formato de comprovativo inválido. Apenas JPG, PNG, WebP ou PDF.' });
      }
      const proofBuffer = decodeBase64Payload(proofBase64);
      if (proofBuffer.length > 10 * 1024 * 1024) throw new Error('Comprovativo demasiado grande. Máx. 10MB.');
      const sanitizedProofFilename = String(proofFilename || 'proof.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `proofs/${Date.now()}_${sanitizedProofFilename}`;
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(filename, proofBuffer, { contentType: resolvedMime });
      if (error || !data) throw new Error(`Upload do comprovativo falhou: ${error?.message || 'sem dados'}`);
      proofPath = data.path;
    }

    let voiceSampleUrl = null;
    if (voiceSampleBase64) {
      const resolvedVoiceMime = voiceSampleMimeType || 'audio/wav';
      const ALLOWED_VOICE_MIMES = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/x-wav'];
      if (!ALLOWED_VOICE_MIMES.includes(resolvedVoiceMime)) {
        return res.status(400).json({ error: 'Formato de áudio inválido. Apenas WAV, MP3, MP4 ou OGG.' });
      }
      const voiceBuffer = decodeBase64Payload(voiceSampleBase64);
      if (voiceBuffer.length > 5 * 1024 * 1024) throw new Error('Amostra de voz demasiado grande. Máx. 5MB.');
      const sanitizedVoiceFilename = String(voiceSampleFilename || 'sample.wav').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `voices/${Date.now()}_${sanitizedVoiceFilename}`;
      const { data, error } = await supabase.storage
        .from('voice-samples')
        .upload(filename, voiceBuffer, { contentType: resolvedVoiceMime });
      if (error || !data) throw new Error(`Upload da amostra de voz falhou: ${error?.message || 'sem dados'}`);
      // Guarda o path em vez de public URL (bucket voice-samples é privado)
      voiceSampleUrl = data.path;
    }

    const { error: paymentError } = await supabase.from('payments').insert([{
      request_id: songRequestId,
      user_email: userEmail,
      plan,
      amount: parsedAmount,
      proof_url: proofPath ? `storage:${proofPath}` : null,
      proof_path: proofPath,
      proof_filename: proofFilename || proofPath?.split('/').pop() || null,
      status: 'pending_verification'
    }]);
    if (paymentError) throw paymentError;

    const updateData: Record<string, any> = { status: 'payment_submitted' };
    if (voiceSampleUrl) updateData.voice_sample_url = voiceSampleUrl;
    const { error: requestUpdateError } = await supabase
      .from('song_requests')
      .update(updateData)
      .eq('id', songRequestId);
    if (requestUpdateError) throw requestUpdateError;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

router.get('/payment-status', paymentLimiter, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'Banco de dados indisponivel.' });

    const { email, requestId } = req.query;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    if (requestId && typeof requestId === 'string' && !UUID_REGEX.test(requestId)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    let query;
    if (requestId && typeof requestId === 'string') {
      query = supabase
        .from('payments')
        .select('status, created_at')
        .eq('request_id', requestId)
        .eq('user_email', email)
        .limit(1)
        .maybeSingle();
    } else {
      query = supabase
        .from('payments')
        .select('status, created_at')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data ? { status: data.status } : { status: 'not_found' });
  } catch (err: any) {
    res.status(500).json({ error: safeMessage(err) });
  }
});

// Payment details endpoint (dados Multicaixa)
router.get('/payment-details', (_req, res) => {
  res.json({
    entidade: process.env.MULTICAIXA_ENTIDADE || '10116',
    referencia: process.env.MULTICAIXA_REFERENCIA || '929423278',
  });
});

// Log client-side errors
router.post('/log-error', (req, res) => {
  const { message: m, stack: s, componentStack, url: u, userAgent } = req.body;
  console.error(`[ClientError] message="${m}" stack="${(s||'').slice(0,500)}" componentStack="${(componentStack||'').slice(0,500)}" url="${u}" ua="${userAgent}"`);
  res.json({ ok: true });
});

export default router;
