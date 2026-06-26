import express from 'express';
import { randomUUID } from 'crypto';
import { getAdminSupabase, getPublicSupabase } from '../services/supabase';
import { generateLyricsWithClaude } from '../services/claude';
import { sendPersonalizedEmail } from '../services/email';
import { runBackgroundSunoWorkflow, setProgress, updateRequestStatus } from '../services/workflow';
import { publicErrorMessage } from '../utils/helpers';
import { 
  GenerateLyricsSchema, 
  SendEmailSchema,
  validateInput 
} from '../middleware/validation';
import { 
  generateLyricsLimiter, 
  emailLimiter,
  getSongLimiter,
  paymentLimiter
} from '../middleware/rateLimiter';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';

const router = express.Router();

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

async function findAuthUserIdByEmail(supabase: NonNullable<ReturnType<typeof getAdminSupabase>>, email: string) {
  let page = 1;
  const perPage = 200;
  const targetEmail = email.toLowerCase();

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      logWarn('[API] Falha ao listar auth.users para procurar email.', { error: error.message });
      return null;
    }

    const users = (data?.users || []) as Array<{ id?: string; email?: string }>;
    const found = users.find(user => user.email?.toLowerCase() === targetEmail);
    if (found?.id) return found.id;

    if (users.length < perPage) break;
    page++;
  }
  return null;
}

async function ensureUserProfile(
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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada para criar cliente.');
  }

  let authUserId = await findAuthUserIdByEmail(supabase, params.email);
  if (!authUserId) {
    const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
      email: params.email,
      password: `SeuBeat-${randomUUID()}!`,
      email_confirm: true,
      user_metadata: {
        name: params.name,
        phone: params.phone || null,
        source: 'seubeat_wizard'
      }
    });

    if (authCreateError || !authData.user?.id) {
      logError('[API] Falha ao criar auth user', authCreateError);
      throw new Error('Nao foi possivel criar o seu perfil.');
    }

    authUserId = authData.user.id;
  }

  const { data: newProfile, error: profileCreateError } = await supabase
    .from('users')
    .upsert([{ id: authUserId, name: params.name, email: params.email, phone: params.phone || null }], { onConflict: 'id' })
    .select()
    .single();

  if (profileCreateError || !newProfile?.id) {
    logError('[API] Falha ao criar perfil publico', profileCreateError);
    throw new Error('Nao foi possivel criar o seu perfil.');
  }

  return newProfile;
}

router.post('/send-email', emailLimiter, async (req, res) => {
  try {
    // Validar input
    const validation = validateInput(SendEmailSchema, req.body);
    if ('errors' in validation) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        validation_errors: validation.errors
      });
    }

    const { email, recipientName, personalizedUrl, letterText } = validation.data;

    logDebug('Sending personalized email', { email, recipientName });

    const result = await sendPersonalizedEmail(
      email,
      recipientName || 'Alguem especial',
      personalizedUrl || 'https://teusom.com',
      letterText || 'Dedicatoria.'
    );

    logInfo('Email sent successfully', { email });
    res.json({ success: true, result });
  } catch (err: any) {
    logError('Email sending failed', err, { email: req.body?.email });
    res.status(500).json({ success: false, error: safeMessage(err) || 'Erro ao enviar email.' });
  }
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
      musicStyle,
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
        throw new Error('A foto e demasiado grande. Maximo 5MB.');
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

    const userEmail = email || `guest_${randomUUID()}@seubeat.com`;
    const userData = await ensureUserProfile(supabase, {
      email: userEmail,
      name: userNick || 'Autor',
      phone: phone || null
    });

    if (!userData?.id) throw new Error('Perfil de utilizador invalido.');

    const { data: requestData, error: requestError } = await supabase.from('song_requests').insert([{
      user_id: userData.id,
      recipient_name: recipientName || 'Destinatario',
      relationship: recipientRelation || 'Parceiro',
      occasion: occasion || 'Homenagem',
      music_style: musicStyle || 'Kizomba',
      voice_type: voiceType || 'masculina',
      special_traits: whatMakesSpecial || '',
      memory: unforgettableMemory || '',
      heart_message: messageFromTheHeart || '',
      desired_emotion: desiredEmotion || 'Amor',
      email: userEmail,
      phone: phone || null,
      status: 'lyrics_generating',
      photo_url: photoUrl
    }]).select().single();

    if (requestError || !requestData?.id) {
      logError('[API] Falha ao criar song_request', requestError);
      throw new Error('Nao foi possivel registrar o seu pedido no banco de dados.');
    }

    dbSongRequestId = requestData.id!;
    logInfo('Song request created', { requestId: requestData.id, email: userEmail });
    setProgress(dbSongRequestId!, { status: 'lyrics_generating', progress: 10, message: 'A gerar letra personalizada com IA...' });

    const parsedData = await generateLyricsWithClaude({
      userNick: userNick || 'Autor',
      recipientName: recipientName || 'Destinatario',
      recipientRelation: recipientRelation || 'Parceiro',
      recipientNick: recipientNick || '',
      occasion: occasion || 'Homenagem',
      musicStyle: musicStyle || 'Kizomba',
      voiceType: voiceType || 'Masculina',
      unforgettableMemory: unforgettableMemory || '',
      whatMakesSpecial: whatMakesSpecial || '',
      onlySheDoes: onlySheDoes || '',
      whereItHappened: whereItHappened || '',
      messageFromTheHeart: messageFromTheHeart || '',
      desiredEmotion: desiredEmotion || 'Emocionante',
      language: language || 'Português'
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

    setProgress(requestData.id, { status: 'lyrics_ready', progress: 35, message: 'Letra criada com sucesso. A iniciar composicao musical...' });

    const { error: requestProcessingError } = await supabase
      .from('song_requests')
      .update({ status: 'music_processing' })
      .eq('id', requestData.id);
    const { error: songProcessingError } = await supabase
      .from('songs')
      .update({ mureka_status: 'generating' })
      .eq('id', songData.id);

    if (requestProcessingError || songProcessingError) {
      const statusError = requestProcessingError || songProcessingError;
      logError('[API] Falha ao iniciar etapa musical', statusError, {
        requestId: requestData.id,
        songId: songData.id
      });
      await markRequestFailed(requestData.id, statusError);
      throw new Error('A letra foi criada, mas nao conseguimos iniciar a etapa musical.');
    }

    setProgress(requestData.id, { status: 'music_processing', progress: 40, message: 'Letra pronta. A música está a ser criada.' });
    logInfo('Lyrics created and Suno started in background', {
      requestId: requestData.id,
      songId: songData.id,
      style: musicStyle || req.body.musicStyle || 'Kizomba'
    });

    runBackgroundSunoWorkflow(
      requestData.id,
      songData.id,
      musicStyle || 'Kizomba',
      parsedData.songTitle,
      parsedData.lyrics
    ).catch(err => {
      logError('[Background] Erro crítico no workflow Suno', err, {
        requestId: requestData.id,
        songId: songData.id
      });
    });

    res.json({
      success: true,
      dbSongId: songData.id,
      dbSongRequestId: requestData.id,
      ...parsedData,
      photoUrl,
      status: 'music_processing',
      message: 'Letra criada. A musica esta em processamento.'
    });
  } catch (err: any) {
    if (dbSongRequestId) {
      await markRequestFailed(dbSongRequestId, err);
      setProgress(dbSongRequestId, { status: 'failed', progress: 100, message: 'Erro ao gerar.', error: safeMessage(err) });
    }

    if (dbSongId && supabase) {
      await supabase.from('songs').update({ mureka_status: 'failed' }).eq('id', dbSongId);
    }

    logError('[API] /generate-lyrics falhou', err, {
      requestId: dbSongRequestId,
      songId: dbSongId
    });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});

