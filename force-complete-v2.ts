import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uqmqkntnpuecswcrtulz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbXFrbnRucHVlY3N3Y3J0dWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMwNjIzMCwiZXhwIjoyMTAyODgyMjMwfQ.yGcVG1RTqqRoj-dMH0k0lhLGHtbniPxdHAGo3v0wT10'
);

async function forceComplete() {
  const SONG_ID = 'ef2905f5-5066-4c77-a800-26573dc0157f';
  const REQUEST_ID = '18508bc5-8a16-46c2-b92e-3f8fd39e6597';
  const TASK_ID = '52d7f402a8cd806e7bd29796d23acb58';
  
  console.log('=== Forçando conclusão do workflow ===\n');
  
  // URLs baseadas no padrão do storage
  const fullAudioUrl = `https://uqmqkntnpuecswcrtulz.supabase.co/storage/v1/object/public/full-audio/songs/${SONG_ID}_original.mp3`;
  const previewUrl = `https://uqmqkntnpuecswcrtulz.supabase.co/storage/v1/object/public/preview/previews/${SONG_ID}_preview.mp3`;
  
  // 1. Verificar se os arquivos existem no storage
  console.log('1. Verificando arquivos no storage...');
  try {
    const audioRes = await fetch(fullAudioUrl, { method: 'HEAD' });
    console.log(`   Áudio completo: ${audioRes.status} ${audioRes.headers.get('content-length') || '?'} bytes`);
  } catch (e) {
    console.log(`   Áudio completo: ERRO - ${e}`);
  }
  
  try {
    const previewRes = await fetch(previewUrl, { method: 'HEAD' });
    console.log(`   Preview: ${previewRes.status} ${previewRes.headers.get('content-length') || '?'} bytes`);
  } catch (e) {
    console.log(`   Preview: ERRO - ${e}`);
  }
  
  // 2. Atualizar song para completed
  console.log('\n2. Atualizando song para completed...');
  const { error: songError } = await supabase
    .from('songs')
    .update({
      audio_url: fullAudioUrl,
      full_song_url: fullAudioUrl,
      preview_url: previewUrl,
      duration: 239,
      mureka_task_id: TASK_ID,
      mureka_status: 'completed'
    })
    .eq('id', SONG_ID);
  
  if (songError) {
    console.error('Erro ao atualizar song:', songError);
    return;
  }
  console.log('✅ Song atualizada para completed');
  
  // 3. Atualizar request para approved (já tem payment approved)
  console.log('\n3. Atualizando request para approved...');
  const { error: reqError } = await supabase
    .from('song_requests')
    .update({
      status: 'approved',
      deliver_at: new Date('2026-08-21T17:30:45.054Z').toISOString(), // payment approved + 24h
      final_mixed_audio_url: fullAudioUrl
    })
    .eq('id', REQUEST_ID);
  
  if (reqError) {
    console.error('Erro ao atualizar request:', reqError);
    return;
  }
  console.log('✅ Request atualizado para approved');
  
  // 4. Verificar
  const { data: song } = await supabase.from('songs').select('id, mureka_status, audio_url, preview_url, duration').eq('id', SONG_ID).single();
  const { data: req } = await supabase.from('song_requests').select('id, status, deliver_at, final_mixed_audio_url').eq('id', REQUEST_ID).single();
  
  console.log('\n🎵 Song:', JSON.stringify(song, null, 2));
  console.log('\n📋 Request:', JSON.stringify(req, null, 2));
  
  console.log('\n✅ Conclusão forçada! Agora entregar manualmente.');
}

forceComplete().catch(console.error);