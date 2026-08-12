# SeuBeat — Project Context

## Goal
Refatorar e melhorar a segurança do SeuBeat (App React + Express + Supabase + Suno API).

## Constraints & Preferences
- Não quebrar nada existente — cada mudança validada com lint + testes (246 tests).
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
- **Recuperação gratuita de abandonados via WhatsApp + página `/retomar`**: campanha manual no admin — bucket 30min/72h/24h/48h (prioridade), limites 30/dia + 9h–20h (env), E.164 normalizado, templates genéricos. Novos ficheiros: `supabase_migration_abandoned_whatsapp.sql` (aplicada em produção), `server/services/abandonedMessages.ts`, `server/services/whatsappTemplates.ts`, `server/services/whatsappSender.ts` (import lazy nas rotas — nunca no boot), rotas em `admin.ts` (`/abandoned`, `/abandoned/send-bulk`, `/abandoned/send-status`, `/abandoned/:id/mark-contacted`), `POST /api/song/recover-by-email` (página `/retomar`), `RecoverPage.tsx`, tab "Abandonados" no `AdminPanel`. Limiter `recoverByEmailLimiter` (20/h) + `whatsappBulkLimiter` (10/h). 192 testes (novos: `server/__tests__/abandoned-messages.test.ts` 15, `recoverByEmail` 4 em `song-api.test.ts`).
- **Filtro por tempo na aba Abandonados + verificação real do WhatsApp**: pills "Desde a criação" (`Todos/<1h/1–6h/6–24h/24–48h/48–72h/>72h`) no AdminPanel com `abandonedRange` state — `GET /api/admin/abandoned?range=` filtra por `elapsedInRange` (presets `ABANDONED_TIME_RANGES` + `isAbandonedTimeRange`/`elapsedInRange` em `abandonedMessages.ts`); botão "Verificar ligação" (header + modal QR) chama `GET /api/admin/whatsapp/verify` → `verifyConnection()` no `whatsappSender.ts` (abre o socket Baileys real, devolve `{connected, phone}`), StatCard e badge mostram o número verificado. Typecheck corrigido (rangeFilter `((elapsedMs)=>boolean)|null`; onClick com `() => fetchAbandoned(range)`). Testes: +7 em `abandoned-messages.test.ts` (ranges), +4 em `abandoned-whatsapp-route.test.ts` (range 400/filtro/todos + verify). Total: 218 testes (19 ficheiros).
- **Auditoria de saúde (10/Ago 2026)**: site saudável (HTTP 200, deploy `c096482` live, zero erros pós-deploy); OpenAI/Anthropic sem créditos — só Gemini operacional (ver secção AI Providers). Adicionados:
  - **Fix `crypto.randomUUID()` (crash página em branco em Android 10/webview Facebook)**: novo `src/lib/uuid.ts` com `safeUUID()` (usa `crypto.randomUUID()` quando existe; fallback Web Crypto `getRandomValues` ou `Math.random`); substituídos os 8 callsites (`analytics.ts`, `LandingPage.tsx`, `Wizard.tsx` x6). 5 testes novos (`src/__tests__/uuid.test.ts`).
  - **Índice `email_events(request_id)`**: `supabase_migration_email_events_request_id_idx.sql` + aplicado em produção (`idx_email_events_request_id`).
  - **Sentry: filtro do ruído do Facebook in-app webview** em `src/instrument.ts` (`beforeSend` ignora `window.webkit.messageHandlers`, `Java object is gone`, `iabjs:`, FBWebView) — as issues JAVASCRIPT-REACT-3/5/6/7/H são código injetado pelo próprio Facebook, não nosso.
  - **`/health` ainda não valida `GEMINI_API_KEY`/créditos** — recomendado adicionar futuramente (só reporta anthropic/openai/suno/brevo).
