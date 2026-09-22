# SeuBeat — Estado do Projeto (atualizado a cada sessão)

## Estado Atual (22/Set 2026)

### Stack
- **Frontend**: React + Vite + Tailwind + TypeScript
- **Backend**: Express + TypeScript (esbuild)
- **DB**: Supabase (PostgreSQL) — projeto `uqmqkntnpuecswcrtulz`
- **Storage**: Cloudflare R2 (bucket `seubeat`, domínio `pub-395cd883a9ca48b9a1b4af580404fc37.r2.dev`)
- **IA**: DeepSeek (1º) → Gemini → OpenAI → Claude
- **Músicas**: Suno API (`api.sunoapi.org`, 78 créditos)
- **Email**: Brevo
- **WhatsApp**: Cloud API Meta (WABA `2754160688292272`)
- **Deploy**: Render (auto-deploy push main)
- **Monitorização**: Sentry
- **CI**: GitHub Actions (lint + test + audit + build + E2E)
- **MCP Servers**: Supabase + Jina AI (busca web, embeddings, leitura de URLs)

### Produção
- **URL**: https://seubeat.onrender.com
- **Último deploy**: commit `3234ede` (schema cache fallback ai_verified/verification_result)
- **Testes**: 433 passam (34 ficheiros), `tsc --noEmit` limpo, **32 E2E Playwright passam**

### DB Schema (tabelas principais)
- `song_requests` — pedido do cliente (status, dados wizard)
- `songs` — música gerada (audio_url, audio_url_v2, mureka_status, mureka_task_id)
- `payments` — pagamentos (status, proof_url, payment_method, verification_result jsonb, ai_verified boolean, proof_hash text, transaction_id text)
- `users` — clientes (email, phone, name)
- `email_events` — tracking de emails
- `whatsapp_send_log` — log de envios WhatsApp
- `admin_audit_log` — audit log admin

### Admin Panel Tabs
1. **Pedidos** — lista de song_requests com filtros ✅ funcional
2. **Pagamentos** — lista de payments com aprovação/rejeição + verificação AI + re-analisar ✅ funcional
3. **Músicas** — lista de songs (515 not_started = esperando pagamento, by design) ✅ funcional
4. **Clientes** — lista de users ✅ funcional
5. **Abandonados** — leads sem pagamento, filtros por tempo + delivery logs WhatsApp ✅ funcional
6. **Créditos** — créditos Suno/IA ✅ funcional
7. **Métricas** — KPIs funil ✅ funcional
8. **Lucratividade** — receita/custos ✅ funcional
9. **Meta Ads** — configuração de campanhas ✅ funcional
10. **WhatsApp** — estado de envios + stats de envio ✅ funcional

### Melhorias Hoje (20/Set 2026)
1. **Anti-fraude proof dedup** — SHA-256 hash + transaction_id cross-request dedup. Duplicados bloqueados com 409. Órfãos de storage limpos no reenvio. Aplicado em `submit-payment` e `video-upsell`.
2. **Meta CAPI Purchase fix** — Purchase event agora dispara para todos os status não-rejeitados (antes só approved), alinhado com o pixel client-side.
3. **WhatsApp scheduler 4 buckets** — `WHATSAPP_ENABLED_BUCKETS=30min,24h,48h,72h` (antes só 30min). Scheduler envia automaticamente sem intervenção manual.
4. **WhatsApp erros descritivos** — mapeamento 368 (bloqueado 24h), 33 (regiao nao suporta), 100 (parametro invalido). `metaCode` + `metaRaw` visiveis no Admin.
5. **WhatsApp verificacao removida** — botao/modal de verificacao removidos (Meta error 136024 = numeros angolanos nao elegiveis para SMS/voz). Envios continuam a funcionar com NOT_VERIFIED.
6. **Delivery logs por cliente** — aba Abandonados mostra badges `N enviado(s)` (verde) / `N falha(s)` (vermelho) por cliente via `whatsapp_send_log`.
7. **AdminPanel apiFetch fix** — `apiFetch` agora devolve `_error: true` com a mensagem real em vez de `null`.
8. **verification_result atomico** — `ai_verified`, `verification_result`, `transaction_id` movidos para o INSERT (antes eram non-blocking update que se perdia).
9. **Undo limpa AI** — botao "Desfazer" agora reseta `verification_result: null` e `ai_verified: false`.
10. **Schema cache resilient** — INSERT fallback sem `proof_hash`/`transaction_id` se schema cache esta desatualizado. Migration SQL com `NOTIFY pgrst, 'reload schema'` automatico.

