# SeuBeat — Project Context

## Goal
Refatorar e melhorar a segurança do SeuBeat (App React + Express + Supabase + Suno API).

## Constraints & Preferences
- Não quebrar nada existente — cada mudança validada com lint + testes (118 tests).
- Wizard.tsx e AdminPanel.tsx mantidos como estão (2296 e 1771 linhas) — risco de extração elevado, acordado manter.

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
- **Fase 3a**: `server/config/env.ts`, `server/config/app.ts`, `server/middleware/security.ts` extraídos. `server.ts` de 121→20 linhas.
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

## AI Providers (Ordem de fallback)
1. **OpenAI** (`gpt-4o-mini`) — tentado primeiro
2. **Gemini** (`gemini-2.5-flash`) — tentado segundo
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
- **118 testes**, 10 ficheiros — todos passam (vitest + jsdom).
- Distribuição: validation (18), email-utils (15), suno-utils (20), AdminPanel (25), validation-frontend (11), SongPlayer (8), metaPixel (12), song-api (4), useAudioPlayer (4), smoke (1).
- **Playwright E2E**: 12 testes (landing, wizard, dedication, admin).

## Next Steps
1. **Rollback automático no Suno** — se workflow falhar após pagamento aprovado, reverter `payments.status` + notificar admin.
2. **Custom domain** apontar `seubeat.ao` para Render.
3. **E2E tests completos** com API reais (Wizard → pagamento → dedicatória).

## Critical Context
- **118 testes passam sempre** após cada mudança (vitest).
- **Supabase**: `service_role` key usada apenas onde necessário (admin routes, auth.admin.*, workflows, signed URLs). Anon key usada no endpoint público de dedicatória.
- **AI providers**: OpenAI + Gemini + Claude configurados. Fallback automático se um falhar.
- **Suno**: API key configurada, 500+ créditos. `deliveryScheduler.ts` para entregas Standard.
- **Render** faz auto-deploy a cada push no `main`.
- **CI pipeline**: GitHub Actions corre `npm run lint` e `npm test` antes do deploy.
- **Migration aplicada**: `deliver_at`, `delivered_at`, `deleted_at` + índice no Supabase produção.

## Relevant Files
- `server/services/supabase.ts`: `getAdminSupabase()`, `getPublicSupabase()`, `uploadToSupabase()`.
- `server/services/deliveryScheduler.ts`: scheduler de entrega 24h (10min interval).
- `server/services/workflow.ts`: orquestração Suno + transições de status.
- `server/services/email.ts`: `sendPersonalizedEmail`, `sendConfirmationEmail`, `sendPaymentRejectionEmail`.
- `server/services/ai.ts`: orquestrador de providers (OpenAI → Gemini → Claude).
- `server/routes/public.ts`: rotas públicas (wizard, pagamento, dedicatória).
- `server/routes/admin.ts`: painel admin + aprovação/rejeição + cron.
- `server/middleware/security.ts`: Helmet, CORS, logger.
- `server/middleware/adminIpRestriction.ts`: IP whitelist opcional.
- `server/utils/audit.ts`: log de acções admin para undo.
- `server/utils/helpers.ts`: `publicErrorMessage`, `getAppUrl`.
- `supabase_setup.sql`: Setup SQL original **desatualizado** face ao schema real.
- `supabase_migration_scheduler.sql`: Migration com `deliver_at`, `delivered_at`, `deleted_at`, índice.
- `.github/workflows/ci.yml`: CI pipeline (lint + test + e2e).
- `vitest.config.ts`: config jsdom + React plugin.
- `src/lib/validation.ts`: Zod schemas partilhados (frontend).
- `src/components/WizardSteps.tsx`: erros inline via `fieldErrors`.
- `src/components/WhatsAppHelp.tsx`: botão de ajuda WhatsApp.
- `e2e/`: 12 testes Playwright.
- `playwright.config.ts`: config Chromium headless + webServer.
