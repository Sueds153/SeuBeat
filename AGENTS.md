# SeuBeat — Project Context

## Goal
Refatorar e melhorar a segurança do SeuBeat (App React + Express + Supabase + Suno API).

## Constraints & Preferences
- Não quebrar nada existente — cada mudança validada com lint + testes (82 tests).
- Wizard.tsx e AdminPanel.tsx mantidos como estão (2296 e 1771 linhas) — risco de extração elevado, acordado manter.

## Progress
### Done
- **Rate limiting** em `/api/generate-lyrics` (5 req/hora) já existente e funcional.
- **Foto não perder no refresh**: sessionStorage guarda base64, restaurado ao recarregar.
- **Página dedicatória sem `?id=`** bater na API: fallback `seubeat_last_song_id`; mostra "não encontrada".
- **ErrorBanner + Toast** para erros no frontend.
- **Logger estruturado** Winston com níveis e rotação.
- **WizardSteps.tsx** extraído (Wizard.tsx caiu de 2865→2296 linhas).
- **82 testes** (validation, validation-frontend, email-utils, suno-utils, SongPlayer, song-api, useAudioPlayer, smoke).
- **Logging personaId** adicionado em start e continue (truncado + payload).
- **DedicationPage fetch** com AbortController (10s timeout) + race condition `notFound`/`fetchError` corrigida.
- **Fase 1a**: Constantes `PRICING_PLANS`, `DEMO_SONGS` extraídas de `types.ts` para `src/constants/`.
- **Fase 1b**: API layer criada (`src/api/song.ts`, `lyrics.ts`, `payment.ts`).
- **Fase 1c**: Hooks criados (`useSong`, `useAudioPlayer`).
- **Fase 1d**: `PersonalizedSongPage.tsx` de ~760→~300 linhas, 4 subcomponentes extraídos (`SongPlayer`, `SongLyrics`, `SongLetter`, `SongShare`).
- **Fase 3a**: `server/config/env.ts`, `server/config/app.ts`, `server/middleware/security.ts` extraídos. `server.ts` de 121→20 linhas.
- **Fase 3b**: Barrel exports (`index.ts`) em todas as pastas.
- **Commit histórico**: `e01c7b4` com todas as fases 1-3.
- **Separação do Supabase client**: `getSupabase()` renomeado para `getAdminSupabase()`, novo `getPublicSupabase()` com anon key.
- **GET /api/song/:id** movido para public client (RLS respeitado, blast radius reduzido).
- **Signed URL** de `full-audio` gerado com admin client (não expõe bucket privado ao anon key).
- **RLS policies** adicionadas para anon SELECT em `song_requests` e `users` (apenas nome).
- **Helmet.js** substitui headers de segurança manuais (CSP, HSTS, etc.).
- **Admin IP-restrição** via `ADMIN_ALLOWED_IPS` env var (opcional, fallback para password).
- **CI pipeline**: `.github/workflows/ci.yml` corre lint + testes em push/PR.
- **Validação frontend com Zod**: schemas partilhados, erros inline nos WizardSteps (mensagens vermelhas por campo).
- **Testes React**: SongPlayer (7 testes), useAudioPlayer (4 testes), song-api (4 testes), validation-frontend (11 testes).
- **Commit**: `27538ef` com todas as melhorias de segurança e testes.

### Done (latest)
- **Bugfix: Ocasião "Declaração de amor" partida**: frontend (`Wizard.tsx`) enviava `"Declaração de amor"` mas backend esperava `"declaração"`. Fix: type do card alterado para `"Declaração"`.
- **Telefone aceita formato internacional**: regex do server-side validation atualizado para aceitar `+`, espaços, `()`, `-`.
- **Mensagens de erro 500 melhoradas**: `publicErrorMessage` agora captura erros de auth (401/403), bucket storage, rate-limit, etc. com mensagens específicas para o utilizador.
- **Commit**: (pendente)

### Blocked
- (none)

## Sentry SDK (Monitorização de Erros)
- **Versão**: `@sentry/node` e `@sentry/react` v10.62.0
- **Frontend**: Inicializado em `src/instrument.ts` (importado primeiro em `main.tsx`):
  - `browserTracingIntegration()` — page load + navegação
  - `replayIntegration()` — Session Replay (10% sessões, 100% em erro)
  - `reactErrorHandler()` nas 3 opções do `createRoot` (React 19)
- **Backend**: Inicializado em `server.ts` (antes de qualquer middleware)
  - `setupExpressErrorHandler(app)` após todas as rotas em `app.ts`
  - `tracesSampleRate: 0.1` em produção
- **ErrorBoundary.tsx**: mantém UI fallback com WhatsApp Help; erro capturado pelo React 19 → `reactErrorHandler()`
- **Ativar**: Adicionar `SENTRY_DSN` e `VITE_SENTRY_DSN` nas env vars do Render
- **Source maps**: `sourcemap: 'hidden'` no Vite. Para upload automático, instalar `@sentry/vite-plugin`, adicionar `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- **MCP (Model Context Protocol)**: Configurado em `opencode.json` via STDIO com token de acesso para AI agents consultarem issues/eventos. Org: `sugolden`, Project: `javascript-react`.

## Key Decisions
- **Wizard.tsx e AdminPanel.tsx mantidos** — acoplamento interno alto, refactor adiado. Files grandes não causam problemas operacionais.
- **Helmet.js com CSP em produção**: configurado para permitir Supabase, Google Fonts, e assets self/blob/data/https.
- **Zod no frontend**: usa os mesmos padrões do server-side validation mas com schemas separados em `src/lib/validation.ts`.
- **CI corre em ubuntu-latest com Node 22**, npm ci, lint, test.

## Next Steps (baixa prioridade)
1. **Custom domain** apontar `seubeat.ao` para Render.
2. **E2E tests completos** com API reais (Wizard → pagamento → dedicatória).
3. **Admin dashboard testes** (component tests para AdminPanel).

## Critical Context
- **82 testes passam sempre** após cada mudança (vitest).
- **Supabase**: `service_role` key usada apenas onde necessário (admin routes, auth.admin.*, workflows, signed URLs). Anon key usada no endpoint público de dedicatória.
- **Render** faz auto-deploy a cada push no `main`.
- **CI pipeline**: GitHub Actions corre `npm run lint` e `npm test` antes do deploy.

## Relevant Files
- `server/services/supabase.ts`: `getAdminSupabase()`, `getPublicSupabase()`, `uploadToSupabase()`.
- `server/middleware/security.ts`: Helmet, CORS, logger.
- `server/middleware/adminIpRestriction.ts`: IP whitelist opcional para admin.
- `.github/workflows/ci.yml`: CI pipeline (lint + test + e2e).
- `vitest.config.ts`: config jsdom + React plugin.
- `src/lib/validation.ts`: Zod schemas partilhados para frontend.
- `src/components/WizardSteps.tsx`: inline validation errors via `fieldErrors` prop.
- `src/components/WhatsAppHelp.tsx`: botão de ajuda WhatsApp reutilizável.
- `src/constants/whatsapp.ts`: constantes WhatsApp (número, URL, mensagens).
- `e2e/`: 12 testes Playwright (landing, wizard, dedication, admin).
- `playwright.config.ts`: config Chromium headless + webServer.
