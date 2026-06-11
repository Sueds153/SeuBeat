const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAll() {
  console.log('\n=== VERIFICAÇÃO SUPABASE — SeuBeat ===\n');

  // 1. Verificar tabelas
  console.log('--- TABELAS ---');
  const tables = ['users', 'song_requests', 'songs', 'payments'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log('❌ ' + t + ': ERRO — ' + error.message);
    } else {
      console.log('✅ ' + t + ': OK (' + count + ' registos)');
    }
  }

  // 2. Verificar colunas da tabela payments
  console.log('\n--- COLUNAS CRÍTICAS (payments) ---');
  const { data: paymentRow, error: colErr } = await supabase
    .from('payments')
    .select('id, proof_filename, proof_url, status, user_email, plan, amount')
    .limit(1);
  if (colErr) {
    console.log('❌ Colunas de payments: ERRO — ' + colErr.message);
  } else {
    console.log('✅ Colunas de payments: OK (proof_filename existe)');
  }

  // 3. Verificar colunas da tabela song_requests
  console.log('\n--- COLUNAS CRÍTICAS (song_requests) ---');
  const { data: srRow, error: srErr } = await supabase
    .from('song_requests')
    .select('id, status, voice_sample_url, final_mixed_audio_url, photo_url')
    .limit(1);
  if (srErr) {
    console.log('❌ Colunas de song_requests: ERRO — ' + srErr.message);
  } else {
    console.log('✅ Colunas de song_requests: OK (todas existem)');
  }

  // 4. Verificar buckets de storage
  console.log('\n--- BUCKETS DE STORAGE ---');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log('❌ Buckets: ERRO — ' + bErr.message);
  } else {
    const needed = ['payment-proofs', 'full-audio', 'preview', 'voice-samples'];
    buckets.forEach(b => {
      const icon = needed.includes(b.name) ? '✅' : '⚠️';
      console.log(icon + ' ' + b.name + ' (' + (b.public ? 'público' : 'privado') + ')');
    });
    needed.forEach(n => {
      if (!buckets.find(b => b.name === n)) {
        console.log('❌ FALTANDO: ' + n);
      }
    });
    if (needed.every(n => buckets.find(b => b.name === n))) {
      console.log('\n✅ Todos os 4 buckets existem!');
    }
  }

  // 5. Teste de upload no bucket preview
  console.log('\n--- TESTE DE UPLOAD (bucket preview) ---');
  const testData = Buffer.from('SeuBeat test file');
  const { data: uploadTest, error: uploadErr } = await supabase.storage
    .from('preview')
    .upload('test_connection.txt', testData, { upsert: true });
  if (uploadErr) {
    console.log('❌ Upload para preview: ERRO — ' + uploadErr.message);
  } else {
    console.log('✅ Upload para preview: OK');
    // Limpar ficheiro de teste
    await supabase.storage.from('preview').remove(['test_connection.txt']);
  }

  console.log('\n=== FIM DA VERIFICAÇÃO ===\n');
}

checkAll().catch(console.error);
