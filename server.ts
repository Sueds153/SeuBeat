import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { Type } from '@google/genai';

// Import modularized services
import { getSupabase, uploadToSupabase } from './server/services/supabase';
import { downloadFile, createPreviewAudio, mixAudio } from './server/services/audio';
import { getGeminiClient, selectPrompt } from './server/services/gemini';
import { cloneElevenLabsVoice, generateElevenLabsSpeechWithVoiceId, generateElevenLabsSpeech } from './server/services/elevenlabs';
import { generateMurekaMusic } from './server/services/mureka';
import { sendPersonalizedEmail, sendPaymentNotificationEmail, sendPaymentRejectionEmail } from './server/services/email';

// Load environmental variables
dotenv.config();

// Remetente dos emails — configurar RESEND_FROM no .env para personalizar
const RESEND_FROM = process.env.RESEND_FROM || 'SeuBeat <onboarding@resend.dev>';

// Emails dos admins (suporte a múltiplos, separados por vírgula)
const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || 'seubeat@admin.com')
  .split(',')
  .map(e => e.trim())
  .filter(e => e.length > 0);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Dicionário na memória para acompanhar progresso detalhado de cada pedido
const requestProgressMap: Record<string, { status: string; progress: number; message: string; error?: string }> = {};

// Background workflow for Mureka generation & cutting 30s preview
async function runBackgroundMurekaWorkflow(
  requestId: string, 
  songId: string, 
  musicStyle: string, 
  songTitle: string, 
  lyrics: string[]
) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    console.log(`[Background Mureka] Starting workflow for Request ${requestId}, Song ${songId}`);
    requestProgressMap[requestId] = { status: 'generating', progress: 10, message: 'A iniciar fluxo de geração Mureka...' };
    
    // Update status to music_generating
    await supabase
      .from('song_requests')
      .update({ status: 'music_generating' })
      .eq('id', requestId);

    await supabase
      .from('songs')
      .update({ mureka_status: 'generating' })
      .eq('id', songId);

    requestProgressMap[requestId] = { status: 'generating', progress: 30, message: 'A submeter letra ao Mureka AI...' };

    // Call Mureka
    const { taskId, audioUrl } = await generateMurekaMusic(lyrics, musicStyle, songTitle);
    
    if (!audioUrl) {
      throw new Error('Mureka generation did not return a valid audio URL.');
    }

    console.log(`[Background Mureka] Generated successfully: ${audioUrl}`);
    requestProgressMap[requestId] = { status: 'generating', progress: 60, message: 'Geração concluída no Mureka. A descarregar ficheiro...' };

    // Download file from Mureka
    const tempMurekaPath = path.join(os.tmpdir(), `${songId}_mureka.flac`);
    await downloadFile(audioUrl, tempMurekaPath);

    requestProgressMap[requestId] = { status: 'generating', progress: 75, message: 'A guardar áudio original no Supabase Storage...' };

    // Upload original file to private 'full-audio' bucket
    const originalFilename = `songs/${songId}_original.flac`;
    const fullAudioUrl = await uploadToSupabase('full-audio', originalFilename, tempMurekaPath, 'audio/x-flac');
    console.log(`[Background Mureka] Saved original to full-audio: ${fullAudioUrl}`);

    requestProgressMap[requestId] = { status: 'generating', progress: 85, message: 'A cortar áudio para pré-visualização de 30 segundos (FFmpeg)...' };

    // Cut first 30 seconds for preview
    const tempPreviewPath = path.join(os.tmpdir(), `${songId}_preview.mp3`);
    await createPreviewAudio(tempMurekaPath, tempPreviewPath);

    requestProgressMap[requestId] = { status: 'generating', progress: 95, message: 'A publicar áudio de pré-visualização...' };

    // Upload preview to public 'preview' bucket
    const previewFilename = `previews/${songId}_preview.mp3`;
    const publicPreviewUrl = await uploadToSupabase('preview', previewFilename, tempPreviewPath, 'audio/mpeg');
    console.log(`[Background Mureka] Saved preview to public bucket: ${publicPreviewUrl}`);

    // Cleanup temp files
    try { fs.unlinkSync(tempMurekaPath); } catch {}
    try { fs.unlinkSync(tempPreviewPath); } catch {}

    // Update database
    await supabase
      .from('songs')
      .update({
        audio_url: fullAudioUrl,
        mureka_task_id: taskId,
        mureka_status: 'completed'
      })
      .eq('id', songId);

    await supabase
      .from('song_requests')
      .update({ status: 'preview_ready' })
      .eq('id', requestId);

    requestProgressMap[requestId] = { status: 'completed', progress: 100, message: 'Fluxo Mureka concluído com sucesso!' };
    console.log(`[Background Mureka] Workflow completed successfully for Request ${requestId}`);
  } catch (err: any) {
    console.error(`[Background Mureka] Error in background workflow:`, err);
    requestProgressMap[requestId] = { status: 'failed', progress: 100, message: 'Erro na geração Mureka', error: err.message || String(err) };
    await supabase
      .from('song_requests')
      .update({ status: 'failed' })
      .eq('id', requestId);
    await supabase
      .from('songs')
      .update({ mureka_status: 'failed' })
      .eq('id', songId);
  }
}