### Bugs Corrigidos Hoje (20/Set 2026)
1. **SUPABASE_URL em falta no Render** — admin Supabase nao inicializava. Fix: adicionar env var via Render API.
2. **NOT NULL violation em payments (23502)** — `plan_type`/`amount_kz` em falta. Fix: adicionar aos INSERTs.
3. **3 pedidos stuck em `payment_submitted`** — fix: reverter manualmente para `lyrics_ready`.
4. **PostgREST schema cache desatualizado** — `proof_hash`/`transaction_id` nao visiveis. Fix: `NOTIFY pgrst, 'reload schema'` + migration atualizada.
5. **verification_result sempre NULL** — update non-blocking executava DEPOIS do INSERT e falhava silenciosamente. Fix: mover para INSERT atomico.
6. **Submit-payment crasha se schema cache falha** — `proof_hash` no INSERT causava 500. Fix: try/catch com fallback sem dedup fields.
7. **Video-upsell mesmo problema** — mesma protecao aplicada.
8. **Undo nao limpa AI** — decisao AI fantasma permanecia apos undo. Fix: adicionar `verification_result: null, ai_verified: false`.

### Bugs Corrigidos Anteriormente (18-19/Set)
1. **500 no `/submit-payment` — colunas `ai_verified`/`verification_result` em falta na DB** — a migration `supabase_migration_proof_verification.sql` nunca foi aplicada em produção; o PostgREST devolvia "Could not find the 'ai_verified' column of 'payments' in the schema cache". Fix: migration aplicada via Postgres direto (pooler 5432); colunas criadas: `ai_verified boolean DEFAULT false` + `verification_result jsonb` + índice parcial.
2. **Mensagem de erro genérica "Não foi possível concluir esta etapa"** — `publicErrorMessage()` em `server/utils/helpers.ts` não tratava objetos Supabase não-`Error` (produziam `String("[object Object]")`) e mensagens de falha de upload não tinham regex correspondente. Fix: extrair `.message` de objetos planos antes do regex; mover regex de upload antes do timeout; adicionar padrões Postgrest/RLS/`demasiado pequena`; catch-all que devolve mensagem truncada em vez de fallback genérico; testes unitários adicionados (397 total).

### Bugs Corrigidos Ontem (17/Set)
1. **Edição de letras bloqueada** — `handleSaveLyrics` não incluía `email` no body do PUT `/song/:id/lyrics`, server retornava 400 "Email requerido". Fix: adicionar `email: formData.email` ao request body
2. **Preview teaser mostrava só 1 secção** — `buildTeaser()` selecionava só o refrão/ponte, utilizador via "só o refrão". Fix: mostrar 2 secções visíveis (emocional + adjacente) + mini-preview de 3ª secção na cortina
3. **Teaser desaparecia após refresh/lento** — `isTeaserEnabled()` cacheava `false` permanentemente no primeiro falha de fetch do `/api/config`, desativando o teaser para toda a sessão. Fix: cache com localStorage + retry silencioso em background + loading skeleton

### Melhorias Hoje (17/Set)
1. **Step 4 emocional reescrito** — label "Conta-nos a vossa história" + badge "O que escrever é contigo" (não "Obrigatório"), placeholder com 3 perguntas abertas, pills como aberturas incompletas ("O dia em que nos conhecemos...", "O que mais admiro nela é..."), frase "não há respostas erradas", campos opcionais com reforço de que tudo bem não preencher
2. **Prompts de IA limpos** (sessão anterior) — campos fantasma removidos, slang artificial eliminada, instruments/BPM corrigidos, temperature 0.65, validação reativa