router.get('/song/:id', getSongLimiter, async (req, res) => {
  try {
    const supabase = getPublicSupabase();
    const adminSupabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ error: 'Banco de dados indisponivel.' });

    logDebug('Fetching song', { songId: req.params.id });

    const { data: songData, error } = await supabase
      .from('songs')
      .select('*, song_requests!inner(id, recipient_name, status, photo_url, final_mixed_audio_url, users!inner(name))')
      .eq('id', req.params.id)
      .single();

    if (error || !songData) return res.status(404).json({ error: 'Musica nao encontrada.' });

    const requestStatus = (songData.song_requests as any)?.status;
    let audioUrl = songData.preview_url || null;

    if (requestStatus === 'delivered') {
      const sr = songData.song_requests as any;
      const fullUrl = sr?.final_mixed_audio_url || songData.full_song_url || songData.audio_url;
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

    const { song_requests, ...safeSong } = songData;
    const publicData = {
      ...safeSong,
      audio_url: audioUrl,
      recipient_name: (song_requests as any)?.recipient_name,
      photo_url: (song_requests as any)?.photo_url,
      user_name: (song_requests as any)?.users?.name,
      status: requestStatus
    };

    res.json({ success: true, data: publicData });
  } catch (err: any) {
    res.status(500).json({ error: 'Nao foi possivel consultar a musica.' });
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

    let proofUrl = null;
    if (proofBase64) {
      const proofBuffer = decodeBase64Payload(proofBase64);
      if (proofBuffer.length > 10 * 1024 * 1024) throw new Error('Comprovativo demasiado grande. Máx. 10MB.');
      const sanitizedProofFilename = String(proofFilename || 'proof.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `proofs/${Date.now()}_${sanitizedProofFilename}`;
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(filename, decodeBase64Payload(proofBase64), { contentType: proofMimeType || 'image/jpeg' });
      if (error || !data) throw new Error(`Upload do comprovativo falhou: ${error?.message || 'sem dados'}`);
      proofUrl = publicUrlForStoragePath(supabase, 'payment-proofs', data.path);
    }

    let voiceSampleUrl = null;
    if (voiceSampleBase64) {
      const voiceBuffer = decodeBase64Payload(voiceSampleBase64);
      if (voiceBuffer.length > 10 * 1024 * 1024) throw new Error('Amostra de voz demasiado grande. Máx. 10MB.');
      const sanitizedVoiceFilename = String(voiceSampleFilename || 'sample.wav').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `voices/${Date.now()}_${sanitizedVoiceFilename}`;
      const { data, error } = await supabase.storage
        .from('voice-samples')
        .upload(filename, decodeBase64Payload(voiceSampleBase64), { contentType: voiceSampleMimeType || 'audio/wav' });
      if (error || !data) throw new Error(`Upload da amostra de voz falhou: ${error?.message || 'sem dados'}`);
      voiceSampleUrl = publicUrlForStoragePath(supabase, 'voice-samples', data.path);
    }

    const { error: paymentError } = await supabase.from('payments').insert([{
      request_id: songRequestId,
      user_email: userEmail,
      plan,
      amount: typeof amount === 'string' ? parseAngolanAmount(amount) : typeof amount === 'number' && !isNaN(amount) ? amount : 0,
      proof_url: proofUrl,
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
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email necessario.' });

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

export default router;