// Background workflow for ElevenLabs Voice Cloning, speech generation and FFmpeg mix
async function runBackgroundVoiceProcessingAndMix(
  requestId: string, 
  songId: string, 
  letterText: string
) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    console.log(`[Background Voice] Starting for Request ${requestId}, Song ${songId}`);
    requestProgressMap[requestId] = { status: 'voice_processing', progress: 10, message: 'A iniciar clonagem de voz e mistura...' };
    
    // 1. Get request details
    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(*)')
      .eq('id', requestId)
      .single();

    if (reqError || !requestData) {
      throw new Error(`Failed to fetch song request: ${reqError?.message}`);
    }

    const voiceSampleUrl = requestData.voice_sample_url;
    const songData = requestData.songs?.[0];
    if (!voiceSampleUrl) {
      throw new Error('No voice sample URL available.');
    }
    if (!songData || !songData.audio_url) {
      throw new Error('Mureka audio is not completed or missing.');
    }

    // 2. Download voice sample file
    console.log(`[Background Voice] Downloading voice sample: ${voiceSampleUrl}`);
    requestProgressMap[requestId] = { status: 'voice_processing', progress: 25, message: 'A transferir amostra de voz do cliente...' };
    const tempSamplePath = path.join(os.tmpdir(), `${requestId}_sample.wav`);
    await downloadFile(voiceSampleUrl, tempSamplePath);
    const sampleBuffer = fs.readFileSync(tempSamplePath);

    // 3. Call ElevenLabs Voice Cloning
    console.log(`[Background Voice] Creating cloned voice in ElevenLabs...`);
    requestProgressMap[requestId] = { status: 'voice_processing', progress: 45, message: 'A criar voz clonada no ElevenLabs (pode demorar)...' };
    const voiceId = await cloneElevenLabsVoice(
      `SeuBeat_${requestData.recipient_name || 'Voice'}`, 
      sampleBuffer, 
      'audio/wav'
    );
    console.log(`[Background Voice] Created Voice ID: ${voiceId}`);

    // Update elevenlabs_voice_id in database
    await supabase
      .from('song_requests')
      .update({ elevenlabs_voice_id: voiceId })
      .eq('id', requestId);

    // 4. Generate Speech (TTS) of the Letter
    console.log(`[Background Voice] Generating spoken letter via ElevenLabs TTS...`);
    requestProgressMap[requestId] = { status: 'voice_processing', progress: 65, message: 'A gerar narração de dedicatória via ElevenLabs...' };
    const ttsBuffer = await generateElevenLabsSpeechWithVoiceId(letterText, voiceId);
    
    // Save narration to voice-samples bucket
    const tempNarrationPath = path.join(os.tmpdir(), `${requestId}_narration.mp3`);
    fs.writeFileSync(tempNarrationPath, ttsBuffer);
    
    const narrationFilename = `narration/${requestId}_narration.mp3`;
    const clonedSpeechUrl = await uploadToSupabase('voice-samples', narrationFilename, tempNarrationPath, 'audio/mpeg');
    console.log(`[Background Voice] Uploaded narration to voice-samples: ${clonedSpeechUrl}`);

    // Update cloned_speech_url in database
    await supabase
      .from('song_requests')
      .update({ cloned_speech_url: clonedSpeechUrl })
      .eq('id', requestId);

    // 5. Download original Mureka song
    console.log(`[Background Voice] Downloading original song from storage...`);
    requestProgressMap[requestId] = { status: 'voice_processing', progress: 80, message: 'A descarregar a melodia original...' };
    const tempMurekaPath = path.join(os.tmpdir(), `${songId}_mureka.flac`);
    
    const murekaFilename = songData.audio_url.substring(songData.audio_url.indexOf('full-audio/') + 'full-audio/'.length);
    const { data: murekaBlob, error: murekaDownloadError } = await supabase.storage
      .from('full-audio')
      .download(murekaFilename);
      
    if (murekaDownloadError || !murekaBlob) {
      throw new Error(`Failed to download original song from storage: ${murekaDownloadError?.message}`);
    }
    const murekaBuffer = Buffer.from(await murekaBlob.arrayBuffer());
    fs.writeFileSync(tempMurekaPath, murekaBuffer);

    // 6. Mix using FFmpeg
    console.log(`[Background Voice] Mixing original song and narration...`);
    requestProgressMap[requestId] = { status: 'voice_processing', progress: 90, message: 'A misturar voz e melodia (FFmpeg)...' };
    const tempMixedPath = path.join(os.tmpdir(), `${songId}_mixed.mp3`);
    await mixAudio(tempMurekaPath, tempNarrationPath, tempMixedPath);

    // 7. Upload final mixed song to full-audio bucket
    const mixedFilename = `songs/${songId}_mixed.mp3`;
    const finalMixedAudioUrl = await uploadToSupabase('full-audio', mixedFilename, tempMixedPath, 'audio/mpeg');
    console.log(`[Background Voice] Uploaded final mixed audio: ${finalMixedAudioUrl}`);

    // Cleanup temp files
    try { fs.unlinkSync(tempSamplePath); } catch {}
    try { fs.unlinkSync(tempNarrationPath); } catch {}
    try { fs.unlinkSync(tempMurekaPath); } catch {}
    try { fs.unlinkSync(tempMixedPath); } catch {}

    // 8. Update database status to delivered
    await supabase
      .from('song_requests')
      .update({ 
        final_mixed_audio_url: finalMixedAudioUrl,
        status: 'delivered' 
      })
      .eq('id', requestId);

    // 9. Send Email
    requestProgressMap[requestId] = { status: 'voice_processing', progress: 95, message: 'A enviar email com a dedicatória final...' };
    const userEmail = requestData.users?.email;
    if (userEmail) {
      const slug = (requestData.recipient_name || 'especial')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-0]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const personalizedUrl = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${songId}`;
      
      console.log(`[Background Voice] Sending final email to ${userEmail}...`);
      await sendPersonalizedEmail(
        userEmail,
        requestData.recipient_name,
        personalizedUrl,
        letterText
      );
    }

    requestProgressMap[requestId] = { status: 'completed', progress: 100, message: 'Processamento de voz e entrega concluídos!' };
    console.log(`[Background Voice] Completed successfully for Request ${requestId}`);
  } catch (err: any) {
    console.error(`[Background Voice] Error:`, err);
    requestProgressMap[requestId] = { status: 'failed', progress: 100, message: 'Erro no processamento de voz', error: err.message || String(err) };
    await supabase
      .from('song_requests')
      .update({ status: 'failed' })
      .eq('id', requestId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// 1. Email proxy
app.post('/api/send-email', async (req, res) => {
  try {
    const { email, recipientName, personalizedUrl, letterText } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'O email é obrigatório.' });
    }

    const result = await sendPersonalizedEmail(
      email, 
      recipientName || 'Alguém especial', 
      personalizedUrl || 'https://teusom.com', 
      letterText || 'Fiz esta música com todo o amor da minha vida...'
    );

    res.json({ 
      success: true, 
      message: 'Email enviado com sucesso!', 
      result 
    });
  } catch (err: any) {
    console.error('Email action error:', err);
    res.status(500).json({ error: err.message || 'Erro ao disparar o email via Resend API.' });
  }
});

// 2. Generate Lyrics & Letter via Gemini
app.post('/api/generate-lyrics', async (req, res) => {
  try {
    const { 
      userNick, 
      recipientName, 
      recipientRelation, 
      occasion, 
      musicStyle, 
      voiceType,
      photoBase64,
      photoFilename,
      photoMimeType
    } = req.body;
    const prompt = selectPrompt(req.body);

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        songTitle: { type: Type.STRING, description: "A creative, beautiful title for the song in Portuguese" },
        lyrics: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "Array of 4-5 verses/choruses forming the complete song lyrics in Portuguese"
        },
        lyricsSnippet: { type: Type.STRING, description: "A beautiful, emotional 3-line sample from the chorus" },
        letterText: { type: Type.STRING, description: "A deeply moving, personalized dedication letter in Portuguese" }
      },
      required: ["songTitle", "lyrics", "lyricsSnippet", "letterText"]
    };

    console.log("Calling Gemini API with custom prompt...");
    const ai = getGeminiClient();
    const resultResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 1.0,
      }
    });

    const textOutput = resultResponse.text || '';
    const parsedData = JSON.parse(textOutput.trim());

    // Connect to Supabase
    const supabase = getSupabase();
    let dbSongId = null;
    let dbSongRequestId = null;
    let photoUrl = null;

    if (supabase) {
      // Upload photo if provided
      if (photoBase64) {
        try {
          const base64Data = photoBase64.replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `photos/${Date.now()}_${photoFilename || 'foto.jpg'}`;
          
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('voice-samples')
            .upload(filename, buffer, {
              contentType: photoMimeType || 'image/jpeg',
              upsert: false
            });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase
              .storage
              .from('voice-samples')
              .getPublicUrl(filename);
            photoUrl = urlData?.publicUrl || null;
            console.log(`[Photo Upload] Saved photo successfully: ${photoUrl}`);
          } else {
            console.error('Photo upload error:', uploadError);
          }
        } catch (photoErr) {
          console.error('Photo storage error:', photoErr);
        }
      }

      // 1. Insert User (Check if user already exists first, then handle auth/guest user creation)
      let userData: any = null;
      let userError: any = null;
      const userEmail = req.body.email || `guest_${randomUUID()}@seubeat.com`;

      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();

        if (existingUser) {
          userData = existingUser;
        } else {
          // Attempt to create the user in auth.users via admin API to satisfy foreign key constraint
          let userId = randomUUID() as any;
          try {
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: userEmail,
              email_confirm: true,
              user_metadata: { name: userNick }
            });
            if (authUser && authUser.user) {
              userId = authUser.user.id;
            } else {
              console.warn('Could not create auth user, falling back to random UUID. Error:', authError);
            }
          } catch (authCatchErr) {
            console.warn('Exception creating auth user, falling back to random UUID. Error:', authCatchErr);
          }

          // Insert into public.users
          const { data: newProfile, error: profileError } = await supabase
            .from('users')
            .insert([{
              id: userId,
              name: userNick || 'Autor',
              email: userEmail,
              phone: req.body.phone || null
            }])
            .select()
            .single();

          if (profileError) {
            const { data: retryUser } = await supabase
              .from('users')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();
            if (retryUser) {
              userData = retryUser;
            } else {
              userError = profileError;
            }
          } else {
            userData = newProfile;
          }
        }
      } catch (err) {
        userError = err;
      }
        
      if (!userError && userData) {
        // 2. Insert Song Request (status = draft)
        const { data: requestData, error: requestError } = await supabase
          .from('song_requests')
          .insert([{
            user_id: userData.id,
            recipient_name: recipientName || 'Destinatário',
            relationship: recipientRelation || req.body.recipientRelation || 'Parceiro',
            occasion: occasion || req.body.occasion || 'Homenagem',
            music_style: musicStyle || req.body.musicStyle || 'Pop Romântico',
            voice_type: voiceType || req.body.voiceType || 'Masculina',
            special_traits: req.body.specialTraits || req.body.special_traits || '',
            memory: req.body.memory || req.body.messageFromTheHeart || '',
            heart_message: req.body.heartMessage || req.body.heart_message || req.body.messageFromTheHeart || '',
            desired_emotion: req.body.desiredEmotion || req.body.desired_emotion || 'Emocionante',
            email: req.body.email || null,
            phone: req.body.phone || null,
            status: 'draft',
            photo_url: photoUrl
          }])
          .select()
          .single();

        if (!requestError && requestData) {
          dbSongRequestId = requestData.id;
          // 3. Insert Song
          const { data: songData, error: songError } = await supabase
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

          if (!songError && songData) {
            dbSongId = songData.id;
            
            // Update request status to lyrics_ready
            await supabase
              .from('song_requests')
              .update({ status: 'lyrics_ready' })
              .eq('id', dbSongRequestId);

            // Trigger background workflow for Mureka music generation & cut preview
            console.log(`[Generate Lyrics] Spawning background Mureka workflow...`);
            runBackgroundMurekaWorkflow(
              dbSongRequestId,
              dbSongId,
              musicStyle || 'Kizomba',
              parsedData.songTitle,
              parsedData.lyrics
            ).catch(err => {
              console.error('Background Mureka workflow promise catch:', err);
            });
          } else {
            console.error('Supabase song insert error:', songError);
          }
        } else {
          console.error('Supabase request insert error:', requestError);
        }
      } else {
        console.error('Supabase user insert error:', userError);
      }
    }

    res.json({
      success: true,
      sender: userNick || 'Autor',
      recipient: recipientName || 'Destinatário',
      dbSongId,
      dbSongRequestId,
      ...parsedData,
      photoUrl
    });

  } catch (err: any) {
    console.error('Gemini composition generation failed:', err);
    res.json({
      success: true,
      songTitle: `Melodia Para ${req.body.recipientName || 'Ti'}`,
      lyrics: [
        `No silêncio que o vento trouxe do mar de ${req.body.whereItHappened || 'Luanda'},`,
        `Fita meus olhos, ${req.body.recipientNick || req.body.recipientName || 'meu amor'}, és tu quem me comanda.`,
        `Lembra do riso em que o mundo parou naquele instante,`,
        `Nosso amor é Kizomba viva, forte e constante.`,
        `[Refrão]`,
        `Prometo segurar tua mão no compasso do dia,`,
        `Tornar cada detalhe simples numa bela harmonia,`,
        `Dizer ao peito que bate que és a minha alegria!`
      ],
      lyricsSnippet: `Lembra do riso em que o mundo parou naquele instante, nosso amor é Kizomba viva, forte e constante.`,
      letterText: req.body.messageFromTheHeart || 'Fiz esta música para que saibas que o meu amor por ti nunca vai acabar. És o meu porto seguro, a minha luz eterna.'
    });
  }
});

// 3. Fetch Song from Supabase by ID
app.get('/api/song/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase credentials missing' });
    }
    
    const { data: songData, error: songError } = await supabase
      .from('songs')
      .select('*, song_requests(*, users(*))')
      .eq('id', id)
      .single();
      
    if (songError || !songData) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const requestStatus = songData.song_requests?.status;
    let audioUrl = null;
    
    // Construct public preview URL
    const supabaseUrl = process.env.SUPABASE_URL || 'https://xdlssfxbndwuirwcofdx.supabase.co';
    const previewUrl = `${supabaseUrl}/storage/v1/object/public/preview/previews/${songData.id}_preview.mp3`;

    if (requestStatus === 'delivered' || requestStatus === 'paid') {
      // User has paid, generate signed URL for full audio (or mixed audio)
      const mixedUrl = songData.song_requests?.final_mixed_audio_url;
      const fullUrl = mixedUrl || songData.audio_url;
      
      if (fullUrl) {
        if (fullUrl.includes('full-audio')) {
          try {
            const filename = fullUrl.substring(fullUrl.indexOf('full-audio/') + 'full-audio/'.length);
            const { data: signedData, error: signedError } = await supabase.storage
              .from('full-audio')
              .createSignedUrl(filename, 60 * 60); // 1 hour
              
            if (!signedError && signedData) {
              audioUrl = signedData.signedUrl;
            } else {
              audioUrl = fullUrl;
            }
          } catch {
            audioUrl = fullUrl;
          }
        } else {
          audioUrl = fullUrl;
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...songData,
        audio_url: audioUrl || previewUrl, // Play full if paid/delivered, else preview
        preview_url: previewUrl
      }
    });
  } catch (err: any) {
    console.error('Fetch song error:', err);
    res.status(500).json({ error: 'Failed to fetch song from database' });
  }
});

// 4. Speech Preview (ElevenLabs - for preview audio only)
app.get('/api/speech-preview', async (req, res) => {
  try {
    const text = (req.query.text as string) || "Olá, preparei esta linda dedicatória para ti com todo o meu amor.";
    const voiceType = (req.query.voiceType as string) || "Masculina";
    const useClonedVoice = req.query.useClonedVoice === 'true';

    console.log(`Synthesizing speech: "${text.substring(0, 60)}..." | Voice: ${voiceType} | Cloned: ${useClonedVoice}`);
    const ttsResponse = await generateElevenLabsSpeech(text, voiceType, useClonedVoice);

    res.setHeader('Content-Type', 'audio/mpeg');
    const arrayBuffer = await ttsResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err: any) {
    console.error('ElevenLabs TTS synthesis failed, redirecting to fallback:', err);
    res.redirect('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  }
});

// 5. Submit Payment Proof (NEW)
app.post('/api/submit-payment', async (req, res) => {
  try {
    const { 
      songRequestId, 
      userEmail,
      plan, 
      amount,
      proofBase64,
      proofFilename,
      proofMimeType,
      voiceSampleBase64,
      voiceSampleFilename,
      voiceSampleMimeType
    } = req.body;

    if (!userEmail || !plan || !amount) {
      return res.status(400).json({ error: 'Dados de pagamento incompletos.' });
    }

    const supabase = getSupabase();
    let proofUrl = null;
    let voiceSampleUrl = null;

    // Upload proof to Supabase Storage if provided
    if (proofBase64 && supabase) {
      try {
        const base64Data = proofBase64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `proofs/${Date.now()}_${proofFilename || 'comprovativo.jpg'}`;
        
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('payment-proofs')
          .upload(filename, buffer, {
            contentType: proofMimeType || 'image/jpeg',
            upsert: false
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase
            .storage
            .from('payment-proofs')
            .getPublicUrl(filename);
          proofUrl = urlData?.publicUrl || null;
        } else {
          console.error('Storage upload error:', uploadError);
        }
      } catch (storageErr) {
        console.error('Storage error:', storageErr);
      }
    }

    // Upload voice sample if provided
    if (voiceSampleBase64 && supabase && songRequestId) {
      try {
        const base64Data = voiceSampleBase64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `voices/${Date.now()}_${voiceSampleFilename || 'sample.wav'}`;
        
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('voice-samples')
          .upload(filename, buffer, {
            contentType: voiceSampleMimeType || 'audio/wav',
            upsert: false
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase
            .storage
            .from('voice-samples')
            .getPublicUrl(filename);
          voiceSampleUrl = urlData?.publicUrl || null;
          console.log(`[Voice Upload] Saved voice sample successfully: ${voiceSampleUrl}`);
        } else {
          console.error('Voice sample upload error:', uploadError);
        }
      } catch (voiceErr) {
        console.error('Voice sample storage error:', voiceErr);
      }
    }

    // Insert payment record
    if (supabase) {
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          request_id: songRequestId || null,
          user_email: userEmail,
          plan,
          amount,
          proof_url: proofUrl,
          proof_filename: proofFilename || null,
          status: 'pending_verification'
        }])
        .select()
        .single();

      if (paymentError) {
        console.error('Payment insert error:', paymentError);
      } else {
        console.log('✅ Payment record created:', paymentData?.id);
      }

      // Update song_request status and voice_sample_url
      if (songRequestId) {
        const updatePayload: Record<string, any> = { status: 'payment_submitted' };
        if (voiceSampleUrl) {
          updatePayload.voice_sample_url = voiceSampleUrl;
        }
        await supabase
          .from('song_requests')
          .update(updatePayload)
          .eq('id', songRequestId);
      }
    }

    // Notificar todos os admins por email
    for (const adminEmail of ADMIN_EMAILS) {
      try {
        await sendPaymentNotificationEmail(adminEmail, userEmail, plan, amount);
        console.log(`✅ Notificação de pagamento enviada para: ${adminEmail}`);
      } catch (emailErr) {
        console.warn(`⚠️ Falha ao notificar admin ${adminEmail}:`, emailErr);
      }
    }

    res.json({ 
      success: true, 
      message: 'Comprovativo submetido com sucesso! Iremos verificar e entrar em contacto em breve.',
      proofReceived: !!proofUrl
    });

  } catch (err: any) {
    console.error('Payment submission error:', err);
    res.status(500).json({ error: err.message || 'Erro ao submeter comprovativo.' });
  }
});

// 6. Check payment status by email
app.get('/api/payment-status', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email obrigatório' });

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({ status: 'not_found' });
    }

    res.json({ status: data.status, payment: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'seubeat2024admin';

// Admin auth middleware
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['x-admin-password'] || req.query.adminPassword;
  if (authHeader !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }
  next();
}

// A. Admin dashboard stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
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
        const num = parseInt((p.amount || '0').replace(/\D/g, '')) / 100;
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
    res.status(500).json({ error: err.message });
  }
});

// B. Admin list payments
app.get('/api/admin/payments', adminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('payments')
      .select('*, song_requests(id, recipient_name, occasion, music_style, status, users(name, email))')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, payments: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// C. Admin approve payment → trigger voice mix if premium, else deliver standard
app.post('/api/admin/payment/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    // 1. Get payment and request info
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, song_requests(*, songs(*), users(*))')
      .eq('id', id)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    // 2. Mark payment as approved
    await supabase
      .from('payments')
      .update({ 
        status: 'approved', 
        notes: notes || null, 
        approved_at: new Date().toISOString() 
      })
      .eq('id', id);

    const songRequest = payment.song_requests as any;
    const requestId = payment.request_id;
    const songData = songRequest?.songs?.[0];
    const userEmail = songRequest?.users?.email;
    const letterText = songData?.letter_text || 'Preparámos uma dedicatória especial para si.';

    if (!requestId || !songData) {
      return res.status(400).json({ error: 'Dados da música em falta.' });
    }

    let voiceWorkflowTriggered = false;

    // 3. Check if the request has cloned voice sample
    if (songRequest.voice_sample_url) {
      voiceWorkflowTriggered = true;
      
      // Update status to voice_processing
      await supabase
        .from('song_requests')
        .update({ status: 'voice_processing' })
        .eq('id', requestId);

      console.log(`[Admin Approve] Request ${requestId} has voice sample. Spawning background voice cloning & mixing...`);
      runBackgroundVoiceProcessingAndMix(
        requestId,
        songData.id,
        letterText
      ).catch(err => {
        console.error('Error in runBackgroundVoiceProcessingAndMix:', err);
      });
    } else {
      // Standard flow: update request status to delivered immediately
      await supabase
        .from('song_requests')
        .update({ status: 'delivered' })
        .eq('id', requestId);

      // Send email
      if (userEmail) {
        const slug = (songRequest.recipient_name || 'especial')
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-0]+/g, '-')
          .replace(/(^-|-$)+/g, '');
        const songId = songData.id;
        const personalizedUrl = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${songId}`;
        
        console.log(`[Admin Approve] Sending final standard email to ${userEmail}...`);
        await sendPersonalizedEmail(
          userEmail,
          songRequest.recipient_name,
          personalizedUrl,
          letterText
        );
      }
    }

    res.json({ 
      success: true, 
      message: 'Pagamento aprovado com sucesso!',
      voiceWorkflowTriggered
    });
  } catch (err: any) {
    console.error('Approve payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// D. Admin reject payment
app.post('/api/admin/payment/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: payment } = await supabase
      .from('payments')
      .select('user_email, request_id')
      .eq('id', id)
      .single();

    await supabase
      .from('payments')
      .update({ status: 'rejected', notes: notes || null })
      .eq('id', id);

    if (payment?.request_id) {
      await supabase
        .from('song_requests')
        .update({ status: 'payment_rejected' })
        .eq('id', payment.request_id);
    }

    // Notify client by email
    if (payment?.user_email) {
      try {
        await sendPaymentRejectionEmail(payment.user_email, notes);
      } catch (emailErr) {
        console.warn('Rejection email error:', emailErr);
      }
    }

    res.json({ success: true, message: 'Pagamento rejeitado.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// E. Admin list all song requests (with plan details from payments)
app.get('/api/admin/requests', adminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('song_requests')
      .select('*, users(name, email, phone), songs(id, title, audio_url, mureka_status, created_at, letter_text, lyrics), payments(plan, amount, status)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, requests: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// F. Admin list all songs
app.get('/api/admin/songs', adminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('songs')
      .select('*, song_requests(recipient_name, music_style, occasion, users(name, email))')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, songs: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// G. Admin manually trigger Mureka for a specific song
app.post('/api/admin/song/:id/generate-music', adminAuth, async (req, res) => {
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

    // Mark as generating
    await supabase
      .from('songs')
      .update({ mureka_status: 'generating' })
      .eq('id', id);

    const { taskId, audioUrl } = await generateMurekaMusic(
      songData.lyrics || [],
      (songData.song_requests as any)?.music_style || 'Kizomba',
      songData.title || 'Música SeuBeat'
    );

    await supabase
      .from('songs')
      .update({ 
        mureka_task_id: taskId,
        mureka_status: audioUrl ? 'completed' : 'processing',
        audio_url: audioUrl || null
      })
      .eq('id', id);

    res.json({ success: true, taskId, audioUrl });
  } catch (err: any) {
    console.error('Manual Mureka trigger error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET progress tracking for background jobs
app.get('/api/admin/progress', adminAuth, (req, res) => {
  res.json(requestProgressMap);
});

// API Diagnostics and Health Endpoint
app.get('/api/admin/diagnostics', adminAuth, async (req, res) => {
  try {
    const [supabaseDiag, geminiDiag, elevenLabsDiag, murekaDiag, resendDiag] = await Promise.all([
      (async () => {
        const supabase = getSupabase();
        if (!supabase) return { ok: false, error: 'Cliente não inicializado' };
        try {
          const { data, error } = await supabase.storage.listBuckets();
          if (error) return { ok: false, error: error.message };
          return { ok: true, buckets: data.map(b => ({ name: b.name, public: b.public })) };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      })(),
      (async () => {
        if (!process.env.GEMINI_API_KEY) return { ok: false, error: 'GEMINI_API_KEY em falta' };
        try {
          const client = getGeminiClient();
          const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'ping',
            config: { maxOutputTokens: 5 }
          });
          if (response && response.text) return { ok: true };
          return { ok: false, error: 'Nenhum texto retornado' };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      })(),
      (async () => {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return { ok: false, error: 'ELEVENLABS_API_KEY em falta' };
        try {
          const res = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: { 'xi-api-key': key }
          });
          if (!res.ok) return { ok: false, error: `HTTP ${res.status} - ${await res.text()}` };
          const data = await res.json();
          return {
            ok: true,
            info: {
              characterCount: data.subscription?.character_count,
              characterLimit: data.subscription?.character_limit,
              tier: data.subscription?.tier
            }
          };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      })(),
      (async () => {
        const key = process.env.MUREKA_API_KEY;
        if (!key) return { ok: false, error: 'MUREKA_API_KEY em falta' };
        try {
          const res = await fetch('https://api.mureka.ai/v1/song/query/conn_test_id', {
            headers: { 'Authorization': `Bearer ${key}` }
          });
          if (res.status === 401 || res.status === 403) {
            return { ok: false, error: `Autenticação falhou (HTTP ${res.status})` };
          }
          return { ok: true };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      })(),
      (async () => {
        const key = process.env.RESEND_API_KEY;
        if (!key) return { ok: false, error: 'RESEND_API_KEY em falta' };
        try {
          const res = await fetch('https://api.resend.com/domains', {
            headers: { 'Authorization': `Bearer ${key}` }
          });
          if (!res.ok) return { ok: false, error: `HTTP ${res.status} - ${await res.text()}` };
          const data = await res.json();
          return { ok: true, domains: data.data || [] };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      })()
    ]);

    res.json({
      supabase: supabaseDiag,
      gemini: geminiDiag,
      elevenlabs: elevenLabsDiag,
      mureka: murekaDiag,
      resend: resendDiag
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Retry background workflow for failed requests
app.post('/api/admin/request/:id/retry', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(*)')
      .eq('id', id)
      .single();

    if (reqError || !requestData) return res.status(404).json({ error: 'Pedido não encontrado' });
    const songData = requestData.songs?.[0];
    if (!songData) return res.status(400).json({ error: 'Música associada em falta.' });

    // Reset progress in memory
    requestProgressMap[id] = { status: 'generating', progress: 5, message: 'A reiniciar fluxo completo...' };

    // Set statuses back to generating
    await supabase.from('song_requests').update({ status: 'music_generating' }).eq('id', id);
    await supabase.from('songs').update({ mureka_status: 'generating' }).eq('id', songData.id);

    // Trigger background workflow
    runBackgroundMurekaWorkflow(
      id,
      songData.id,
      requestData.music_style || 'Kizomba',
      songData.title || 'Música SeuBeat',
      songData.lyrics || []
    ).catch(err => {
      console.error('Background Mureka workflow retry catch:', err);
    });

    res.json({ success: true, message: 'Fluxo de geração reiniciado.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Force Voice processing and mixing retry
app.post('/api/admin/request/:id/force-voice', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(*)')
      .eq('id', id)
      .single();

    if (reqError || !requestData) return res.status(404).json({ error: 'Pedido não encontrado' });
    const songData = requestData.songs?.[0];
    if (!songData) return res.status(400).json({ error: 'Música associada em falta.' });
    if (!requestData.voice_sample_url) return res.status(400).json({ error: 'Este pedido não tem amostra de voz.' });

    // Set status to voice_processing in DB
    await supabase
      .from('song_requests')
      .update({ status: 'voice_processing' })
      .eq('id', id);

    requestProgressMap[id] = { status: 'voice_processing', progress: 5, message: 'A reiniciar processamento de voz...' };

    runBackgroundVoiceProcessingAndMix(
      id,
      songData.id,
      songData.letter_text || 'Dedicatória especial para si.'
    ).catch(err => {
      console.error('Background voice retry catch:', err);
    });

    res.json({ success: true, message: 'Fluxo de clonagem e mistura de voz reiniciado.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Resend Delivery Email
app.post('/api/admin/request/:id/resend-email', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data: requestData, error: reqError } = await supabase
      .from('song_requests')
      .select('*, songs(*), users(*)')
      .eq('id', id)
      .single();

    if (reqError || !requestData) return res.status(404).json({ error: 'Pedido não encontrado' });
    const songData = requestData.songs?.[0];
    if (!songData) return res.status(400).json({ error: 'Música associada em falta.' });
    
    const userEmail = requestData.users?.email;
    if (!userEmail) return res.status(400).json({ error: 'Email do utilizador não encontrado.' });

    const slug = (requestData.recipient_name || 'especial')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-0]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const personalizedUrl = `${process.env.APP_URL || 'http://localhost:3000'}/song/${slug}?id=${songData.id}`;
    
    console.log(`[Admin Resend Email] Sending email to ${userEmail}...`);
    await sendPersonalizedEmail(
      userEmail,
      requestData.recipient_name,
      personalizedUrl,
      songData.letter_text || 'Preparámos uma canção e dedicatória de amor...'
    );

    res.json({ success: true, message: 'Email reenviado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Edit Song Lyrics
app.post('/api/admin/song/:id/edit-lyrics', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, lyrics, letterText } = req.body;
    
    if (!title || !lyrics) return res.status(400).json({ error: 'Título e letra são obrigatórios.' });

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('songs')
      .update({
        title,
        lyrics: Array.isArray(lyrics) ? lyrics : lyrics.split('\n').filter((l: string) => l.trim().length > 0),
        letter_text: letterText || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: 'Música atualizada.', song: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Audio File Upload
app.post('/api/admin/song/:id/upload-audio', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { audioBase64, audioFilename, audioMimeType } = req.body;

    if (!audioBase64) return res.status(400).json({ error: 'Dados do áudio em falta.' });

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    // Download the song/request details to update request status
    const { data: songData, error: songError } = await supabase
      .from('songs')
      .select('*, song_requests(*)')
      .eq('id', id)
      .single();

    if (songError || !songData) return res.status(404).json({ error: 'Música não encontrada.' });

    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `songs/${Date.now()}_${audioFilename || 'manual_audio.mp3'}`;

    // Upload to 'full-audio' private bucket
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('full-audio')
      .upload(filename, buffer, {
        contentType: audioMimeType || 'audio/mpeg',
        upsert: true
      });

    if (uploadError) return res.status(500).json({ error: `Upload falhou: ${uploadError.message}` });

    const { data: urlData } = supabase.storage.from('full-audio').getPublicUrl(filename);
    const fullAudioUrl = urlData?.publicUrl || '';

    // Copy to public preview bucket as mp3
    const previewFilename = `previews/${id}_preview.mp3`;
    const { error: previewUploadErr } = await supabase
      .storage
      .from('preview')
      .upload(previewFilename, buffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (previewUploadErr) {
      console.warn('Manual upload could not upload preview:', previewUploadErr.message);
    }

    // Update database
    await supabase
      .from('songs')
      .update({
        audio_url: fullAudioUrl,
        mureka_status: 'completed'
      })
      .eq('id', id);

    if (songData.request_id) {
      await supabase
        .from('song_requests')
        .update({ status: 'delivered' })
        .eq('id', songData.request_id);
    }

    res.json({ success: true, message: 'Áudio carregado manualmente com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// H. Admin list all clients
app.get('/api/admin/clients', adminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'DB não disponível' });

    const { data, error } = await supabase
      .from('users')
      .select('*, song_requests(id, status, created_at)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, clients: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH
// ─────────────────────────────────────────────────────────────────────────────

const getRedirectUri = (req: express.Request) => {
  if (process.env.APP_URL) {
    const rawUrl = process.env.APP_URL.trim();
    const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    return `${cleanUrl}/auth/callback`;
  }
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${host}/auth/callback`;
};

app.get('/api/auth/google/status', (req, res) => {
  const clientId = process.env.OAUTH_CLIENT_ID || process.env.CLIENT_ID || '';
  const clientSecret = process.env.OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET || '';
  res.json({
    configured: !!(clientId && clientSecret),
    clientId: clientId ? `${clientId.substring(0, 10)}...` : null
  });
});

app.get('/api/auth/google/url', (req, res) => {
  const clientId = process.env.OAUTH_CLIENT_ID || process.env.CLIENT_ID || '';
  if (!clientId) {
    return res.status(400).json({
      error: 'Google OAuth Client ID não configurado.',
      configured: false
    });
  }

  const redirectUri = getRedirectUri(req);
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });

  res.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    configured: true
  });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) throw new Error(String(error));
    if (!code) throw new Error('Código de autorização não fornecido pelo Google.');

    const clientId = process.env.OAUTH_CLIENT_ID || process.env.CLIENT_ID || '';
    const clientSecret = process.env.OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET || '';
    const redirectUri = getRedirectUri(req);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Troca de token falhou: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    let profile = { name: 'Compositor SeuBeat', email: '', picture: '' };
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) profile = await profileRes.json();
    } catch (e) {
      console.error('Erro ao recolher perfil:', e);
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conexão Concluída | SeuBeat</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0c0a09; color: #f5f5f4; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .spinner { border: 3px solid rgba(245, 158, 11, 0.1); width: 40px; height: 40px; border-radius: 50%; border-left-color: #f59e0b; animation: spin 1s linear infinite; margin-bottom: 20px; }
            h2 { font-size: 20px; margin: 0 0 8px 0; color: #f59e0b; }
            p { color: #a8a29e; font-size: 14px; margin: 0; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <h2>Conexão bem-sucedida!</h2>
          <p>A sincronizar o seu Google Drive. Esta janela fechará já...</p>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_DRIVE_AUTH_SUCCESS',
                  accessToken: '${accessToken}',
                  profile: ${JSON.stringify(profile)}
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            } catch (err) {
              console.error(err);
              document.body.innerHTML = "<h3>Concluido com sucesso. Por favor, volte ao ecrã do SeuBeat.</h3>";
            }
          </script>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error('Erro no callback do Google OAuth:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Erro de Ligação | SeuBeat</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0c0a09; color: #f5f5f4; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 24px; }
            .card { border: 1px solid #7f1d1d; background-color: rgba(127, 29, 29, 0.15); padding: 32px 24px; border-radius: 16px; max-width: 480px; }
            h2 { color: #f87171; margin: 0 0 12px 0; font-size: 20px; }
            p { color: #d6d3d1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0; }
            button { background-color: #ef4444; border: none; color: white; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Ligação Falhada</h2>
            <p>${err.message || 'Ocorreu um problema ao comunicar com o servidor do Google.'}</p>
            <button onclick="window.close()">Fechar Janela</button>
          </div>
        </body>
      </html>
    `);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VITE / STATIC SETUP
// ─────────────────────────────────────────────────────────────────────────────

async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware loaded under development mode.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
