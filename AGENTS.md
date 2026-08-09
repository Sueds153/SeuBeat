# SeuBeat — Project Context

## Goal
Refatorar e melhorar a segurança do SeuBeat (App React + Express + Supabase + Suno API).

## Constraints & Preferences
- Não quebrar nada existente — cada mudança validada com lint + testes (173 tests).
- Wizard.tsx e AdminPanel.tsx mantidos como estão (2982 e 3036 linhas) — risco de extração elevado, acordado manter.

## Progress
### Done
- **Rate limiting** em `/api/generate-lyrics` (10 req/hora) já existente e funcional.
- **Foto não perder no refresh**: sessionStorage guarda base64, restaurado ao recarregar.
- **Página dedicatória sem `?id=`** bater na API: fallback `seubeat_last_song_id`; mostra "não encontrada".
- **ErrorBanner + Toast** para erros no frontend.
- **Logger estruturado** Winston com níveis e rotação.
- **WizardSteps.tsx** extraído (Wizard.tsx caiu de 2865→2296 linhas).
- **Logging personaId** adicionado em start e continue (truncado + payload).
- **DedicationPage fetch** com AbortController (10s timeout) + race condition `notFound`/`fetchError` corrigida.
- **Fase 1a**: Constantes `PRICING_PLANS`, `DEMO_SONGS` extraídas de `types.ts` para `src/constants/`.
- **Fase 1b**: API layer criada (`src/api/song.ts`, `lyrics.ts`, `payment.ts`).
- **Fase 1c**: Hooks criados (`useSong`, `useAudioPlayer`).
- **Fase 1d**: `PersonalizedSongPage.tsx` de ~760→~300 linhas, 4 subcomponentes extraídos (`SongPlayer`, `SongLyrics`, `SongLetter`, `SongShare`).
- **Fase 3a**: `server/config/env.ts`, `server/config/app.ts`, `server/middleware/security.ts` extraídos. `server.ts` (raiz) de 121→56 linhas.
- **Fase 3b**: Barrel exports (`index.ts`) em todas as pastas.
- **Separação do Supabase client**: `getSupabase()` renomeado para `getAdminSupabase()`, novo `getPublicSupabase()` com anon key.
- **GET /api/song/:id** movido para public client (RLS respeitado, blast radius reduzido).
- **Signed URL** de `full-audio` gerado com admin client (não expõe bucket privado ao anon key).
- **RLS policies** adicionadas para anon SELECT em `song_requests` e `users` (apenas nome).
- **Helmet.js** substitui headers de segurança manuais (CSP, HSTS, etc.).
- **Admin audit log**: `admin_audit_log` tabela + undo endpoint.
- **Admin IP-restrição** via `ADMIN_ALLOWED_IPS` env var (opcional, fallback para password).
- **CI pipeline**: `.github/workflows/ci.yml` corre lint + testes em push/PR.
- **Validação frontend com Zod**: schemas partilhados, erros inline nos WizardSteps (mensagens vermelhas por campo).
- **5 melhorias no Admin Panel**: confirmação antes de aprovar/rejeitar, barra de progresso funcional, clientes corrigido, search nos pagamentos, undo com audit log.
- **Bugfix: Ocasião "Declaração de amor" partida**: type do card alterado para `"Declaração"`.
- **Telefone aceita formato internacional**: regex do server-side validation aceita `+`, espaços, `()`, `-`.
- **Mensagens de erro 500 melhoradas**: `publicErrorMessage` captura erros de auth (401/403), bucket storage, rate-limit, créditos insuficientes, etc.
- **Sentry MCP configurado** em `opencode.json`.
- **Bugfix: FK `users_id_fkey` removida** — impedia criação de novos users.
- **DEFAULT gen_random_uuid()** adicionado a `public.users.id`.
- **8 correcções de inconsistências**: ecrã branco na pool, campos dropados na IA, dead code, voice cloning check com JSON.parse, reset de `submissionStartedRef` (`89a45a2`).
- **Scheduler de entrega 24h para Standard**: `deliveryScheduler.ts` corre a cada 10min, transiciona `approved→delivered`, envia email. Migration executada no Supabase produção (`49fd7fb` + migration manual).
- **11 correcções no fluxo wizard-pagamento-entrega**: API response shape (`{success, data}`), stale status no auto-delivery, idempotência nos 3 caminhos de entrega, email antes do status update, `approved` em `VALID_STATUSES`, `sendConfirmationEmail` contextual, `deliver_at` consistente, endpoint `/send-email` removido (era spam vector), schema `deliver_at/deleted_at` versionado (`0b32f4d`).
- **Migration SQL**: `supabase_migration_scheduler.sql` com `ADD COLUMN IF NOT EXISTS` + índice.
- **Cache busting Wizard**: `WIZARD_BUILD` constante (`20260716_1`) em Wizard.tsx; `useEffect` no mount compara com `seubeat_wizard_version` no localStorage e limpa progresso se desatualizado. `maxAge: 0` + `Cache-Control` nos assets estáticos em `app.ts` (commit `942b0fa`).
- **Bugfix: recheckMusicStatus**: quando `pollSongUntilPreview` retorna `false` (song em `lyrics_ready`), agora seta `lyrics_ready` em vez de mostrar "A musica ainda esta em processamento" (commit `942b0fa`).
- **payment-status**: devolve `notes` + UI rejeição com motivo + re-submit + email sends com `.catch()` no admin (commit `0658c02`).
- **pollSongUntilPreview fix**: lê `song?.data?.status` em vez de `song?.status`; `maxAttempts` 60→15; aviso visual após 30s (commit `0f1bf24`).
- **Bugfix: StrictMode refs permanentes**: `pollCancelledRef` e `proofMountedRef` tinham cleanup que setava `current`, mas o body do effect não resetava no remount. React 19 preserva refs entre o ciclo unmount/remount do StrictMode, deixando o valor permanentemente alterado. Fix: adicionar reset no body do effect (`pollCancelledRef.current = false` / `proofMountedRef.current = true`).
- **E2E test full-flow**: Playwright test que percorre Wizard (9 passos) → geração de letras (mock) → seleção de plano (Standard) → upsell (declinar) → pagamento → comprovativo → ecrã de sucesso. 15s de execução.
- **Item 1 (shared Zod server schema)**: `server/shared/validation.ts` com `GenerateLyricsSchema`, `UpdateLyricsSchema`, `validateInput`. Barrel `server/shared/index.ts`.
- **Item 2 (`err: any` → `err: unknown`)**: Patched todos os catch blocks em audio.ts, metaPixelCapi.ts, email.ts, ai.ts, config/app.ts, helpers.ts, openai.ts, claude.ts, gemini.ts, prompts.ts, suno-voice.ts, suno.ts, workflow.ts, routes/public.ts.
- **Item 3 (`any` → tipos concretos)**: `WizardFormData` interface; `extractJSON` → `unknown`; `Record<string, any>` → `Record<string, unknown>`; `errorHandler(err: any)` → `Error & { status? }`; `getAppUrl(req?: any)` → `req?: Request`; `deliverWithRetry(req: any)` → `req: PendingRequest`; `as any` casts removidos em workflow.ts (6) e public.ts (8).
- **Item 4 (error responses consistentes)**: Todos os 25 `{ error: ... }` em public.ts mudados para `{ success: false, error: ... }`.
- **Item 5 (retry logic unificada)**: `aiShared.ts` criado com `extractJSON`, `clean`, `validateComposition`, `withAIServiceRetry`. `openai.ts`, `claude.ts`, `gemini.ts` refatorados para usar shared utils, eliminando código duplicado de retry/validação.
- **Item 6 (bug "não foi possível gerar a música / dados inválidos" — validação de letras)**: `validationErrorsArray` devolve `[{field,message}]` (server devolvia objeto, frontend esperava array → campo que falhava nunca aparecia). `/generate-lyrics` 400 passa a devolver `validation_errors` array + `logWarn` com email/errors; igual no PUT `/song/:id/lyrics`.
- **Item 7 (photoMimeType)**: schema servidor passou de `z.enum` estrito para `z.string().max(50).trim().optional().nullable()` (Android/WhatsApp enviam `image/jpg`/`image/avif`/`""`). Frontend normaliza `image/jpg→image/jpeg` e `null` para mimes fora da whitelist; o check real de mime mantém-se no upload (public.ts:371).
- **Item 8 (maxLength)**: `.max()` nos schemas frontend (`src/lib/validation.ts`) + `maxLength` nos inputs/textarea de `WizardSteps.tsx` (recipientName 100, nicks 50, whyCreatedToday 500, referenceArtist 100, whatMakesSpecial 1000, onlySheDoes 500, unforgettableMemory 1000, whereItHappened 500, messageFromTheHeart 1000, hookPhrase 200). Pills de sugestão truncam via `.slice(0, max)`.
- **Item 9 (Wizard eager load)**: `React.lazy` removido do Wizard em `src/App.tsx` (import direto); `Suspense` mantido só para PersonalizedSongPage/AdminPanel. Evita race de chunk em conexões lentas.
- **Item 10 (AI provider order)**: `DEFAULT_PROVIDER_ORDER` em `ai.ts` → `['gemini','openai','claude']` + `AI_PROVIDER_ORDER=gemini,openai,claude` documentado no `.env.example`.
- **Item 11 (rate limiter /generate-lyrics)**: `max 5→10`; mensagem 429 com tempo de reset via header `RateLimit-Reset` (v8 não tipa `req.rateLimit`).
- **Persistência dos campos opcionais do wizard**: `reference_artist`, `why_created_today`, `only_she_does`, `where_it_happened` adicionados a `song_requests` (nullable) via `supabase_migration_wizard_optional_fields.sql` + aplicado em produção. Agora ficam guardados para regenerações fiéis (public + admin leem da BD em `regenerate-lyrics`); também incluídos no fingerprint de dedupe (`lyricsRequestFingerprint`).
- **Bugfix: músicas de ~8s entregues como completas** (`halectorr`): (1) `pollSunoTask` aceitava `audioUrl` em `text_success` em vez de esperar `SUCCESS` — `querySunoTask` agora só expõe `audioUrl` com status final (SUCCESS) e `pollSunoTask` ignora `immediateAudioUrl`; (2) `continueSunoMusic` chamava `/api/extend_audio` (404; correto seria `upload-extend`) — removida junto com o fallback do 1º clip; (3) `persistGeneratedSunoAudio` sem duração mínima — agora mede duração, rejeita <30s (`MIN_SONG_DURATION_SEC = 30` → rollback) e grava `songs.duration`. `FAILED_STATUSES` + `create_task_failed`/`generate_audio_failed`/`sensitive_word_error`/`callback_exception` tratados como erro (commit `fcd7610`).
- **Bugfix: fades mutavam músicas longas em prod**: quando ffprobe está indisponível, `getAudioDuration` devolvia 0 e `applyFades` usava fallback `afade=t=out:st=30:d=4` (música muda após ~34s). Removido — com duração ≤0 aplica-se só fade-in. Novo `getAudioDurationFfmpeg` lê `Duration:` do stderr do ffmpeg (ffmpeg-static só traz `ffmpeg.exe`, não ffprobe).
- **Bugfix: `require('child_process')` quebrava em produção**: esbuild empacota `server.ts` como **ESM** e `require()` dentro de funções lança `Dynamic require of "child_process" is not supported` (rebentou `getAudioDurationFfmpeg` no deploy). Fix: `import { spawn }` no topo de `audio.ts` e renomeada a variável do processo para `ffmpegProc` (evita shadowing do fluent-ffmpeg) (commit `fc6df38`). **Regra: nunca usar `require()` no server — sempre `import` no topo**.
- **Fluxo de recuperação (resume) de música**: retry admin (`POST /request/:id/retry`) com `mureka_task_id` presente e `audio_url` null faz `resumeSunoTaskWorkflow` — consulta a task Suno já-completa e só persiste (sem gastar créditos novos). Usado para recuperar a entrega halectorr sem nova geração.
- **Funil de conversão (~7% pagam) — recuperação de abandonados** (commit `879b6f4`): plano de 5 passos implementado —
  1. `GET /api/song/resume-data/:requestId` (novo, `resumeDataLimiter` 30 req/hora/IP) devolve `formData` completo (mapeia `special_traits→whatMakesSpecial`, `heart_message→messageFromTheHeart`, etc.), `aiSongTitle`, `aiLyrics`, `aiLyricsSnippet`, `aiLetterText`, `dbSongId`, `dbSongRequestId`, `status`; usa `getAdminSupabase()`, valida `UUID_REGEX`, só status `['lyrics_ready','payment_submitted']`.
  2. Rota `/wizard?resume=<id>` reconhecida em `src/App.tsx` (init + popstate).
  3. `Wizard.tsx`: efeito de resume no mount com guard `resumeAppliedRef` (one-shot, reseta no StrictMode), preenche `formData` + estados, salta para ecrã de planos, teaser se ativo; guard no efeito `lyrics_ready` evita re-disparar `fbLyricsGenerated`/`gaViewContent`.
  4. Métrica `payment_screen` (funnel drop) + `fetchResumeData` em `src/api/song.ts` (+3 testes, 404/400→null).
  5. Scheduler de abandono `abandonedRecoveryScheduler.ts` (10min) envia 4 lembretes (30min/24h/48h/72h) com guardas `abandoned_*_sent_at`; Brevo `delivered` confirmado nos logs do Render (webhook). **Query exclui `payment_submitted`** (quem já pagou não recebe "esqueceu-se de pagar").
