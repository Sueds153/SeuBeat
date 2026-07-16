// ============================================================
// SeuBeat — Teste E2E completo via API (cliente + programador)
// ============================================================
const BASE = 'http://localhost:3000';

const OK   = '✅';
const FAIL = '❌';
const INFO = '→';

let passCount = 0;
let failCount = 0;

function log(icon, label, detail = '') {
  console.log(`${icon} ${label}${detail ? `  ${detail}` : ''}`);
}

function pass(label, detail = '') { passCount++; log(OK, label, detail); }
function fail(label, detail = '') { failCount++; log(FAIL, label, detail); }
function info(label, detail = '') { log(INFO, label, detail); }

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function post(path, data) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────
// TESTE 1 — Servidor disponível
// ─────────────────────────────────────────────────────────
async function testServerHealth() {
  console.log('\n══ TESTE 1: Servidor / Landing ══');
  try {
    const r = await fetch(BASE);
    if (r.ok) pass('Landing page carrega', `HTTP ${r.status}`);
    else fail('Landing page retornou erro', `HTTP ${r.status}`);
  } catch(e) {
    fail('Servidor inacessível', e.message);
  }

  const { status, body } = await get('/api/stats/today-count');
  if (status === 200 && typeof body.count === 'number') {
    pass('GET /api/stats/today-count', `count=${body.count}`);
  } else {
    fail('GET /api/stats/today-count', JSON.stringify(body));
  }

  const pd = await get('/api/payment-details');
  if (pd.status === 200 && pd.body.entidade) {
    pass('GET /api/payment-details', `entidade=${pd.body.entidade}`);
  } else {
    fail('GET /api/payment-details', JSON.stringify(pd.body));
  }
}

// ─────────────────────────────────────────────────────────
// TESTE 2 — Geração de letra (fluxo principal do cliente)
// ─────────────────────────────────────────────────────────
async function testGenerateLyrics() {
  console.log('\n══ TESTE 2: POST /api/generate-lyrics (simulação de cliente) ══');
  info('A enviar dados do wizard...');

  const payload = {
    userNick: 'João',
    recipientName: 'Maria',
    recipientRelation: 'Mãe',
    recipientNick: 'Mamã',
    occasion: 'Aniversário',
    musicStyle: 'Kizomba',
    voiceType: 'Masculina',
    email: 'teste@seubeat.ao',
    phone: '',
    unforgettableMemory: 'A viagem que fizemos juntos para o Namibe quando era criança e vimos o pôr do sol juntos',
    whatMakesSpecial: 'É sempre a primeira a acordar para preparar o pequeno-almoço para toda a família',
    onlySheDoes: 'Sabe sempre quando estou triste sem eu dizer nada',
    whereItHappened: 'Namibe',
    messageFromTheHeart: 'Obrigado por seres a melhor mãe do mundo e nunca desistires de mim em nenhum momento',
    desiredEmotion: 'Amor',
    language: 'português',
    whyCreatedToday: 'Hoje é o aniversário da minha mãe e quero surpreendê-la com algo especial',
    photoBase64: null,
    photoFilename: null,
    photoMimeType: null
  };

  const start = Date.now();
  const { status, body } = await post('/api/generate-lyrics', payload);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (status !== 200) {
    fail(`POST /api/generate-lyrics retornou ${status}`, JSON.stringify(body).slice(0, 200));
    return null;
  }

  if (!body.success) {
    fail('generate-lyrics: success=false', body.error || JSON.stringify(body).slice(0,200));
    return null;
  }

  pass(`generate-lyrics respondeu em ${elapsed}s`, `songId=${body.dbSongId?.slice(0,8)}...`);

  // Validar campos da resposta
  const checks = {
    dbSongId: body.dbSongId,
    dbSongRequestId: body.dbSongRequestId,
    songTitle: body.songTitle,
    lyrics: Array.isArray(body.lyrics) && body.lyrics.length > 0,
    status: body.status === 'lyrics_ready'
  };

  for (const [k, v] of Object.entries(checks)) {
    if (v) pass(`  Campo "${k}" presente`);
    else fail(`  Campo "${k}" em falta ou incorreto`, String(v));
  }

  return { songId: body.dbSongId, requestId: body.dbSongRequestId };
}

