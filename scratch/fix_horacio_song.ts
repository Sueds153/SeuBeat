import dotenv from 'dotenv';
dotenv.config();
import { validateEnv } from '../server/config/env';
validateEnv();

import { querySunoTask } from '../server/services/suno';
import { getAdminSupabase } from '../server/services/supabase';
import { persistGeneratedSunoAudio } from '../server/services/workflow';

async function fixHoracioSong() {
  const taskId = '1a4f1aae79ef67b0dc3ca7bd857835c6';
  const songId = '73474c9e-1235-4030-8218-b81d77292cfc';
  const requestId = '18508bc5-8a16-46c2-b92e-3f8fd39e6597';

  console.log('1. A consultar a Suno API para o task ID:', taskId);
  const taskResult = await querySunoTask(taskId);
  console.log('Resultado da Suno Task:', JSON.stringify(taskResult, null, 2));

  if (!taskResult || !taskResult.audioUrl) {
    console.error('❌ Não foi possível obter o audioUrl da Suno API!');
    return;
  }

  console.log('2. Suno Audio URL obtido:', taskResult.audioUrl);
  console.log('3. A descarregar áudio da Suno, processar fades/preview e guardar no Cloudflare R2 / Storage atual...');

  const { fullAudioUrl, publicPreviewUrl, duration } = await persistGeneratedSunoAudio(songId, taskId, taskResult.audioUrl);

  console.log('4. Novas URLs geradas no Storage:');
  console.log('   - Audio URL:', fullAudioUrl);
  console.log('   - Preview URL:', publicPreviewUrl);
  console.log('   - Duração (segundos):', duration);

  const supabase = getAdminSupabase();
  const { error: songUpdateError } = await supabase
    .from('songs')
    .update({
      audio_url: fullAudioUrl,
      full_song_url: fullAudioUrl,
      preview_url: publicPreviewUrl,
      duration,
      mureka_task_id: taskId,
      mureka_status: 'completed'
    })
    .eq('id', songId);

  if (songUpdateError) {
    console.error('❌ Erro ao atualizar a tabela songs:', songUpdateError);
    return;
  }

  console.log('✅ Tabela songs atualizada com sucesso!');

  // Atualiza o pedido para entregue com as novas URLs
  const { error: reqUpdateError } = await supabase
    .from('song_requests')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (reqUpdateError) {
    console.error('Erro ao atualizar song_requests:', reqUpdateError);
  } else {
    console.log('✅ Estado do pedido 18508bc5 confirmado como DELIVERED!');
  }
}

fixHoracioSong().then(() => process.exit(0)).catch(console.error);
