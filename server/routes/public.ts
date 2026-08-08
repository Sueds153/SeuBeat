import express from 'express';
import { randomUUID } from 'node:crypto';
import { getAdminSupabase, getPublicSupabase } from '../services/supabase';
import { generateLyrics } from '../services/ai';
import { sendPersonalizedEmail, sendConfirmationEmail, sendAdminNotification } from '../services/email';
import { generateServerEventId } from '../services/metaPixelCapi';
import { sendSubmitApplicationEvent, sendLeadEvent, sendCompleteRegistrationEvent, sendInitiateCheckoutEvent, sendAddPaymentInfoEvent } from '../services/metaPixelCapi';
import DOMPurify from 'isomorphic-dompurify';

function sanitize(str: string): string {
  return DOMPurify.sanitize(str.trim().slice(0, 5000));
}
import { setProgress, updateRequestStatus } from '../services/workflow';
import { publicErrorMessage, getAppUrl } from '../utils/helpers';
import { 
  GenerateLyricsSchema, 
  UpdateLyricsSchema,
  validateInput,
  validationErrorsArray
} from '../middleware/validation';
import type { GenerateLyricsInput } from '../middleware/validation';
import { 
  globalLimiter,
  generateLyricsLimiter, 
  emailLimiter,
  getSongLimiter,
  paymentLimiter,
  paymentStatusLimiter,
  resumeDataLimiter,
  recoverByEmailLimiter
} from '../middleware/rateLimiter';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';

const router = express.Router();

router.use(globalLimiter);

function safeMessage(err: unknown) {
  return publicErrorMessage(err);
}

