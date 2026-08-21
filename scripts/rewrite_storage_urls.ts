import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const OLD_PROJECT = 'xdlssfxbndwuirwcofdx';
const NEW_PROJECT = 'uqmqkntnpuecswcrtulz';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const supabase = createClient(url, key, { auth: { persistSession: false } });

function rewriteUrl(oldUrl: string | null): string | null {
  if (!oldUrl) return null;
  return oldUrl.replace(
    `https://${OLD_PROJECT}.supabase.co`,
    `https://${NEW_PROJECT}.supabase.co`
  );
}

async function main() {
  console.log('🔄 A reescrever URLs do Supabase antigo para o novo...\n');

  // 1. Songs: audio_url, preview_url, full_song_url
  const { data: songs, error: songsErr } = await supabase
    .from('songs')
    .select('id, audio_url, preview_url, full_song_url')
    .or(`audio_url.like.%${OLD_PROJECT}%,preview_url.like.%${OLD_PROJECT}%,full_song_url.like.%${OLD_PROJECT}%`);

  if (songsErr) { console.error('Erro ao listar songs:', songsErr.message); process.exit(1); }

  console.log(`📀 Songs com URLs antigas: ${songs?.length ?? 0}`);

  let songsUpdated = 0;
  for (const song of songs ?? []) {
    const updates: Record<string, string | null> = {};
    const newAudio = rewriteUrl(song.audio_url);
    const newPreview = rewriteUrl(song.preview_url);
    const newFull = rewriteUrl(song.full_song_url);

    if (newAudio !== song.audio_url) updates.audio_url = newAudio;
    if (newPreview !== song.preview_url) updates.preview_url = newPreview;
    if (newFull !== song.full_song_url) updates.full_song_url = newFull;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('songs').update(updates).eq('id', song.id);
      if (error) {
        console.error(`  ❌ Song ${song.id}: ${error.message}`);
      } else {
        songsUpdated++;
      }
    }
  }
  console.log(`  ✅ Songs atualizadas: ${songsUpdated}`);

  // 2. song_requests: photo_url, voice_sample_url, cloned_speech_url, final_mixed_audio_url
  const { data: requests, error: reqErr } = await supabase
    .from('song_requests')
    .select('id, photo_url, voice_sample_url, cloned_speech_url, final_mixed_audio_url')
    .or(`photo_url.like.%${OLD_PROJECT}%,voice_sample_url.like.%${OLD_PROJECT}%,final_mixed_audio_url.like.%${OLD_PROJECT}%`);

  if (reqErr) { console.error('Erro ao listar song_requests:', reqErr.message); process.exit(1); }

  console.log(`\n📋 Song requests com URLs antigas: ${requests?.length ?? 0}`);

  let reqsUpdated = 0;
  for (const req of requests ?? []) {
    const updates: Record<string, string | null> = {};
    const newPhoto = rewriteUrl(req.photo_url);
    const newVoice = rewriteUrl(req.voice_sample_url);
    const newCloned = rewriteUrl(req.cloned_speech_url);
    const newFinal = rewriteUrl(req.final_mixed_audio_url);

    if (newPhoto !== req.photo_url) updates.photo_url = newPhoto;
    if (newVoice !== req.voice_sample_url) updates.voice_sample_url = newVoice;
    if (newCloned !== req.cloned_speech_url) updates.cloned_speech_url = newCloned;
    if (newFinal !== req.final_mixed_audio_url) updates.final_mixed_audio_url = newFinal;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('song_requests').update(updates).eq('id', req.id);
      if (error) {
        console.error(`  ❌ Request ${req.id}: ${error.message}`);
      } else {
        reqsUpdated++;
      }
    }
  }
  console.log(`  ✅ Song requests atualizados: ${reqsUpdated}`);

  // 3. payments: proof_url
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, proof_url')
    .like('proof_url', `%${OLD_PROJECT}%`);

  if (!payErr) {
    console.log(`\n💳 Payments com URLs antigas: ${payments?.length ?? 0}`);
    let paysUpdated = 0;
    for (const pay of payments ?? []) {
      const newProof = rewriteUrl(pay.proof_url);
      if (newProof !== pay.proof_url) {
        const { error } = await supabase.from('payments').update({ proof_url: newProof }).eq('id', pay.id);
        if (!error) paysUpdated++;
      }
    }
    console.log(`  ✅ Payments atualizados: ${paysUpdated}`);
  }

  console.log('\n🎉 Reescrita de URLs concluída com sucesso!');
  console.log('⚠️  NOTA: Os ficheiros de áudio e fotos ainda estão físicamente no storage antigo.');
  console.log('   As músicas entregues (delivered) não vão tocar até os ficheiros serem migrados.');
}

main().catch(err => console.error('Erro fatal:', err));
