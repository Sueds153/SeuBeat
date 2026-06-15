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
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const MUREKA_KEY    = process.env.MUREKA_API_KEY;
const ELEVENLABS_KEY= process.env.ELEVENLABS_API_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
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
  GEMINI_KEY    ? ok('GEMINI_API_KEY presente')    : fail('GEMINI_API_KEY em falta', 'Adicionar ao .env');
  MUREKA_KEY    ? ok('MUREKA_API_KEY presente')    : fail('MUREKA_API_KEY em falta', 'Adicionar ao .env');
  ELEVENLABS_KEY? ok('ELEVENLABS_API_KEY presente'): fail('ELEVENLABS_API_KEY em falta', 'Adicionar ao .env');
  RESEND_KEY    ? ok('RESEND_API_KEY presente')    : fail('RESEND_API_KEY em falta', 'Adicionar ao .env');
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
    { table: 'song_requests', cols: 'id, status, voice_sample_url, final_mixed_audio_url, photo_url, elevenlabs_voice_id, cloned_speech_url' },
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
    { name: 'payment-proofs', pub: true  },
    { name: 'full-audio',     pub: false },
    { name: 'preview',        pub: true  },
    { name: 'voice-samples',  pub: false },
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
  // 5. API GEMINI
  // ═══════════════════════════════════════════════
  section('5. API GEMINI (Geração de Letras)');

  if (!GEMINI_KEY) {
    fail('Gemini API Key em falta');
  } else {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + GEMINI_KEY);
      if (res.ok) {
        const data = await res.json();
        const flash = (data.models || []).find(m => m.name && m.name.includes('gemini-2.5-flash'));
        if (flash) ok('Gemini API: conectada + modelo gemini-2.5-flash disponível');
        else warn('Gemini API: conectada mas gemini-2.5-flash não encontrado na lista');
      } else {
        const err = await res.json();
        fail('Gemini API: ' + (err.error?.message || res.status));
      }
    } catch (e) {
      fail('Gemini API: erro de rede — ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // 6. API MUREKA
  // ═══════════════════════════════════════════════
  section('6. API MUREKA (Geração de Música)');

  if (!MUREKA_KEY) {
    fail('Mureka API Key em falta');
  } else {
    try {
      const res = await fetch('https://api.mureka.ai/v1/models', {
        headers: { 'Authorization': 'Bearer ' + MUREKA_KEY }
      });
      if (res.ok || res.status === 404) {
        ok('Mureka API: chave válida (status: ' + res.status + ')');
      } else if (res.status === 401) {
        fail('Mureka API: chave inválida ou expirada (401)', 'Verificar MUREKA_API_KEY no .env');
      } else {
        warn('Mureka API: resposta inesperada ' + res.status + ' (pode ser normal)');
      }
    } catch (e) {
      fail('Mureka API: erro de rede — ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // 7. API ELEVENLABS
  // ═══════════════════════════════════════════════
  section('7. API ELEVENLABS (Voz/TTS)');

  if (!ELEVENLABS_KEY) {
    fail('ElevenLabs API Key em falta');
  } else {
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': ELEVENLABS_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        ok('ElevenLabs API: conectada — conta: ' + (data.first_name || data.xi_api_key?.substring(0,6) || 'OK'));
        const charactersLeft = data.subscription?.character_limit - data.subscription?.character_count;
        if (charactersLeft !== undefined) ok('ElevenLabs: ' + charactersLeft.toLocaleString() + ' caracteres restantes');
      } else if (res.status === 401) {
        fail('ElevenLabs API: chave inválida (401)', 'Verificar ELEVENLABS_API_KEY no .env');
      } else {
        warn('ElevenLabs API: status inesperado ' + res.status);
      }
    } catch (e) {
      fail('ElevenLabs API: erro de rede — ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // 8. API RESEND (EMAIL)
  // ═══════════════════════════════════════════════
  section('8. API RESEND (Email)');

  if (!RESEND_KEY) {
    fail('Resend API Key em falta');
  } else {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { 'Authorization': 'Bearer ' + RESEND_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        const domains = data.data || [];
        ok('Resend API: conectada (' + domains.length + ' domínio(s) configurado(s))');
        if (domains.length === 0) {
          warn('Nenhum domínio verificado — emails só chegam à conta Resend.');
          warn('Para enviar a qualquer cliente: verificar domínio em resend.com/domains');
        } else {
          domains.forEach(d => ok('Domínio verificado: ' + d.name + ' (' + d.status + ')'));
        }
      } else if (res.status === 401) {
        fail('Resend API: chave inválida (401)', 'Verificar RESEND_API_KEY no .env');
      } else {
        warn('Resend API: status inesperado ' + res.status);
      }
    } catch (e) {
      fail('Resend API: erro de rede — ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // 9. SERVIDOR LOCAL (se estiver a correr)
  // ═══════════════════════════════════════════════
  section('9. SERVIDOR LOCAL (http://localhost:3000)');

  try {
    const res = await fetch('http://localhost:3000/api/auth/google/status', { signal: AbortSignal.timeout(3000) });
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