async function markRequestFailed(requestId: string, err: unknown) {
  try {
    await updateRequestStatus(requestId, 'failed', err);
  } catch (statusErr: unknown) {
    logError('[API] Falha ao marcar pedido como failed.', statusErr instanceof Error ? statusErr : new Error(String(statusErr)), {
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

// Janela de reutilização: se o mesmo email já tiver uma letra lyrics_ready criada
// nos últimos 10 min com os mesmos dados, devolvemos a letra existente em vez de
// gerar duplicatas (retries do cliente após falha de rede/timeout).
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function lyricsRequestFingerprint(values: {
  recipientName?: string;
  recipientGender?: string;
  recipientNick?: string;
  recipientRelation?: string;
  hookPhrase?: string;
  occasion?: string;
  musicStyle?: string;
  voiceType?: string;
  whatMakesSpecial?: string;
  unforgettableMemory?: string;
  messageFromTheHeart?: string;
  desiredEmotion?: string;
  language?: string;
  referenceArtist?: string;
  whyCreatedToday?: string;
  onlySheDoes?: string;
  whereItHappened?: string;
}): string {
  const normalized: Array<string | null> = [
    values.recipientName || 'Destinatario',
    values.recipientGender || null,
    values.recipientNick || null,
    values.recipientRelation || 'Parceiro',
    values.hookPhrase || null,
    values.occasion || 'Homenagem',
    values.musicStyle || 'Kizomba',
    values.voiceType || 'masculina',
    sanitize(values.whatMakesSpecial || ''),
    sanitize(values.unforgettableMemory || ''),
    sanitize(values.messageFromTheHeart || ''),
    values.desiredEmotion || 'Amor',
    values.language || 'português',
    values.referenceArtist || null,
    sanitize(values.whyCreatedToday || ''),
    sanitize(values.onlySheDoes || ''),
    sanitize(values.whereItHappened || ''),
  ];
  return JSON.stringify(normalized);
}

async function findExistingLyricsRequest(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  email: string,
  fingerprint: string
) {
  const { data: existingRequests, error: existingError } = await supabase
    .from('song_requests')
    .select('*')
    .eq('email', email)
    .eq('status', 'lyrics_ready')
    .gte('created_at', new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (existingError) {
    logError('[API] Falha ao procurar pedido existente para dedupe', existingError, { email });
    return null;
  }

  for (const req of existingRequests || []) {
    const storedFingerprint = lyricsRequestFingerprint({
      recipientName: req.recipient_name || undefined,
      recipientGender: req.recipient_gender || undefined,
      recipientNick: req.recipient_nick || undefined,
      recipientRelation: req.relationship || undefined,
      hookPhrase: req.hook_phrase || undefined,
      occasion: req.occasion || undefined,
      musicStyle: req.music_style || undefined,
      voiceType: req.voice_type || undefined,
      whatMakesSpecial: req.special_traits || undefined,
      unforgettableMemory: req.memory || undefined,
      messageFromTheHeart: req.heart_message || undefined,
      desiredEmotion: req.desired_emotion || undefined,
      language: req.language || undefined,
      referenceArtist: req.reference_artist || undefined,
      whyCreatedToday: req.why_created_today || undefined,
      onlySheDoes: req.only_she_does || undefined,
      whereItHappened: req.where_it_happened || undefined,
    });

    if (storedFingerprint !== fingerprint) continue;

    const { data: existingSong } = await supabase
      .from('songs')
      .select('id, title, lyrics, lyrics_snippet, letter_text')
      .eq('request_id', req.id)
      .maybeSingle();

    if (existingSong?.id) {
      return { request: req, song: existingSong };
    }
  }

  return null;
}

// Middleware de idempotência executado ANTES dos rate limiters: se o mesmo email já
// tem uma letra lyrics_ready com os MESMOS dados nos últimos 10 min, devolvemos essa
// letra sem consumir o limite de 5 gerações/hora do generateLyricsLimiter.
async function dedupeLyricsRequest(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return next();

    const validation = validateInput(GenerateLyricsSchema, req.body);
    if (!validation.success) return next();

    const data: GenerateLyricsInput = validation.data;
    if (!data.email) return next();
    const fingerprint = lyricsRequestFingerprint({
      recipientName: data.recipientName || undefined,
      recipientGender: data.recipientGender || undefined,
      recipientNick: data.recipientNick || undefined,
      recipientRelation: data.recipientRelation || undefined,
      hookPhrase: data.hookPhrase || undefined,
      occasion: data.occasion || undefined,
      musicStyle: data.musicStyle || undefined,
      voiceType: data.voiceType || undefined,
      whatMakesSpecial: data.whatMakesSpecial || undefined,
      unforgettableMemory: data.unforgettableMemory || undefined,
      messageFromTheHeart: data.messageFromTheHeart || undefined,
      desiredEmotion: data.desiredEmotion || undefined,
      language: data.language || undefined,
      referenceArtist: data.referenceArtist || undefined,
      whyCreatedToday: data.whyCreatedToday || undefined,
      onlySheDoes: data.onlySheDoes || undefined,
      whereItHappened: data.whereItHappened || undefined,
    });

    const existing = await findExistingLyricsRequest(supabase, data.email, fingerprint);
    if (!existing) return next();

    setProgress(existing.request.id, { status: 'lyrics_ready', progress: 35, message: 'Letra criada com sucesso!' });
    logInfo('Lyrics reutilizada (dedupe de retry)', {
      requestId: existing.request.id,
      songId: existing.song.id,
      email: data.email
    });
    res.json({
      success: true,
      dbSongId: existing.song.id,
      dbSongRequestId: existing.request.id,
      songTitle: existing.song.title,
      lyrics: existing.song.lyrics,
      lyricsSnippet: existing.song.lyrics_snippet,
      letterText: existing.song.letter_text,
      photoUrl: existing.request.photo_url,
      status: 'lyrics_ready',
      message: 'Letra criada com sucesso!'
    });
  } catch (err: unknown) {
    // O dedupe nunca pode bloquear o fluxo normal — em caso de erro, segue para o handler.
    logError('[API] Falha no middleware de dedupe', err instanceof Error ? err : new Error(String(err)));
    next();
  }
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
      supabaseMessage: profileCreateError?.message,
      supabaseDetails: profileCreateError?.details,
      supabaseHint: profileCreateError?.hint,
      supabaseCode: profileCreateError?.code,
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

router.post('/generate-lyrics', dedupeLyricsRequest, generateLyricsLimiter, emailLimiter, async (req, res) => {
  const supabase = getAdminSupabase();
  let dbSongRequestId: string | null = null;
  let dbSongId: string | null = null;
  let photoStoragePath: string | null = null;

  try {
    // Validar input
    const validation = validateInput(GenerateLyricsSchema, req.body);
    if ('errors' in validation) {
      logWarn('[API] /generate-lyrics dados inválidos', {
        email: typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'unknown',
        errors: validation.errors
      });
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        validation_errors: validationErrorsArray(validation.errors)
      });
    }

    const {
      userNick,
      recipientName,
      recipientGender,
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
      hookPhrase,
      desiredEmotion,
      language,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content
    } = validation.data;

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Banco de dados indisponivel no momento.' });
    }

    let photoUrl: string | null = null;
    if (photoBase64) {
      const buffer = decodeBase64Payload(photoBase64);
      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error('A foto e demasiado grande (max 10MB). Comprima a imagem ou escolha outra.');
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
      if (photoMimeType && !allowedMimes.includes(photoMimeType)) {
        throw new Error('Formato de imagem nao suportado. Use JPG, PNG, WebP, HEIC ou GIF.');
      }

      const isHeicOrHeif = photoMimeType && ['image/heic', 'image/heif'].includes(photoMimeType);
      const uploadContentType = isHeicOrHeif ? 'image/jpeg' : (photoMimeType || 'image/jpeg');

      const filename = `photos/${Date.now()}_${String(photoFilename || 'foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, buffer, { contentType: uploadContentType });

      if (uploadError || !uploadData) {
        logError('[API] Falha ao carregar foto', uploadError, {
          mime: photoMimeType,
          bytes: buffer.length
        });
        throw new Error('Nao foi possivel carregar a foto. Tente novamente.');
      }

      photoStoragePath = uploadData.path;
      photoUrl = publicUrlForStoragePath(supabase, 'photos', uploadData.path);
    }

    if (!email) {
      throw new Error('O email é obrigatório para criar o pedido.');
    }
    const userEmail = email;
    const userData = await ensureUserProfile(supabase, {
      email: userEmail,
      name: userNick || 'Autor',
      phone
    });

    if (!userData?.id) throw new Error('Perfil de utilizador invalido.');

    const { data: requestData, error: requestError } = await supabase.from('song_requests').insert([{
      user_id: userData.id,
      recipient_name: recipientName || 'Destinatario',
      recipient_gender: recipientGender || null,
      recipient_nick: recipientNick || null,
      relationship: recipientRelation || 'Parceiro',
      hook_phrase: hookPhrase || null,
      reference_artist: referenceArtist || null,
      why_created_today: sanitize(whyCreatedToday || ''),
      only_she_does: sanitize(onlySheDoes || ''),
      where_it_happened: sanitize(whereItHappened || ''),
      occasion: occasion || 'Homenagem',
      music_style: musicStyle || 'Kizomba',
      voice_type: voiceType || 'masculina',
      special_traits: sanitize(whatMakesSpecial || ''),
      memory: sanitize(unforgettableMemory || ''),
      heart_message: sanitize(messageFromTheHeart || ''),
      desired_emotion: desiredEmotion || 'Amor',
      language: language || 'português',
      email: userEmail,
      phone,
      status: 'lyrics_generating',
      photo_url: photoUrl,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_term: utm_term || null,
      utm_content: utm_content || null
    }]).select().single();

    if (requestError || !requestData?.id) {
      logError('[API] Falha ao criar song_request', requestError, {
        supabaseMessage: requestError?.message,
        supabaseDetails: requestError?.details,
        supabaseHint: requestError?.hint,
        supabaseCode: requestError?.code,
      });
      throw new Error('Nao foi possivel registrar o seu pedido no banco de dados.');
    }

    dbSongRequestId = requestData.id!;
    logInfo('Song request created', { requestId: requestData.id, email: userEmail });
    setProgress(dbSongRequestId!, { status: 'lyrics_generating', progress: 10, message: 'A gerar letra personalizada com IA...' });

    const { result: parsedData } = await generateLyrics({
      userNick: userNick || 'Autor',
      recipientName: recipientName || 'Destinatario',
      recipientGender: recipientGender || '',
      recipientRelation: recipientRelation || 'Parceiro',
      recipientNick: recipientNick || '',
      hookPhrase: hookPhrase || '',
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
    }, { requestId: dbSongRequestId!, email: userEmail });

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

    const userFullNameLyrics = userNick || '';
    const namePartsLyrics = userFullNameLyrics.split(' ').filter(Boolean);
    const firstNameLyrics = namePartsLyrics[0] || undefined;
    const lastNameLyrics = namePartsLyrics.slice(-1)[0] || undefined;
    const genderMap: Record<string, string> = { masculino: 'm', feminino: 'f' };
    const genLyrics = recipientGender ? genderMap[recipientGender.toLowerCase()] : undefined;
    const eventIp = req.ip || req.socket.remoteAddress || undefined;
    const eventUa = req.headers['user-agent'];

    sendLeadEvent({
      eventId: generateServerEventId(requestData.id, 'Lead'),
      email: email || '',
      phone: phone || undefined,
      contentName: 'lyrics_generated',
      eventSourceUrl: (req.headers.referer as string) || undefined,
      clientIp: eventIp,
      clientUserAgent: eventUa,
      ln: lastNameLyrics,
    }).catch((err) =>
      logError('[API] Meta CAPI Lead event failed', err, { requestId: requestData.id })
    );

    sendCompleteRegistrationEvent({
      eventId: generateServerEventId(requestData.id, 'CompleteRegistration'),
      email: email || '',
      phone: phone || undefined,
      fn: firstNameLyrics,
      ln: lastNameLyrics,
      gen: genLyrics,
      country: 'AO',
      eventSourceUrl: (req.headers.referer as string) || undefined,
      clientIp: eventIp,
      clientUserAgent: eventUa,
    }).catch((err) =>
      logError('[API] Meta CAPI CompleteRegistration event failed', err, { requestId: requestData.id })
    );

    sendConfirmationEmail(email, recipientName, requestData.id)
      .catch((emailErr) => {
        logError('[API] Falha ao enviar email de confirmacao', emailErr, { requestId: requestData.id, email });
      });
  } catch (err: unknown) {
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

    if (photoStoragePath && supabase && !dbSongRequestId) {
      supabase.storage.from('photos').remove([photoStoragePath]).catch(() => {});
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
    if (!UUID_REGEX.test(id)) return res.status(400).json({ success: false, error: 'ID inválido.' });

    const publicSupabase = getPublicSupabase();
    if (!publicSupabase) return res.status(500).json({ success: false, error: 'Banco de dados indisponivel.' });

    logDebug('Fetching song', { songId: id });

    const { data: songData, error } = await publicSupabase
      .from('songs')
      .select('*, song_requests!inner(id, recipient_name, status, email, photo_url, final_mixed_audio_url, elevenlabs_voice_id, music_style, memory, deliver_at, occasion, relationship, desired_emotion, voice_type, recipient_gender, users(name))')
      .eq('id', req.params.id)
      .single();

    if (error || !songData) {
      logWarn('[API] Musica nao encontrada ou inacessivel', {
        songId: id,
        supabaseMessage: error?.message,
        supabaseCode: error?.code
      });
      return res.status(404).json({ success: false, error: 'Musica nao encontrada.' });
    }

    const sr = songData.song_requests;
    let requestStatus = sr?.status;
    const deliverAt = sr?.deliver_at;
    let audioUrl = songData.preview_url || null;

    const adminSupabase = getAdminSupabase();

    // Auto-delivery: se status='approved' e deliver_at já passou, entrega automaticamente
    if (requestStatus === 'approved' && deliverAt && new Date(deliverAt) <= new Date()) {
      const fullUrl = sr?.final_mixed_audio_url || songData.full_song_url || songData.audio_url;
      if (adminSupabase) {
        const { error: deliveryError } = await adminSupabase
          .from('song_requests')
          .update({ status: 'delivered', deliver_at: null })
          .eq('id', songData.request_id)
          .eq('status', 'approved');

        if (!deliveryError) {
          requestStatus = 'delivered';

          const userEmail = sr?.email;
          if (userEmail) {
            const slug = (sr?.recipient_name || 'especial').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            const personalizedUrl = `${getAppUrl(req)}/song/${slug}?id=${songData.id}`;
            sendPersonalizedEmail(userEmail, sr?.recipient_name, personalizedUrl, songData.letter_text || 'Dedicatória.').catch(err => logError('[API] Falha ao enviar email de entrega', err, { songId: id }));
          }

          if (fullUrl) {
            const match = fullUrl.match(/full-audio\/(.+)/);
            if (match) {
              const { data } = await adminSupabase.storage.from('full-audio').createSignedUrl(match[1], 604800);
              audioUrl = data?.signedUrl || fullUrl;
            } else {
              audioUrl = fullUrl;
            }
          }
        }
      }
    }

    // Se está delivered (ou approved com áudio completo), gerar signed URL do áudio completo
    if (requestStatus === 'delivered' || requestStatus === 'approved') {
      const fullUrl = sr?.final_mixed_audio_url || songData.full_song_url || songData.audio_url;
      if (fullUrl && fullUrl !== audioUrl) {
        const match = fullUrl.match(/full-audio\/(.+)/);
        if (match && adminSupabase) {
          const { data } = await adminSupabase.storage.from('full-audio').createSignedUrl(match[1], 604800);
          audioUrl = data?.signedUrl || fullUrl;
        } else {
          audioUrl = fullUrl;
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

      duration: songData.duration,
      created_at: songData.created_at,
      updated_at: songData.updated_at,
      mureka_status: songData.mureka_status,
      preview_url: songData.preview_url,
      audio_url: audioUrl,
      recipient_name: song_requests?.recipient_name,
      photo_url: song_requests?.photo_url,
      user_name: song_requests?.users?.name,
      music_style: song_requests?.music_style,
      memory: song_requests?.memory,
      occasion: song_requests?.occasion,
      relationship: song_requests?.relationship,
      desired_emotion: song_requests?.desired_emotion,
      voice_type: song_requests?.voice_type,
      recipient_gender: song_requests?.recipient_gender,
      elevenlabs_voice_id: song_requests?.elevenlabs_voice_id,
      status: requestStatus
    };

    return res.json({ success: true, data: publicData });
  } catch (err: unknown) {
    logError('[API] Falha ao consultar musica publica', err instanceof Error ? err : new Error(String(err)), { songId: req.params.id });
    res.status(500).json({ success: false, error: 'Nao foi possivel consultar a musica.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/song/:id/lyrics — Editar letra manualmente (gratuito)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/song/:id/lyrics', globalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ success: false, error: 'ID inválido.' });

    const validation = validateInput(UpdateLyricsSchema, req.body);
    if ('errors' in validation) {
      logWarn('[API] PUT /song/:id/lyrics dados inválidos', {
        songId: id,
        errors: validation.errors
      });
      return res.status(400).json({ success: false, error: 'Dados inválidos', validation_errors: validationErrorsArray(validation.errors) });
    }

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'Banco de dados indisponivel.' });

    const { data: existing } = await supabase.from('songs').select('id, request_id').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ success: false, error: 'Música não encontrada.' });

    const rawLyrics = validation.data.lyrics;
    const lyricsArray = Array.isArray(rawLyrics) ? rawLyrics : rawLyrics.split('\n').filter(l => l.trim().length > 0);

    const { error: updateError } = await supabase
      .from('songs')
      .update({
        lyrics: lyricsArray,
        lyrics_snippet: validation.data.lyrics_snippet ? sanitize(validation.data.lyrics_snippet) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    logInfo('[API] Letra editada manualmente', { songId: id });
    res.json({ success: true, message: 'Letra atualizada com sucesso.' });
  } catch (err: unknown) {
    logError('[API] Falha ao editar letra', err instanceof Error ? err : new Error(String(err)), { songId: req.params.id });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/song/:id/regenerate-lyrics — Regenerar letra com IA (max 2x)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/song/:id/regenerate-lyrics', generateLyricsLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ success: false, error: 'ID inválido.' });

    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'Banco de dados indisponivel.' });

    const { data: songData, error: songError } = await supabase
      .from('songs')
      .select('*, song_requests!inner(*)')
      .eq('id', id)
      .single();

    if (songError || !songData) {
      return res.status(404).json({ success: false, error: 'Música não encontrada.' });
    }

    const sr = songData.song_requests;

    // Verificar limite de regenerações
    const currentCount = songData.regeneration_count || 0;
    if (currentCount >= 2) {
      return res.status(429).json({ success: false, error: 'Limite de regenerações atingido (máx. 2). Edite manualmente a letra.' });
    }

    const userData = await supabase.from('users').select('name, email').eq('id', sr.user_id).single();
    const userName = userData.data?.name || 'Autor';
    const userEmail = userData.data?.email || undefined;

    const bodyHint = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const preferBody = (key: string, fallback: string): string => {
      const val = bodyHint[key];
      return typeof val === 'string' && val.trim() ? val : fallback;
    };

    const { result: parsedData } = await generateLyrics({
      userNick: userName,
      recipientName: sr.recipient_name || 'Destinatario',
      recipientGender: sr.recipient_gender || 'Masculino',
      recipientRelation: sr.relationship || 'Parceiro',
      recipientNick: sr.recipient_nick || '',
      occasion: sr.occasion || 'Homenagem',
      whyCreatedToday: preferBody('whyCreatedToday', sr.why_created_today || ''),
      musicStyle: sr.music_style || 'Kizomba',
      referenceArtist: preferBody('referenceArtist', sr.reference_artist || ''),
      voiceType: sr.voice_type || 'Masculina',
      unforgettableMemory: sr.memory || '',
      whatMakesSpecial: sr.special_traits || '',
      onlySheDoes: preferBody('onlySheDoes', sr.only_she_does || ''),
      whereItHappened: preferBody('whereItHappened', sr.where_it_happened || ''),
      messageFromTheHeart: sr.heart_message || '',
      hookPhrase: sr.hook_phrase || '',
      desiredEmotion: sr.desired_emotion || 'Emocionante',
      language: sr.language || 'português'
    }, { requestId: id, email: userEmail });

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
  } catch (err: unknown) {
    logError('[API] Falha ao regenerar letra', err instanceof Error ? err : new Error(String(err)), { songId: req.params.id });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats/today-count — Contador de músicas criadas hoje (prova social)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats/today-count', async (_req, res) => {
  try {
    const supabase = getPublicSupabase ? getPublicSupabase() : null;
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

router.post('/submit-payment', paymentLimiter, async (req, res) => {
  try {
    const { 
      songRequestId, userEmail, phone, plan, amount, 
      proofBase64, proofFilename, proofMimeType, 
      voiceSampleBase64, voiceSampleFilename, voiceSampleMimeType,
      eventIds 
    } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'Banco de dados indisponivel.' });
    if (!songRequestId) return res.status(400).json({ success: false, error: 'ID do pedido em falta.' });
    if (!userEmail) return res.status(400).json({ success: false, error: 'Email do cliente em falta.' });
    if (typeof userEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) return res.status(400).json({ success: false, error: 'Email inválido.' });
    if (!['standard', 'express', 'premium'].includes(plan)) return res.status(400).json({ success: false, error: 'Plano invalido.' });

    const parsedAmount = typeof amount === 'string' ? parseAngolanAmount(amount) : typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const ALLOWED_AMOUNTS: Record<string, number[]> = {
      standard: [7900],
      express: [9900],
      premium: [14900],
    };
    if (!ALLOWED_AMOUNTS[plan]?.includes(parsedAmount)) {
      return res.status(400).json({ success: false, error: 'O montante não corresponde ao plano selecionado.' });
    }

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('request_id', songRequestId)
      .eq('status', 'pending_verification')
      .maybeSingle();
    if (existingPayment) {
      return res.status(409).json({ success: false, error: 'Já existe um comprovativo pendente para este pedido.' });
    }

    let proofPath: string | null = null;
    if (proofBase64) {
      const resolvedMime = proofMimeType || 'image/jpeg';
      const ALLOWED_PROOF_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!ALLOWED_PROOF_MIMES.includes(resolvedMime)) {
        return res.status(400).json({ success: false, error: 'Formato de comprovativo inválido. Apenas JPG, PNG, WebP ou PDF.' });
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
        return res.status(400).json({ success: false, error: 'Formato de áudio inválido. Apenas WAV, MP3, MP4 ou OGG.' });
      }
      const voiceBuffer = decodeBase64Payload(voiceSampleBase64);
      if (voiceBuffer.length > 5 * 1024 * 1024) throw new Error('Amostra de voz demasiado grande. Máx. 5MB.');
      if (voiceBuffer.length < 1024) throw new Error('Amostra de voz demasiado pequena. Grava pelo menos 3 segundos.');
      const sanitizedVoiceFilename = String(voiceSampleFilename || 'sample.wav').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `voices/${Date.now()}_${sanitizedVoiceFilename}`;
      const { data, error } = await supabase.storage
        .from('voice-samples')
        .upload(filename, voiceBuffer, { contentType: resolvedVoiceMime });
      if (error || !data) throw new Error(`Upload da amostra de voz falhou: ${error?.message || 'sem dados'}`);
      // Guarda o path em vez de public URL (bucket voice-samples é privado)
      voiceSampleUrl = data.path;
    }

    const updateData: Record<string, unknown> = { status: 'payment_submitted' };
    if (voiceSampleUrl) updateData.voice_sample_url = voiceSampleUrl;
    const { error: requestUpdateError } = await supabase
      .from('song_requests')
      .update(updateData)
      .eq('id', songRequestId);
    if (requestUpdateError) throw requestUpdateError;

    const { data: paymentRecord, error: paymentError } = await supabase.from('payments').insert([{
      request_id: songRequestId,
      user_email: userEmail,
      plan,
      amount: parsedAmount,
      proof_url: proofPath ? `storage:${proofPath}` : null,
      proof_path: proofPath,
      proof_filename: proofFilename || proofPath?.split('/').pop() || null,
      status: 'pending_verification'
    }]).select('id').single();
    if (paymentError) throw paymentError;

    sendInitiateCheckoutEvent({
      eventId: eventIds?.initiateCheckout || generateServerEventId(songRequestId, 'InitiateCheckout'),
      email: userEmail,
      phone: phone || undefined,
      value: parsedAmount,
      currency: 'AOA',
      contentName: plan,
      eventSourceUrl: (req.headers.referer as string) || undefined,
      clientIp: req.ip || req.socket.remoteAddress || undefined,
      clientUserAgent: req.headers['user-agent'],
      externalId: userEmail,
    }).catch(err =>
      logError('[API] Meta CAPI InitiateCheckout event failed', err, { paymentId: paymentRecord?.id })
    );

    sendAddPaymentInfoEvent({
      eventId: eventIds?.addPaymentInfo || generateServerEventId(songRequestId, 'AddPaymentInfo'),
      email: userEmail,
      phone: phone || undefined,
      value: parsedAmount,
      currency: 'AOA',
      contentName: plan,
      eventSourceUrl: (req.headers.referer as string) || undefined,
      clientIp: req.ip || req.socket.remoteAddress || undefined,
      clientUserAgent: req.headers['user-agent'],
      externalId: userEmail,
    }).catch(err =>
      logError('[API] Meta CAPI AddPaymentInfo event failed', err, { paymentId: paymentRecord?.id })
    );

    sendSubmitApplicationEvent({
      eventId: eventIds?.submitApplication || generateServerEventId(songRequestId, 'SubmitApplication'),
      email: userEmail,
      phone: phone || undefined,
      value: parsedAmount,
      currency: 'AOA',
      contentName: plan,
      eventSourceUrl: (req.headers.referer as string) || undefined,
      clientIp: req.ip || req.socket.remoteAddress || undefined,
      clientUserAgent: req.headers['user-agent'],
      externalId: userEmail,
    }).catch(err =>
      logError('[API] Meta CAPI SubmitApplication event failed', err, { paymentId: paymentRecord?.id })
    );

    // Notificar admin instantaneamente sobre novo comprovativo pendente
    sendAdminNotification(
      'Novo comprovativo pendente 📸',
      `Cliente: ${userEmail}\nPlano: ${plan} (${parsedAmount} Kz)\nPedido: ${songRequestId}\nPagamento: ${paymentRecord?.id}\n\nVer no painel: ${getAppUrl(req)}/admin?tab=payments`
    ).catch(err =>
      logError('[API] Falha ao notificar admin', err, { paymentId: paymentRecord?.id })
    );

    res.json({ success: true, paymentId: paymentRecord?.id });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

router.get('/payment-status', paymentStatusLimiter, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'Banco de dados indisponivel.' });

    const { email, requestId } = req.query;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido.' });
    }

    if (requestId && typeof requestId === 'string' && !UUID_REGEX.test(requestId)) {
      return res.status(400).json({ success: false, error: 'ID inválido.' });
    }

    let query;
    if (requestId && typeof requestId === 'string') {
      query = supabase
        .from('payments')
        .select('status, created_at, notes')
        .eq('request_id', requestId)
        .eq('user_email', email)
        .limit(1)
        .maybeSingle();
    } else {
      query = supabase
        .from('payments')
        .select('status, created_at, notes')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data ? { status: data.status, notes: data.notes || null } : { status: 'not_found' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// Recuperação de letra: devolve o pedido lyrics_ready mais recente do email
// (usado pelo Wizard quando a geração "falhou" no cliente mas a letra já existe).
router.get('/latest-song', getSongLimiter, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'Banco de dados indisponivel.' });

    const { email } = req.query;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido.' });
    }

    const { data: requestData, error: requestError } = await supabase
      .from('song_requests')
      .select('*')
      .eq('email', email)
      .eq('status', 'lyrics_ready')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (requestError) throw requestError;

    if (!requestData?.id) {
      return res.json({ success: true, found: false });
    }

    const { data: songData, error: songError } = await supabase
      .from('songs')
      .select('id, title, lyrics, lyrics_snippet, letter_text')
      .eq('request_id', requestData.id)
      .maybeSingle();

    if (songError) throw songError;

    if (!songData?.id) {
      return res.json({ success: true, found: false });
    }

    res.json({
      success: true,
      found: true,
      dbSongId: songData.id,
      dbSongRequestId: requestData.id,
      songTitle: songData.title,
      lyrics: songData.lyrics,
      lyricsSnippet: songData.lyrics_snippet,
      letterText: songData.letter_text,
      photoUrl: requestData.photo_url,
      status: 'lyrics_ready'
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/social-proof — prova social real (pagamentos aprovados, última compra,
// última atividade). Dados verdadeiros da BD, nunca números inventados.
// ─────────────────────────────────────────────────────────────────────────────
let socialProofCache: unknown = null;
let socialProofCacheAt = 0;
const SOCIAL_PROOF_TTL_MS = 30_000;

function formatFirstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const first = name.split(' ').filter(Boolean)[0];
  return first || null;
}

async function lookupFirstNameByEmail(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  email: string | null | undefined
): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabase
    .from('users')
    .select('name')
    .eq('email', email)
    .maybeSingle();
  return formatFirstName(data?.name);
}

function minutesAgo(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

const EMPTY_SOCIAL_PROOF = {
  createdToday: 0,
  paidToday: 0,
  paidTotal: 0,
  deliveredTotal: 0,
  lastPayment: null,
  lastActivity: null,
};

router.get('/social-proof', async (_req, res) => {
  const now = Date.now();
  if (socialProofCache && now - socialProofCacheAt < SOCIAL_PROOF_TTL_MS) {
    return res.json(socialProofCache);
  }

  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.json(EMPTY_SOCIAL_PROOF);
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayISO = startOfDay.toISOString();

    const [{ count: createdToday }, { count: paidToday }, { count: paidTotal }, { count: deliveredTotal }] = await Promise.all([
      supabase.from('songs').select('*', { count: 'exact', head: true }).gte('created_at', startOfDayISO),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('approved_at', startOfDayISO),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('song_requests').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
    ]);

    const { data: lastPaymentRow } = await supabase
      .from('payments')
      .select('user_email, approved_at')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastPayment: { firstName: string | null; minutesAgo: number } | null = null;
    if (lastPaymentRow?.approved_at) {
      lastPayment = {
        firstName: await lookupFirstNameByEmail(supabase, lastPaymentRow.user_email),
        minutesAgo: minutesAgo(lastPaymentRow.approved_at),
      };
    }

    const { data: lastActivityRow } = await supabase
      .from('song_requests')
      .select('created_at, users(name)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastActivity: { firstName: string | null; minutesAgo: number } | null = null;
    if (lastActivityRow?.created_at) {
      lastActivity = {
        firstName: formatFirstName((lastActivityRow as { users?: { name?: string | null } | null }).users?.name),
        minutesAgo: minutesAgo(lastActivityRow.created_at as string),
      };
    }

    const data = {
      createdToday: createdToday || 0,
      paidToday: paidToday || 0,
      paidTotal: paidTotal || 0,
      deliveredTotal: deliveredTotal || 0,
      lastPayment,
      lastActivity,
    };

    socialProofCache = data;
    socialProofCacheAt = now;
    res.json(data);
  } catch (err: unknown) {
    logWarn('[API] Falha ao gerar social proof', err);
    res.json(EMPTY_SOCIAL_PROOF);
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/song/:id/resume-link — link assinado (1h) para retomar no passo de pagamento
// ─────────────────────────────────────────────────────────────────────────────
router.get('/song/:id/resume-link', async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Serviço indisponível' });
    }

    const { id } = req.params;
    const { data: request, error } = await supabase
      .from('song_requests')
      .select('id, email, status, recipient_name')
      .eq('id', id)
      .maybeSingle();

    if (error || !request) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
    }

    const allowedStatuses = ['lyrics_ready', 'payment_submitted'];
    if (!allowedStatuses.includes(request.status)) {
      return res.status(400).json({ success: false, error: 'Este pedido não pode ser retomado no pagamento' });
    }

    const appUrl = getAppUrl(req);
    const resumeUrl = `${appUrl}/wizard?resume=${id}&step=payment`;

    res.json({
      success: true,
      resumeUrl,
      expiresIn: 3600,
      requestId: request.id,
      recipientName: request.recipient_name,
    });
  } catch (err: unknown) {
    logError('[API] Falha ao gerar resume-link', err);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/song/resume-data/:requestId — dados para reconstruir o Wizard a partir
// de um resume link (letra já gerada). Service role: evita expor dados por RLS.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/song/resume-data/:requestId', resumeDataLimiter, async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!UUID_REGEX.test(requestId)) {
      return res.status(400).json({ success: false, error: 'ID inválido.' });
    }

    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Serviço indisponível' });
    }

    const { data: requestData, error } = await supabase
      .from('song_requests')
      .select('*, songs(id, title, lyrics, lyrics_snippet, letter_text), users(name)')
      .eq('id', requestId)
      .maybeSingle();

    if (error || !requestData) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
    }

    const allowedStatuses = ['lyrics_ready', 'payment_submitted'];
    if (!allowedStatuses.includes(requestData.status)) {
      return res.status(400).json({ success: false, error: 'Este pedido já não pode ser retomado.' });
    }

    const song = Array.isArray(requestData.songs) ? requestData.songs[0] : requestData.songs;
    const lyrics = Array.isArray(song?.lyrics) ? song.lyrics : [];

    const resumeData = {
      formData: {
        userNick: requestData.users?.name || '',
        recipientName: requestData.recipient_name || '',
        recipientGender: requestData.recipient_gender || 'Masculino',
        recipientRelation: requestData.relationship || '',
        recipientNick: requestData.recipient_nick || '',
        occasion: requestData.occasion || '',
        whyCreatedToday: requestData.why_created_today || '',
        musicStyle: requestData.music_style || '',
        referenceArtist: requestData.reference_artist || '',
        voiceType: requestData.voice_type || '',
        whatMakesSpecial: requestData.special_traits || '',
        onlySheDoes: requestData.only_she_does || '',
        unforgettableMemory: requestData.memory || '',
        whereItHappened: requestData.where_it_happened || '',
        messageFromTheHeart: requestData.heart_message || '',
        desiredEmotion: requestData.desired_emotion || '',
        hookPhrase: requestData.hook_phrase || '',
        photoUrl: requestData.photo_url || '',
        email: requestData.email || '',
        phone: requestData.phone || '',
        language: requestData.language || 'português'
      },
      aiSongTitle: song?.title || '',
      aiLyrics: lyrics,
      aiLyricsSnippet: song?.lyrics_snippet || '',
      aiLetterText: song?.letter_text || '',
      dbSongId: song?.id || '',
      dbSongRequestId: requestData.id,
      status: requestData.status
    };

    logInfo('[API] Resume data fetched', { requestId, status: requestData.status, hasPhoto: !!resumeData.formData.photoUrl });
    res.json({ success: true, data: resumeData });
  } catch (err: unknown) {
    logError('[API] Falha ao obter resume data', err, { requestId: req.params.requestId });
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/song/recover-by-email — página pública /retomar: devolve o link de
// retoma para o pedido mais recente desse email (letra já pronta). Service role:
// RLS anon não permite procurar por email.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/song/recover-by-email', recoverByEmailLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido.' });
    }

    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Serviço indisponível' });
    }

    const { data, error } = await supabase
      .from('song_requests')
      .select('id, email, status, recipient_name, created_at')
      .eq('email', email)
      .in('status', ['lyrics_ready', 'lyrics_generating'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Não encontrámos nenhuma música para esse email.' });
    }

    if (data.status === 'lyrics_generating') {
      return res.json({
        success: true,
        status: data.status,
        message: 'A tua música ainda está a ser gerada. Volta mais tarde e tenta de novo.',
      });
    }

    const appUrl = getAppUrl(req);
    const resumeUrl = `${appUrl}/wizard?resume=${data.id}&step=payment`;

    logInfo('[API] Recover-by-email ok', { email, status: data.status, requestId: data.id });
    res.json({
      success: true,
      status: data.status,
      resumeUrl,
      requestId: data.id,
      recipientName: data.recipient_name || '',
    });
  } catch (err: unknown) {
    logError('[API] Falha no recover-by-email', err);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/config — configurações de runtime (feature flags)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/config', (_req, res) => {
  res.json({
    success: true,
    features: {
      lyricsTeaser: process.env.VITE_ENABLE_LYRICS_TEASER === 'true',
    },
  });
});

export default router;