- **Recuperação automática de letras falhadas** (`failedLyricsRecoveryScheduler.ts`, 10min): pedidos `failed` com `error_details` (sem `recovery_retried_at`) e sem música nas últimas 48h são regenerados em background (`generateLyrics`), cria-se a row de `songs` e marca-se `lyrics_ready` (o cliente retoma no pagamento). Guardas: **one-shot** via `recovery_retried_at` (claim atómico com `.filter(..., is null)`), dedupe **um pedido por email** (o mais recente), emails com outro pedido recuperável (`lyrics_ready`/`payment_submitted`) são ignorados, janela de 48h (não gasta créditos em leads antigos), notificação ao cliente via `sendLyricsRecoveredEmail`. Reutiliza o mapeamento `buildRecoveryFormData` idêntico ao resume-data/regenerate do admin.
- **Mensagem 503 amigável em falha 100% transitória**: `ai.ts` agora anexa `providerFailures` (array `{provider, kind, message}`) ao erro final via `classifyAIError`; `server/utils/aiFailure.ts` com `allFailuresTransient` + `LYRIC_GENERATION_QUEUED_MESSAGE`; o catch de `/generate-lyrics` devolve 503 "guardámos o teu pedido — vamos gerar automaticamente" quando TODOS os providers falharam transitória (503/429/timeout) e o pedido está registado — os restantes cenários (créditos, config, auth) continuam com o 500/`publicErrorMessage` normal.
- **Botão "Regenerar letra" no admin para pedidos falhados**: `POST /api/admin/request/:id/regenerate-lyrics` (com auth admin) gera a letra; se o pedido não tem música, cria a row de `songs` (`mureka_status: not_started`), marca `lyrics_ready` (se `status === failed`, limpando `error_details`) e devolve `recovered: true`; se já tem música, atualiza a song existente e devolve `recovered: false` (sem tocar no status). Caminho para desbloquear manualmente pedidos que falharam antes do scheduler/pagar de novo.
- **Migração WhatsApp Baileys → WhatsApp Business Cloud API (Meta)**: o envio de abandonados deixou de depender do QR/socket Baileys — passa pela Graph API v21 (envio de templates + webhook de delivery). `server/services/whatsappSender.ts` reescrito (935 linhas → ~370): `sendTemplate` (POST `/{PHONE_NUMBER_ID}/messages`), `sendAbandonedWhatsApp` com estado `ready/sending/sent`, `sendDeliveryWebhook`/`handleDeliveryWebhook` (persiste em `whatsapp_send_log.message_id/template_name` + status), `getConfigStatus`, `getSendProgress`, caps por hora, delay jitter 3–8s. Rotas: webhook Meta em `server/routes/webhook.ts` (`GET /webhooks/whatsapp` handshake `hub.verify_token`; `POST` → `handleDeliveryWebhook`). AdminPanel: removidos QR modal/verify/logout, substituídos por "Verificar configuração" (`refreshWhatsAppConfig` → `GET /api/admin/whatsapp/config-status`). Env vars novas em `.env.example`: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_PHONE`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_ENABLED_BUCKETS`, caps/delays. Migration `supabase_migration_whatsapp_cloud.sql` (aditiva; não aplicada em produção — pendente). Baileys removido (`server/utils/qr.ts` apagado, `@whiskeysockets/baileys` fora do bundle). 15 testes novos em `server/__tests__/whatsapp-cloud.test.ts` (substitui `whatsapp-sender.test.ts`/`qr-util.test.ts`, apagados); bugfix: mock `getAdminSupabase()` devolvia wrapper `{query,...}` sem `.from` → passou a devolver o objeto query encadeável.
- **Bugfix: teaser de letras quebrava no refresh** (letra completa voltava a aparecer a não-pagantes após F5): o estado `lyricsTeaser` não era persistido no localStorage e só era reconstruído na geração/regeneração/resume com `?resume=`. No refresh, `lyricsTeaser` ficava `null` e a tela de preview caía no `else` que mostrava `aiLyrics.join('\n')` completo. Fix: novo `useEffect` em `Wizard.tsx` reconstrói `buildTeaser(aiLyrics.join('\n'))` quando `generationStatus === 'lyrics_ready' && teaserEnabled && !lyricsTeaser && aiLyrics.length > 0` (deps: `[teaserEnabled, generationStatus, lyricsTeaser, aiLyrics]`).
- **Supabase Advisor (12/Ago 2026)**: `public_bucket_allows_listing` resolvido — `DROP POLICY "Public can view avatars"` e `"Public view discount images"` em `storage.objects` (migration `security_advisor_bucket_listing_fix` aplicada). Resta `auth_leaked_password_protection` (passo manual Dashboard → Authentication → Password Protection). `auth_rls_initplan` corrigido via `supabase_migration_fix_auth_rls_initplan.sql` (Dashboard SQL Editor).
- **Bugfix: pedido aprovado rebaixado para `payment_submitted` → página só tocava 30s** (`leitao12@yahoo.com.br`): pedido `8c7092c2-...` tinha música completa (197s) + pagamento aprovado (`10cc4de7`, 12/Ago 17:23), mas às 18:29:18 o cliente re-submeteu o comprovativo (aba do wizard antiga) e `POST /api/submit-payment` reescreveu `song_requests.status = 'payment_submitted'` SEM validar o pagamento aprovado — o `INSERT` em `payments` falhava silenciosamente (UNIQUE em `payments.request_id`; catch sem log → 500 invisível). Como `GET /api/song/:id` só serve o áudio completo em `delivered`/`approved`, o cliente ficou só com o preview de 30s. Fix: guard em `server/routes/public.ts` — se já existe payment `approved` OU o pedido está `approved`/`delivered`, devolve **409** sem tocar no estado (o wizard já trata 409 como sucesso). Dados corrigidos via `UPDATE status='approved', deliver_at = now()-1min` → o scheduler entregou (`delivered` às 22:24:52). 3 testes novos em `server/__tests__/submit-payment.test.ts`.

