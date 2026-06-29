const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkAll() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   VERIFICAÇÃO SUPABASE — SeuBeat      ║');
  console.log('╚════════════════════════════════════════╝\n');

  let allOk = true;

  // 1. Verificar tabelas
  console.log('📋 TABELAS');
  console.log('─────────────────────────');
  const tables = ['users', 'song_requests', 'songs', 'payments'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log('  ❌ ' + t + ' — ' + error.message);
      allOk = false;
    } else {
      console.log('  ✅ ' + t + ' (' + count + ' registos)');
    }
  }

  // 2. Verificar colunas críticas
  console.log('\n🔎 COLUNAS CRÍTICAS');
  console.log('─────────────────────────');

  const paymentCols = 'id, proof_url, proof_filename, status, user_email, plan, amount, notes, approved_at';
  const { error: colPayErr } = await supabase.from('payments').select(paymentCols).limit(1);
  if (colPayErr) {
    console.log('  ❌ payments: ' + colPayErr.message);
    allOk = false;
  } else {
    console.log('  ✅ payments: todas as colunas OK');
  }

  const srCols = 'id, status, voice_sample_url, final_mixed_audio_url, photo_url, elevenlabs_voice_id';
  const { error: colSrErr } = await supabase.from('song_requests').select(srCols).limit(1);
  if (colSrErr) {
    console.log('  ❌ song_requests: ' + colSrErr.message);
    allOk = false;
  } else {
    console.log('  ✅ song_requests: todas as colunas OK');
  }

  // 3. Verificar buckets via upload de teste
  console.log('\n🪣 BUCKETS DE STORAGE (teste de upload)');
  console.log('─────────────────────────');
  const testFile = Buffer.from('seubeat-check');
  const testFilename = '.check_' + Date.now() + '.txt';
  const buckets = [
    { name: 'payment-proofs', pub: false },
    { name: 'full-audio',     pub: false },
    { name: 'preview',        pub: true },
    { name: 'voice-samples',  pub: false }
  ];

  for (const b of buckets) {
    const { error: upErr } = await supabase.storage.from(b.name).upload(testFilename, testFile, { upsert: true });
    if (upErr) {
      console.log('  ❌ ' + b.name + ' — ' + upErr.message);
      allOk = false;
    } else {
      console.log('  ✅ ' + b.name + ' (' + (b.pub ? 'público' : 'privado') + ')');
      await supabase.storage.from(b.name).remove([testFilename]);
    }
  }

  // 4. Resumo final
  console.log('\n╔════════════════════════════════════════╗');
  if (allOk) {
    console.log('║  ✅ TUDO EM ORDEM! SeuBeat pronto.    ║');
  } else {
    console.log('║  ⚠️  Há problemas para resolver acima. ║');
  }
  console.log('╚════════════════════════════════════════╝\n');
}

checkAll().catch(console.error);