### Melhorias Hoje (22/Set 2026)
1. **Bug fix ESM crítico** — `env.ts` tinha `require()` num módulo ESM (commit `94da31e`), que impedia o servidor de arrancar (`ERR_AMBIGUOUS_MODULE_SYNTAX`). Fix: remover `logWarnLazy` e voltar a `console.warn` direto (startup warnings não precisam de logger estruturado).
2. **Bug fix admin: cartão "Pagamento" sempre vazio** — rota `GET /api/admin/requests` fazia `.in('request_id', requestIds)` com ~1000 UUIDs → URL ~37KB → PostgREST 400 Bad Request **silencioso** (error ignorado) → `paymentsMap = {}` → frontend mostrava "—"/"Pendente" em todos os campos. Fix em `server/routes/admin.ts`: fetch completo da tabela `payments` (só 75 linhas, sem `.in()`), `logWarn` no erro, fallback `plan = plan || plan_type` (39/75 payments legacy têm `plan: null`). Shape da resposta inalterado; 431 testes + `tsc --noEmit` limpos.
2. **E2E Playwright — 32/32 testes a passar** — 6 correções em testes desatualizados:
   - `landing.spec.ts` + `wizard.spec.ts`: "Transforme a sua história" é `<p>`, não heading — `getByRole('heading')` → `getByText()`
   - `full-flow.spec.ts` + `express-plan.spec.ts` + `payment-rejection.spec.ts`: ecrã de validação de letras (`lyricsValidating`) após pagamento — adicionado `skipLyricsValidation()` helper + mock `PUT /api/song/*/lyrics`
   - `resume-flow.spec.ts`: timeout por consumo de retries — resolveu-se com correções dos outros testes
3. **E2E test helpers** — `mockLyricsConfirm()` + `skipLyricsValidation()` adicionados a `e2e/fixtures/mocks.ts`
4. **Bug fix: upload de comprovativos** — investigação completa do bug do `eliassauimbo@gmail.com` (15.000 Kz, status `lyrics_ready`, zero payments):
   - **Root cause**: a tabela `payments` em produção não tinha as 4 colunas (`proof_hash`, `transaction_id`, `ai_verified`, `verification_result`) apesar do código INSERT incluí-las. O schema cache fallback existente em `public.ts` (linhas 1506-1518) estava correto mas **o handler nunca chegava ao INSERT** — o Render proxy (timeout ~30s) cortava a conexão antes porque a verificação AI (Gemini 15s + OpenAI 15s = worst-case 30s) combinada com upload lento de Angola excedia o limite.
   - **Fix 1**: Migration `supabase_migration_proof_verification.sql` + `supabase_migration_proof_dedup.sql` aplicadas via Postgres direto (pooler). 4 colunas + 4 índices criados + schema cache recarregado (`pg_notify pgrst`).
   - **Fix 2**: `AI_TIMEOUT_MS` reduzido de 15s→10s em `proofVerification.ts` — worst-case do handler cai de ~35s para ~25s, dentro do limite de 30s do Render proxy.
   - **Resultado**: 419 testes passam; `tsc --noEmit` limpo.
5. **Pedido do utilizador mantém `lyrics_ready`** — o estado não está corrompido; o utilizador pode retentar o upload pelo Wizard normalmente.
6. **Migrações payments re-aplicadas com sucesso (22/Set 15:45)** — `add_payment_verification_result_columns` + `add_payment_proof_dedup_columns` via MCP `supabase` (projeto `uqmqkntnpuecswcrtulz`). Colunas confirmadas: `verification_result jsonb`, `ai_verified boolean`, `proof_hash text`, `transaction_id text` + índices + `NOTIFY pgrst`.
7. **Chaves AI em produção confirmadas** — `GET /health` devolve `gemini: ok` (`gemini-2.5-flash`, available) + `deepseek: ok` ($1.39 saldo) + `env.openai: true` / `env.gemini: true`. NOTA: `/health` não reporta saldo OpenAI (só presença da key).
8. **Fix normalização de data AI** — `parseProofDate()` em `proofVerification.ts` aceita agora `DD/MM/YYYY [HH:mm]` (formato Multicaixa/Angola) além de ISO e `YYYY-MM-DD HH:mm`; valida ranges (mês 1–12, dia 1–31) e prefere day-first quando ambíguo. Antes: `new Date("22/09/2026 01:26")` → Invalid Date → check de data falhava → perdia 0.10 de confiança → comprovativos legítimos podiam cair em `manual_review` por engano. **Thresholds NÃO alterados** (`PROOF_AUTO_APPROVE_THRESHOLD=0.85`, `PROOF_AUTO_REJECT_THRESHOLD=0.50`); override de `transactionId` mantido estrito. +2 testes (31→33 no ficheiro; suite 431+2).
9. **Causa `manual_review` no c4ca21cf (12/Set 12:02) concluída por código** — comprovativo sem Transaction ID legível (só `639182******5895` mascarado) → AI `transactionId: null` → conf. 0.85 → **override Layer 4 força `manual_review`** (`public.ts:1377-1384` + `proofVerification.ts:389-396`). Comprovativo: Express 15.000 Kz, phone 929423278 ✓, data 2026-09-22 01:26:55 ✓. Admin aprovou 12:07:18 (`notes: "Pagamento verificado e aprovado."`); delivered 12:10:02. Logs Render dessa janela não retidos (free tier).
10. **`render_list_env_vars` indisponível** — tool não existe no MCP Render (só `render_update_environment_variables` / `render_get_service`). Verificação de keys AI em prod via `/health` (confirmado).

