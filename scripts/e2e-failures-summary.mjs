/**
 * Lê playwright-results.json (reporter json) e escreve em markdown o resumo
 * das falhas E2E — encaminhado para $GITHUB_STEP_SUMMARY no passo de erro do
 * CI, para as falhas ficarem visíveis na página do run sem precisar de auth.
 *
 * Uso: node scripts/e2e-failures-summary.mjs >> "$GITHUB_STEP_SUMMARY"
 */
import fs from 'node:fs';

const FILE = process.argv[2] || 'playwright-results.json';

if (!fs.existsSync(FILE)) {
  console.log('## E2E — falhas\n\n`playwright-results.json` não encontrado (o reporter json não correu).');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rows = [];
let passed = 0;
let flaky = 0;

const walk = (suite, trail = []) => {
  const next = suite.title ? [...trail, suite.title] : trail;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const results = t.results || [];
      const last = results[results.length - 1];
      if (!last) continue;
      const title = [...next, spec.title].join(' > ');
      const project = t.projectName || '';
      if (last.status === 'passed') {
        if (results.length > 1) flaky += 1;
        else passed += 1;
        continue;
      }
      if (last.status === 'skipped') continue;
      rows.push({ title, project, status: last.status, error: last.error?.message || '(sem mensagem)', retry: results.length - 1 });
    }
  }
  for (const s of suite.suites || []) walk(s, next);
};

for (const s of data.suites || []) walk(s);

const stats = data.stats || {};
console.log('## E2E — falhas');
console.log('');
console.log(
  `Totais: **${stats.unexpected ?? rows.length} falha(s)** · ` +
  `${stats.expected ?? passed} ok · ${flaky} flaky · duração ${Math.round((stats.duration || 0) / 1000)}s`,
);
console.log('');

if (!rows.length) {
  console.log('_Nenhuma falha encontrada no JSON — ver o stdout do passo "Start server & run E2E"._');
  process.exit(0);
}

for (const r of rows) {
  const clean = String(r.error).replace(/\u001b\[[0-9;]*m/g, '');
  const lines = clean.split('\n').slice(0, 15).join('\n');
  console.log(`### ${r.title}`);
  console.log('');
  console.log(`\`${r.project}\` — **${r.status}**${r.retry ? ` (retry ${r.retry})` : ''}`);
  console.log('');
  console.log('```');
  console.log(lines);
  console.log('```');
  console.log('');
}