- **Rollback automático Suno testado + notificação completa**: `rollbackSunoWorkflow` exportado (`workflow.ts`) — reverte `payments.status→failed` + `approved_at:null`, limpa storage órfão, notifica admin (com email/nome do cliente, nº de pagamentos revertidos e link `/admin`) e cliente (`sendWorkflowFailedEmail`). 8 unit tests em `server/__tests__/workflow-rollback.test.ts` (reversão, sem aprovados, fallback `users.email`, storage cleanup, graceful em falhas).
- **Recuperação gratuita de abandonados via WhatsApp (Baileys) + página `/retomar`**: campanha manual no admin — bucket 30min/72h/24h/48h (prioridade), limites 30/dia + 9h–20h (env), envio `@whiskeysockets/baileys` a partir do número `244929423278`, E.164 normalizado, templates genéricos. Novos ficheiros: `supabase_migration_abandoned_whatsapp.sql` (aplicada em produção), `server/services/abandonedMessages.ts`, `server/services/whatsappSender.ts` (import lazy nas rotas — nunca no boot; `sock.end()` requer argumento), rotas em `admin.ts` (`/abandoned`, `/abandoned/send-bulk`, `/abandoned/send-status`, `/abandoned/:id/mark-contacted`, `/whatsapp/link`, `/whatsapp/link-status`), `POST /api/song/recover-by-email` (página `/retomar`), `RecoverPage.tsx`, tab "Abandonados" no `AdminPanel`. **Baileys fica fora do bundle server com `esbuild --packages=external`**; import lazy dentro dos handlers. Limiter `recoverByEmailLimiter` (20/h) + `whatsappBulkLimiter` (10/h). 192 testes (novos: `server/__tests__/abandoned-messages.test.ts` 15, `recoverByEmail` 4 em `song-api.test.ts`).
- **Filtro por tempo na aba Abandonados + verificação real do WhatsApp**: pills "Desde a criação" (`Todos/<1h/1–6h/6–24h/24–48h/48–72h/>72h`) no AdminPanel com `abandonedRange` state — `GET /api/admin/abandoned?range=` filtra por `elapsedInRange` (presets `ABANDONED_TIME_RANGES` + `isAbandonedTimeRange`/`elapsedInRange` em `abandonedMessages.ts`); botão "Verificar ligação" (header + modal QR) chama `GET /api/admin/whatsapp/verify` → `verifyConnection()` no `whatsappSender.ts` (abre o socket Baileys real, devolve `{connected, phone}`), StatCard e badge mostram o número verificado. Typecheck corrigido (rangeFilter `((elapsedMs)=>boolean)|null`; onClick com `() => fetchAbandoned(range)`). Testes: +7 em `abandoned-messages.test.ts` (ranges), +4 em `abandoned-whatsapp-route.test.ts` (range 400/filtro/todos + verify). Total: 218 testes (19 ficheiros).