## AI Providers (Ordem de fallback)
1. **Gemini** (`gemini-2.5-flash`) — tentado primeiro
2. **OpenAI** (`gpt-4o-mini`) — tentado segundo
3. **Claude** (`claude-3-5-sonnet-20241022`) — tentado último

Todas as 3 chaves estão configuradas no `.env`. Se uma falha (ex: sem créditos), a próxima é tentada automaticamente. Se todas falharem, o utilizador vê: *"O saldo de créditos da API de geração de letras está esgotado."*

> **⚠️ Estado real (10/Ago 2026)**: só o **Gemini** está com créditos operacionais. OpenAI devolve `429 no credits` e Anthropic `400 balance too low` desde ~06/Ago — o fallback para estes 2 está morto. Se o Gemini der `503 high demand` (aconteceu 06–07/Ago, quebrando utilizadores reais), a geração falha. Recarregar OpenAI ou Anthropic restaura a redundância. Fica documentado em `server/services/ai.ts` (`DEFAULT_PROVIDER_ORDER`).

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
- **249 testes**, 23 ficheiros — todos passam (vitest + jsdom; 2 do AdminPanel podem dar timeout em run paralelo pesado, passam isolados).- Distribuição: validation (21), email-utils (15), suno-utils (20), AdminPanel (25), validation-frontend (20), SongPlayer (8), metaPixel (20), song-api (11), useAudioPlayer (4), smoke (1), metaPixelCapi (2), ai (3), aiShared (14), helpers (5), workflow-rollback (8), abandoned-messages (22), abandoned-whatsapp-route (8), whatsapp-cloud (15), uuid (5), aiFailure (6), failed-lyrics-recovery (10), admin-regenerate (3), submit-payment (3).
- **Playwright E2E**: 13 testes (landing, wizard, dedication, admin).

## Security Advisor (10/Ago 2026) — resolvido (11→1 lint)
- Migration `supabase_migration_security_advisor_cleanup.sql` (aplicada em produção): 10 drops de tabelas/funções do **AngoLife** que poluíam o projeto (`profiles`, `multicaixas`, `reportes_multicaixa`, `subscriptions_pending`, `news_articles`, `product_deals`, `orders`, `exchange_rates`, `push_subscriptions`, `jobs` + funções `multicaixa_*` e `generate_referral_code`). Confirmado: zero refs no código SeuBeat, FKs apenas internas ao conjunto.
- **RLS nas 3 tabelas SeuBeat sem policy** (`admin_audit_log`, `whatsapp_send_log`, `whatsapp_session`): `REVOKE all` de `anon`/`authenticated` + `create policy "deny_all" ... using(false) with check(false)`. `service_role` continua com acesso (bypass).
- **Restou 1 lint**: `auth_leaked_password_protection` — **passo manual**: Dashboard → Authentication → Password Protection → ativar (não há token de management válido p/ API).
- Realtime de `multicaixas`/`reportes_multicaixa` removido automaticamente com o drop das tabelas.
- **Bugfix undo no AdminPanel** (`server/routes/admin.ts:1007`): `if (undoError || !undoError)` (sempre true) → `if (!undoError)`; lista de reversão do `song_requests` alinhada (agora inclui `delivered`, `music_ready`, `music_processing`, `voice_processing`). Antes, um approved→undo não revertia músicas já `delivered`.

## Supabase Advisor (11/Ago 2026) — warnings pendentes
- **MCP Supabase sem permissões** (token bloqueado: nem `list_tables`/`get_advisors` funcionam) — migrações só via Dashboard manual.
- **WARN `auth_rls_initplan`** (performance): policy `admin_select` em `email_events` reavalia `auth.role()` por linha. Fix preparado em `supabase_migration_fix_auth_rls_initplan.sql` (usa `(SELECT auth.role())` — initplan). **Aplicar no Dashboard → SQL Editor**.
- **5 × INFO `unused_index`**: `idx_email_events_recipient`, `idx_email_events_event`, `idx_song_requests_abandoned_48h`, `idx_song_requests_abandoned_72h`, `idx_whatsapp_send_log_request` — nunca usados; drops incluídos na mesma migration. `idx_song_requests_abandoned_48h/72h` foram criados manualmente (sem ficheiro de migration) e o scheduler não os usa.
- **WARN `auth_leaked_password_protection`** (security): passo manual — Dashboard → Authentication → Password Protection → ativar (sem token de management p/ API).
- **3 commits push**: `0876097` (migração WhatsApp Cloud), `9ad2657` + `317519b` (warnings advisor).

