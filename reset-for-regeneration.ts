import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uqmqkntnpuecswcrtulz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbXFrbnRucHVlY3N3Y3J0dWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMwNjIzMCwiZXhwIjoyMTAyODgyMjMwfQ.yGcVG1RTqqRoj-dMH0k0lhLGHtbniPxdHAGo3v0wT10'
);

async function resetForRegeneration() {
  const SONG_ID = 'ef2905f5-5066-4c77-a800-26573dc0157f';
  const REQUEST_ID = '18508bc5-8a16-46c2-b92e-3f8fd39e6597';
  
  console.log('=== Resetando para nova geração ===\n');
  
  // 1. Reset song
  console.log('1. Resetando song...');
  const { error: songError } = await supabase
    .from('songs')
    .update({
      mureka_status: 'generating',
      mureka_task_id: null,
      audio_url: null,
      preview_url: null,
      full_song_url: null,
      duration: null
    })
    .eq('id', SONG_ID);
  
  if (songError) {
    console.error('Erro song:', songError);
    return;
  }
  console.log('✅ Song resetada para generating');
  
  // 2. Reset request
  console.log('\n2. Resetando request para music_processing...');
  const { error: reqError } = await supabase
    .from('song_requests')
    .update({
      status: 'music_processing',
      deliver_at: null,
      delivered_at: null
    })
    .eq('id', REQUEST_ID);
  
  if (reqError) {
    console.error('Erro request:', reqError);
    return;
  }
  console.log('✅ Request resetado');
  
  // 3. Verificar
  const { data: song } = await supabase.from('songs').select('id, mureka_status, mureka_task_id, audio_url').eq('id', SONG_ID).single();
  const { data: req } = await supabase.from('song_requests').select('id, status, deliver_at, delivered_at').eq('id', REQUEST_ID).single();
  
  console.log('\n🎵 Song:', JSON.stringify(song, null, 2));
  console.log('\n📋 Request:', JSON.stringify(req, null, 2));
  
  console.log('\n✅ Pronto! O stuckMusicRecoveryScheduler (roda a cada 5 min no Render) vai detectar e gerar novo áudio.');
  console.log('   Aguarde ~3-5 minutos e verifique novamente.');
}

resetForRegeneration().catch(console.error);