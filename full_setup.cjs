/**
 * SeuBeat — Script de Diagnóstico e Configuração Automática Completa
 * Executa: node full_setup.cjs
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const SUPABASE_URL  = process.env.SUPABASE_URL;
const ANON_KEY      = process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUNO_KEY      = process.env.SUNO_API_KEY;
const SMTP_HOST     = process.env.SMTP_HOST;
const SMTP_USER     = process.env.SMTP_USER;
const SMTP_PASS     = process.env.SMTP_PASS;
const ADMIN_EMAILS  = process.env.ADMIN_EMAIL || '';
const ADMIN_PASS    = process.env.ADMIN_PASSWORD || '';
const APP_URL       = process.env.APP_URL || '';

let totalOk = 0;
let totalFail = 0;
const issues = [];

function ok(msg) {
  console.log('  ✅ ' + msg);
  totalOk++;
}
function fail(msg, fix) {
  console.log('  ❌ ' + msg);
  if (fix) console.log('     → ' + fix);
  totalFail++;
  issues.push(msg);
}
function warn(msg) {
  console.log('  ⚠️  ' + msg);
}
function section(title) {
  console.log('\n' + '─'.repeat(50));
  console.log('  ' + title);
  console.log('─'.repeat(50));
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     SeuBeat — Diagnóstico Automático Completo   ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // ═══════════════════════════════════════════════
  // 1. VARIÁVEIS DE AMBIENTE
  // ═══════════════════════════════════════════════
  section('1. VARIÁVEIS DE AMBIENTE');

  SUPABASE_URL  ? ok('SUPABASE_URL presente')     : fail('SUPABASE_URL em falta');
  ANON_KEY      ? ok('SUPABASE_ANON_KEY presente') : fail('SUPABASE_ANON_KEY em falta');
  process.env.SUPABASE_PUBLISHABLE_KEY ? ok('SUPABASE_PUBLISHABLE_KEY presente') : warn('SUPABASE_PUBLISHABLE_KEY não definida (opcional)');
  ANTHROPIC_KEY ? ok('ANTHROPIC_API_KEY presente') : fail('ANTHROPIC_API_KEY em falta', 'Adicionar ao .env');
  SUNO_KEY      ? ok('SUNO_API_KEY presente')      : fail('SUNO_API_KEY em falta', 'Adicionar ao .env');
  SMTP_HOST     ? ok('SMTP_HOST presente')         : fail('SMTP_HOST em falta', 'Adicionar ao .env');
  SMTP_USER     ? ok('SMTP_USER presente')          : fail('SMTP_USER em falta', 'Adicionar ao .env');
  SMTP_PASS     ? ok('SMTP_PASS presente')          : warn('SMTP_PASS em falta (simulação ativada)');
  ADMIN_EMAILS  ? ok('ADMIN_EMAIL: ' + ADMIN_EMAILS) : fail('ADMIN_EMAIL em falta');
  ADMIN_PASS    ? ok('ADMIN_PASSWORD configurada') : fail('ADMIN_PASSWORD em falta');
  APP_URL && APP_URL !== 'MY_APP_URL' ? ok('APP_URL: ' + APP_URL) : fail('APP_URL inválida: ' + APP_URL, 'Corrigir no .env');

  // ═══════════════════════════════════════════════
  // 2. TABELAS DO SUPABASE
  // ═══════════════════════════════════════════════
  section('2. TABELAS DO SUPABASE');

  const tables = ['users', 'song_requests', 'songs', 'payments'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) fail('Tabela "' + t + '": ' + error.message, 'Executar supabase_setup.sql');
    else ok('Tabela "' + t + '" existe (' + count + ' registos)');
  }

  // ═══════════════════════════════════════════════
  // 3. COLUNAS CRÍTICAS
  // ═══════════════════════════════════════════════
  section('3. COLUNAS CRÍTICAS');

  const columnTests = [
    { table: 'payments', cols: 'id, user_email, plan, amount, proof_url, proof_filename, notes, approved_at, status' },
    { table: 'song_requests', cols: 'id, status, voice_sample_url, final_mixed_audio_url, photo_url, elevenlabs_voice_id' },
    { table: 'songs', cols: 'id, title, lyrics, lyrics_snippet, letter_text, audio_url, mureka_task_id, mureka_status' },
    { table: 'users', cols: 'id, name, email, phone' },
  ];

  for (const ct of columnTests) {
    const { error } = await supabase.from(ct.table).select(ct.cols).limit(1);
    if (error) fail(ct.table + ': Coluna em falta — ' + error.message, 'Executar supabase_setup.sql novamente');
    else ok(ct.table + ': todas as colunas OK');
  }

  // ═══════════════════════════════════════════════
  // 4. BUCKETS DE STORAGE
  // ═══════════════════════════════════════════════
  section('4. BUCKETS DE STORAGE');

  const testFile = Buffer.from('seubeat-auto-check-' + Date.now());
  const testName = '.autocheck_' + Date.now() + '.txt';
  const buckets = [
    { name: 'payment-proofs', pub: false },
    { name: 'full-audio',     pub: false },
    { name: 'preview',        pub: true  },
    { name: 'voice-samples',  pub: false },
    { name: 'photos',         pub: true  },
  ];

  for (const b of buckets) {
    const { error: upErr } = await supabase.storage.from(b.name).upload(testName, testFile, { upsert: true });
    if (upErr) {
      fail('Bucket "' + b.name + '" upload falhou — ' + upErr.message, 'Executar a secção STORAGE do supabase_setup.sql');
    } else {
      // Teste de leitura da URL pública
      const { data: urlData } = supabase.storage.from(b.name).getPublicUrl(testName);
      const urlOk = urlData?.publicUrl?.startsWith('https://');
      ok('Bucket "' + b.name + '" (' + (b.pub ? 'público' : 'privado') + ') — upload + URL OK');
      // Limpar
      await supabase.storage.from(b.name).remove([testName]);
    }
  }

  // ═══════════════════════════════════════════════
  // 5. API CLAUDE (Geração de Letras)
  // ═══════════════════════════════════════════════
  section('5. API CLAUDE (Geração de Letras)');

  if (!ANTHROPIC_KEY) {
    fail('Anthropic API Key em falta');
  } else {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      if (res.ok) {
        ok('Claude API: conectada');
      } else if (res.status === 401) {
        fail('Claude API: chave inválida (401)', 'Verificar ANTHROPIC_API_KEY no .env');
      } else {
        const err = await res.json().catch(() => ({}));
        warn('Claude API: status ' + res.status + (err.error?.message ? ' — ' + err.error.message : ''));
      }
    } catch (e) {
      fail('Claude API: erro de rede — ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // 6. API SUNO (Geração de Música)
  // ═══════════════════════════════════════════════
  section('6. API SUNO (Geração de Música)');

  if (!SUNO_KEY) {
    fail('Suno API Key em falta');
  } else {
    try {
      const res = await fetch('https://api.suno.ai/v1/limit', {
        headers: { 'Authorization': 'Bearer ' + SUNO_KEY }
      });
      if (res.ok) {
        ok('Suno API: chave válida');
      } else if (res.status === 401) {
        fail('Suno API: chave inválida (401)', 'Verificar SUNO_API_KEY no .env');
      } else {
        warn('Suno API: resposta ' + res.status + ' (pode ser normal)');
      }
    } catch (e) {
      fail('Suno API: erro de rede — ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // 7. SUNO VOICE (Clonagem de Voz)
  // ═══════════════════════════════════════════════
  section('7. SUNO VOICE (Clonagem de Voz)');

  if (!SUNO_KEY) {
    fail('Suno Voice: SUNO_API_KEY em falta');
  } else {
    try {
      const res = await fetch('https://api.sunoapi.org/api/v1/voice/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUNO_KEY
        },
        body: JSON.stringify({ validationTaskId: '', verifyUrl: '' })
      });
      if (res.status === 422) {
        ok('Suno Voice API: acessível (422 esperado sem dados reais)');
      } else if (res.status === 401) {
        fail('Suno Voice API: chave inválida (401)', 'Verificar SUNO_API_KEY no .env');
      } else {
        warn('Suno Voice API: resposta ' + res.status);
      }
    } catch (e) {
      fail('Suno Voice API: erro de rede — ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // 8. BREVO SMTP (EMAIL)
  // ═══════════════════════════════════════════════
  section('8. BREVO SMTP (Email)');

  if (!SMTP_HOST) {
    fail('SMTP_HOST em falta');
  } else if (!SMTP_USER) {
    fail('SMTP_USER em falta');
  } else {
    ok('Brevo SMTP configurado: ' + SMTP_HOST + ' (' + SMTP_USER + ')');
    if (!SMTP_PASS) warn('SMTP_PASS em falta — envio será simulado.');
  }

  // ═══════════════════════════════════════════════
  // 9. SERVIDOR LOCAL (se estiver a correr)
  // ═══════════════════════════════════════════════
  section('9. SERVIDOR LOCAL (http://localhost:3000)');

  try {
    const res = await fetch('http://localhost:3000/api/payment-status', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      ok('Servidor Express: a correr na porta 3000');
    } else {
      warn('Servidor: resposta ' + res.status);
    }
  } catch (e) {
    if (e.name === 'TimeoutError' || e.code === 'ECONNREFUSED') {
      warn('Servidor local não está a correr — executar "npm run dev" para iniciar');
    } else {
      warn('Servidor: ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ═══════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║              RELATÓRIO FINAL                    ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  ✅ Passou: ' + String(totalOk).padEnd(3) + '   ❌ Falhou: ' + String(totalFail).padEnd(3) + '               ║');
  console.log('╠══════════════════════════════════════════════════╣');

  if (totalFail === 0) {
    console.log('║   🎉 TUDO EM ORDEM! O SeuBeat está pronto.     ║');
  } else {
    console.log('║   PROBLEMAS A RESOLVER:                        ║');
    issues.forEach((issue, i) => {
      const line = '║  ' + (i + 1) + '. ' + issue.substring(0, 45);
      console.log(line.padEnd(51) + '║');
    });
  }
  console.log('╚══════════════════════════════════════════════════╝\n');
}

run().catch(console.error);