## AI Providers (Ordem de fallback)
1. **Gemini** (`gemini-2.5-flash`) — tentado primeiro
2. **OpenAI** (`gpt-4o-mini`) — tentado segundo
3. **Claude** (`claude-3-5-sonnet-20241022`) — tentado último

Todas as 3 chaves estão configuradas no `.env`. Se uma falha (ex: sem créditos), a próxima é tentada automaticamente. Se todas falharem, o utilizador vê: *"O saldo de créditos da API de geração de letras está esgotado."*

## Sentry SDK (Monitorização de Erros)
- **Versão**: `@sentry/node` e `@sentry/react` v10.62.0
- **Frontend**: Inicializado em `src/instrument.ts` (importado primeiro em `main.tsx`):
  - `browserTracingIntegration()` — page load + navegação
  - `replayIntegration()` — Session Replay (10% sessões, 100% em erro)
  - `reactErrorHandler()` nas 3 opções do `createRoot` (React 19)
- **Backend**: Inicializado em `server.ts`
  - `setupExpressErrorHandler(app)` após todas as rotas em `app.ts`
  - `tracesSampleRate: 0.1` em produção
- **ErrorBoundary.tsx**: UI fallback com WhatsApp Help
- **Source maps**: `sourcemap: 'hidden'` no Vite
- **MCP**: Configurado via `opencode.json` (STDIO, token `SENTRY_ACCESS_TOKEN`). Org: `sugolden`, Project: `javascript-react`