// ─────────────────────────────────────────────────────────
// TESTE 3 — GET /api/song/:id (o bug que foi corrigido!)
// ─────────────────────────────────────────────────────────
async function testGetSong(songId, requestId) {
  console.log('\n══ TESTE 3: GET /api/song/:id (bug fix crítico) ══');

  if (!songId) {
    fail('Sem songId — skipping (depende do Teste 2)');
    return;
  }

  const start = Date.now();
  const { status, body } = await get(`/api/song/${songId}`);
  const elapsed = Date.now() - start;

  if (status === 200) {
    pass(`GET /api/song/:id respondeu em ${elapsed}ms`, `status="${body.status}"`);
  } else {
    fail(`GET /api/song/:id retornou ${status}`, JSON.stringify(body).slice(0,200));
    return;
  }

  // Verificar que o body tem a estrutura correta (não estava a ser enviado antes do fix)
  const fieldChecks = {
    'id':         body.id === songId,
    'status':     typeof body.status === 'string',
    'title':      typeof body.title === 'string',
    'lyrics':     Array.isArray(body.lyrics) || typeof body.lyrics === 'string',
    'request_id': typeof body.request_id === 'string',
  };

  for (const [k, v] of Object.entries(fieldChecks)) {
    if (v) pass(`  Campo "${k}" presente na resposta`);
    else fail(`  Campo "${k}" em falta`, `valor=${JSON.stringify(body[k])}`);
  }

  // Status deve ser lyrics_ready (não music_ready porque o admin ainda não aprovou)
  if (body.status === 'lyrics_ready' || body.status === 'lyrics_generating') {
    pass(`  Status correto: "${body.status}"`);
  } else {
    info(`  Status: "${body.status}" (pode ser normal dependendo do fluxo)`);
  }
}

// ─────────────────────────────────────────────────────────
// TESTE 4 — Simulação do polling (como o Wizard.tsx faz)
// ─────────────────────────────────────────────────────────
async function testPolling(songId) {
  console.log('\n══ TESTE 4: Simulação do polling do Wizard ══');

  if (!songId) {
    fail('Sem songId — skipping');
    return;
  }

  info('A simular 3 chamadas de polling (como o frontend faz)...');

  for (let attempt = 1; attempt <= 3; attempt++) {
    const start = Date.now();
    const { status, body } = await get(`/api/song/${songId}`);
    const elapsed = Date.now() - start;

    if (status === 200 && body.id) {
      pass(`  Polling tentativa ${attempt}: respondeu em ${elapsed}ms`, `status="${body.status}"`);

      // Lógica igual ao Wizard.tsx corrigido
      const requestStatus = body.status;
      const previewUrl = body.preview_url;

      if (requestStatus === 'failed') {
        fail('  → Música falhou!');
        return;
      }
      if (previewUrl && requestStatus === 'music_ready') {
        pass('  → Preview disponível! (music_ready)');
        return;
      }
      if (requestStatus === 'lyrics_ready') {
        pass('  → lyrics_ready: polling pararia aqui ✓ (fluxo correto)');
        break;
      }
      info(`  → Status "${requestStatus}" — polling continuaria`);
    } else {
      fail(`  Polling tentativa ${attempt} falhou`, `HTTP ${status}`);
    }

    if (attempt < 3) await wait(2000);
  }
}

// ─────────────────────────────────────────────────────────
// TESTE 5 — Validações (inputs inválidos)
// ─────────────────────────────────────────────────────────
async function testValidation() {
  console.log('\n══ TESTE 5: Validações de inputs ══');

  // Email inválido
  const r1 = await post('/api/generate-lyrics', { email: 'email-invalido' });
  if (r1.status === 400) pass('Rejeita email inválido', `HTTP 400`);
  else fail('Devia rejeitar email inválido', `HTTP ${r1.status}`);

  // ID inválido no song endpoint
  const r2 = await get('/api/song/nao-e-uuid');
  if (r2.status === 400) pass('Rejeita ID inválido em /api/song/:id', `HTTP 400`);
  else fail('Devia rejeitar ID inválido', `HTTP ${r2.status}`);

  // Song inexistente
  const r3 = await get('/api/song/00000000-0000-4000-a000-000000000000');
  if (r3.status === 404) pass('Retorna 404 para song inexistente', `HTTP 404`);
  else fail('Devia retornar 404', `HTTP ${r3.status}: ${JSON.stringify(r3.body).slice(0,100)}`);

  // Submit payment sem campos obrigatórios
  const r4 = await post('/api/submit-payment', {});
  if (r4.status === 400 || r4.status === 500) pass('Rejeita payment sem dados', `HTTP ${r4.status}`);
  else fail('Devia rejeitar payment sem dados', `HTTP ${r4.status}`);
}

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────
(async () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   SeuBeat — Teste E2E Completo (API + Frontend)  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Servidor: ${BASE}`);
  console.log(`  Hora: ${new Date().toLocaleTimeString('pt-PT')}\n`);

  await testServerHealth();

  const ids = await testGenerateLyrics();
  const songId = ids?.songId;
  const requestId = ids?.requestId;

  await testGetSong(songId, requestId);
  await testPolling(songId);
  await testValidation();

  // ── Resultado final ──
  const total = passCount + failCount;
  console.log('\n╔══════════════════════════════╗');
  console.log('║        RESULTADO FINAL       ║');
  console.log('╚══════════════════════════════╝');
  console.log(`  ✅ Passaram: ${passCount}/${total}`);
  console.log(`  ❌ Falharam: ${failCount}/${total}`);

  if (failCount === 0) {
    console.log('\n  🎉 Todos os testes passaram! Fluxo funcional.');
  } else {
    console.log('\n  ⚠️  Há problemas a resolver. Ver detalhes acima.');
  }
})();