### Melhorias Hoje (21/Set 2026)
1. **Health & Observabilidade** — `unhandledRejection`/`uncaughtException` handlers em `server.ts`; httpLogger filtra `/health`, OPTIONS, assets estáticos; `console.*` substituídos por logger estruturado (audio.ts, env.ts, admin.ts, public.ts).
2. **Segurança** — webhook token com `timingSafeEqual` (timing-safe comparison); `ADMIN_ALLOWED_IPS` adicionado ao `.env.example`.
3. **CI/CD** — `npm audit --audit-level=high` no pipeline; Dependabot config (npm + github-actions); `SMTP_HOST` morto removido do CI.
4. **Deps limpas** — `@types/qrcode` removido (dead); `@types/multer` movido para devDependencies; `package.json name` corrigido (`react-example` → `seubeat`).
5. **Bug fix** — `ensureSentry` memoization (`null` vs `undefined`) — imports falhados eram re-tentados em cada chamada em vez de cacheados.

### Pendências Conhecidas
- `auth_leaked_password_protection` — ativar manualmente no Dashboard Supabase
- Paginação no endpoint `/requests` (retorna todos sem limit)
- Response shapes inconsistentes no admin (alguns sem `success` field)
- Admin IP restriction opcional (via `ADMIN_ALLOWED_IPS`)
- WhatsApp verificação formal impossível para +244 (limitação Meta error 136024)
- Pagamentos antigos com `verification_result` = NULL (re-analisar manualmente)
- Re-analyze não atualiza `ai_verified` (inconsistência menor)
- **Commit pendente** — fix de data (`parseProofDate`) + testes + PROJECT_STATE ainda não commitados (aguardar pedido do utilizador)
- Cap PostgREST 1000 linhas — rota `/songs` (`admin.ts:738-752`) — não tocar (adiado)
- `/health` não valida saldo OpenAI (só presença da key) — melhorar futuramente

### Env Vars Críticas (Render)
- `SUPABASE_SERVICE_ROLE_KEY` — não está no .env local
- `ADMIN_PASSWORD` / `JWT_SECRET` — não estão no .env local
- `R2_*` — credenciais R2 no .env local
- `DEEPSEEK_API_KEY` — provider principal de IA
- `WHATSAPP_*` — configuração WhatsApp Cloud API
- `JINA_API_KEY` — embeddings + MCP server (jina.ai, 1M tokens/mês grátis)

### Notas para Próxima Sessão
- Sempre verificar estado atual da DB antes de fazer alterações
- Usar MCP Supabase para queries em vez de assumir schema
- R2 é o storage primário, Supabase Storage é fallback
- Não gastar créditos Suno desnecessariamente — verificar se já existe áudio
- Jina MCP disponível para busca web e leitura de documentação (usar `search_web`, `read_url`)
- Wizard agora tem 5 passos (não 9) — não adicionar campos phantom ao Step 4
- Feature flag `VITE_ENABLE_LYRICS_TEASER` controla teaser vs letras completas
- E2E tests precisam de env vars dummy no .env local para o servidor arrancar (SUNO_API_KEY, BREVO_API_KEY, ADMIN_PASSWORD, JWT_SECRET) — **remover antes de commit**
- Após pagamento submetido com sucesso, o wizard mostra ecrã `lyricsValidating` (confirmação de letras) — os E2E tests devem incluir `skipLyricsValidation()`