## Key Decisions
- **Wizard.tsx e AdminPanel.tsx mantidos** — acoplamento interno alto, refactor adiado.
- **Helmet.js com CSP em produção**: configurado para Supabase, Google Fonts, assets self/blob/data/https.
- **Zod no frontend**: schemas partilhados em `src/lib/validation.ts` (separados do server).
- **CI corre em ubuntu-latest com Node 22**, npm ci, lint, test.

## Testes
- **218 testes**, 19 ficheiros — todos passam (vitest + jsdom).- Distribuição: validation (21), email-utils (15), suno-utils (20), AdminPanel (25), validation-frontend (20), SongPlayer (8), metaPixel (20), song-api (11), useAudioPlayer (4), smoke (1), metaPixelCapi (2), ai (3), aiShared (14), helpers (5), workflow-rollback (8), abandoned-messages (22), abandoned-whatsapp-route (8), whatsapp-sender (7).
- **Playwright E2E**: 13 testes (landing, wizard, dedication, admin).

## Next Steps
1. **Custom domain** apontar `seubeat.ao` para Render.
2. **E2E tests completos** com API reais (Wizard → pagamento → dedicatória).
3. **Monitorizar métricas do funil de conversão** — recuperação de abandonados ativa em produção; acompanhar taxa de resume (`payment_screen` vs. `resume-data` hits) e conversão pós-lembrete.