## Next Steps
1. **Custom domain** apontar `seubeat.ao` para Render.
2. **E2E tests completos** com API reais (Wizard → pagamento → dedicatória).
3. **Monitorizar métricas do funil de conversão** — recuperação de abandonados ativa em produção; acompanhar taxa de resume (`payment_screen` vs. `resume-data` hits) e conversão pós-lembrete.

## Critical Context
- **249 testes passam sempre** após cada mudança (vitest).
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
- `server/services/failedLyricsRecoveryScheduler.ts`: scheduler de recuperação de letras falhadas (10min; one-shot via `recovery_retried_at`, janela 48h, dedupe por email).
- `server/services/workflow.ts`: orquestração Suno + transições de status (`resumeSunoTaskWorkflow`, `persistGeneratedSunoAudio`, `rollbackSunoWorkflow` exportado, `MIN_SONG_DURATION_SEC`).
- `server/services/email.ts`: `sendPersonalizedEmail`, `sendConfirmationEmail`, `sendPaymentRejectionEmail`, `sendLyricsRecoveredEmail`.
- `server/services/ai.ts`: orquestrador de providers (OpenAI → Gemini → Claude); anexa `providerFailures` ao erro final.
- `server/utils/aiFailure.ts`: `allFailuresTransient` + `LYRIC_GENERATION_QUEUED_MESSAGE` (503 amigável).
- `server/routes/admin.ts`: painel admin + aprovação/rejeição + cron + `POST /request/:id/regenerate-lyrics`.
- `server/services/suno.ts`: `querySunoTask`, `pollSunoTask`, `FAILED_STATUSES`, `extractAudioUrl`.
- `server/services/audio.ts`: `getAudioDuration`, `getAudioDurationFfmpeg` (stderr do ffmpeg), `applyFades`.
- `server/services/aiShared.ts`: shared utils de retry, extractJSON, validateComposition.
- `server/routes/public.ts`: rotas públicas (wizard, pagamento, dedicatória, `GET /song/resume-data/:requestId`).
- `server/middleware/security.ts`: Helmet, CORS, logger.
- `server/middleware/adminIpRestriction.ts`: IP whitelist opcional.
- `server/utils/audit.ts`: log de acções admin para undo.
- `server/utils/helpers.ts`: `publicErrorMessage`, `getAppUrl`.
- `server/__tests__/workflow-rollback.test.ts`: 8 testes do `rollbackSunoWorkflow`.
- `server/__tests__/failed-lyrics-recovery.test.ts`: 10 testes do `processFailedLyricsRecovery` (claim one-shot, dedupe, janela 48h).
- `server/__tests__/admin-regenerate.test.ts`: 3 testes do `POST /request/:id/regenerate-lyrics`.
- `server/__tests__/aiFailure.test.ts`: 6 testes do `allFailuresTransient`.
- `server/__tests__/submit-payment.test.ts`: 3 testes do guard anti-rebaixamento do `POST /submit-payment`.
- `supabase_setup.sql`: Setup SQL original **desatualizado** face ao schema real.
- `supabase_migration_email_events_request_id_idx.sql`: Migration com `idx_email_events_request_id` (aplicada em produção).
- `supabase_migration_scheduler.sql`: Migration com `deliver_at`, `delivered_at`, `deleted_at`, índice.
- `supabase_migration_wizard_optional_fields.sql`: Migration com `reference_artist`, `why_created_today`, `only_she_does`, `where_it_happened`.
- `.github/workflows/ci.yml`: CI pipeline (lint + test + e2e).
- `vitest.config.ts`: config jsdom + React plugin.
- `src/lib/validation.ts`: Zod schemas partilhados (frontend).
- `src/lib/uuid.ts`: `safeUUID()` com fallback seguro para browsers sem `crypto.randomUUID`.
- `src/components/WizardSteps.tsx`: erros inline via `fieldErrors`.
- `src/components/WhatsAppHelp.tsx`: botão de ajuda WhatsApp.
- `e2e/`: 13 testes Playwright.
- `playwright.config.ts`: config Chromium headless + webServer.