## Critical Context
- **173 testes passam sempre** após cada mudança (vitest).
- **Supabase**: `service_role` key usada apenas onde necessário (admin routes, auth.admin.*, workflows, signed URLs). Anon key usada no endpoint público de dedicatória.
- **AI providers**: OpenAI + Gemini + Claude configurados. Fallback automático se um falhar.
- **Suno**: API key configurada, 500+ créditos. `deliveryScheduler.ts` para entregas Standard.
- **Render** faz auto-deploy a cada push no `main`.
- **CI pipeline**: GitHub Actions corre `npm run lint` e `npm test` antes do deploy.
- **Migration aplicada**: `deliver_at`, `delivered_at`, `deleted_at` + índice no Supabase produção.

## Relevant Files
- `server/services/supabase.ts`: `getAdminSupabase()`, `getPublicSupabase()`, `uploadToSupabase()`.
- `server/services/deliveryScheduler.ts`: scheduler de entrega 24h (10min interval).
- `server/services/abandonedRecoveryScheduler.ts`: scheduler de lembretes de abandono (30min/24h/48h/72h; exclui `payment_submitted`).
- `server/services/workflow.ts`: orquestração Suno + transições de status (`resumeSunoTaskWorkflow`, `persistGeneratedSunoAudio`, `rollbackSunoWorkflow` exportado, `MIN_SONG_DURATION_SEC`).
- `server/services/suno.ts`: `querySunoTask`, `pollSunoTask`, `FAILED_STATUSES`, `extractAudioUrl`.
- `server/services/audio.ts`: `getAudioDuration`, `getAudioDurationFfmpeg` (stderr do ffmpeg), `applyFades`.
- `server/services/email.ts`: `sendPersonalizedEmail`, `sendConfirmationEmail`, `sendPaymentRejectionEmail`.
- `server/services/ai.ts`: orquestrador de providers (OpenAI → Gemini → Claude).
- `server/services/aiShared.ts`: shared utils de retry, extractJSON, validateComposition.
- `server/routes/public.ts`: rotas públicas (wizard, pagamento, dedicatória, `GET /song/resume-data/:requestId`).
- `server/routes/admin.ts`: painel admin + aprovação/rejeição + cron.
- `server/middleware/security.ts`: Helmet, CORS, logger.
- `server/middleware/adminIpRestriction.ts`: IP whitelist opcional.
- `server/utils/audit.ts`: log de acções admin para undo.
- `server/utils/helpers.ts`: `publicErrorMessage`, `getAppUrl`.
- `server/__tests__/workflow-rollback.test.ts`: 8 testes do `rollbackSunoWorkflow`.
- `supabase_setup.sql`: Setup SQL original **desatualizado** face ao schema real.
- `supabase_migration_scheduler.sql`: Migration com `deliver_at`, `delivered_at`, `deleted_at`, índice.
- `supabase_migration_wizard_optional_fields.sql`: Migration com `reference_artist`, `why_created_today`, `only_she_does`, `where_it_happened`.
- `.github/workflows/ci.yml`: CI pipeline (lint + test + e2e).
- `vitest.config.ts`: config jsdom + React plugin.
- `src/lib/validation.ts`: Zod schemas partilhados (frontend).
- `src/components/WizardSteps.tsx`: erros inline via `fieldErrors`.
- `src/components/WhatsAppHelp.tsx`: botão de ajuda WhatsApp.
- `e2e/`: 13 testes Playwright.
- `playwright.config.ts`: config Chromium headless + webServer.
