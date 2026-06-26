# SeuBeat — Project Context

## Goal
Refatorar e melhorar a segurança do SeuBeat (App React + Express + Supabase + Suno API).

## Constraints & Preferences
- Não quebrar nada existente — cada mudança validada com lint + testes (56 tests).
- Wizard.tsx e AdminPanel.tsx mantidos como estão (2108 e 1771 linhas) — risco de extração elevado, acordado manter.

## Progress
### Done
- **Rate limiting** em `/api/generate-lyrics` (5 req/hora) já existente e funcional.
- **Foto não perder no refresh**: sessionStorage guarda base64, restaurado ao recarregar.
- **Página dedicatória sem `?id=`** bater na API: fallback `seubeat_last_song_id`; mostra "não encontrada".
- **ErrorBanner + Toast** para erros no frontend.
- **Logger estruturado** Winston com níveis e rotação.
- **WizardSteps.tsx** extraído (Wizard.tsx caiu de 2865→2108 linhas).
- **56 testes** (validation, email-utils, suno-utils, smoke).
- **Logging personaId** adicionado em start e continue (truncado + payload).
- **DedicationPage fetch** com AbortController (10s timeout) + race condition `notFound`/`fetchError` corrigida.
- **Fase 1a**: Constantes `PRICING_PLANS`, `DEMO_SONGS` extraídas de `types.ts` para `src/constants/`.
- **Fase 1b**: API layer criada (`src/api/song.ts`, `lyrics.ts`, `payment.ts`).
- **Fase 1c**: Hooks criados (`useSong`, `useAudioPlayer`).
- **Fase 1d**: `PersonalizedSongPage.tsx` de ~760→~300 linhas, 4 subcomponentes extraídos (`SongPlayer`, `SongLyrics`, `SongLetter`, `SongShare`).
- **Fase 3a**: `server/config/env.ts`, `server/config/app.ts`, `server/middleware/security.ts` extraídos. `server.ts` de 121→20 linhas.
- **Fase 3b**: Barrel exports (`index.ts`) em todas as pastas (`src/`, `server/`, `server/config/`, `server/middleware/`, `server/services/`, `server/utils/`, `server/routes/`).
- **Commit histórico**: `e01c7b4` com todas as fases 1-3.
- **Separação do Supabase client**: `getSupabase()` renomeado para `getAdminSupabase()`, novo `getPublicSupabase()` com anon key.
- **GET /api/song/:id** movido para public client (RLS respeitado, blast radius reduzido).
- **Signed URL** de `full-audio` gerado com admin client (não expõe bucket privado ao anon key).
- **RLS policies** adicionadas para anon SELECT em `song_requests` e `users` (apenas nome).
- **Commit**: `a7b3c9d` com separação do Supabase client.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- **Wizard.tsx e AdminPanel.tsx mantidos** — acoplamento interno alto, refactor adiado. Files grandes não causam problemas operacionais.
- **Abordagem de separação do Supabase**: dois clients — admin (service_role) e public (anon key). GET /api/song/:id usa public client; signed URL de full-audio usa admin client para evitar expor bucket privado.
- **RLS policies já existiam** no SQL de setup baseadas em `auth.uid()` (autenticação). Adicionadas novas policies para anon SELECT nas tabelas que a dedicatória pública precisa.
- **`.env.example` documenta** `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

## Next Steps (baixa prioridade)
1. **CORS** `ALLOWED_ORIGIN=*` em produção (definir domínio real).
2. **Helmet.js** para headers de segurança adicionais.
3. **Admin IP-restrito** via middleware ou firewall.

## Critical Context
- **56 testes passam sempre** após cada mudança (vitest).
- **Supabase**: `service_role` key usada apenas onde necessário (admin routes, auth.admin.*, workflows, signed URLs). Anon key usada no endpoint público de dedicatória.
- **Render** faz auto-deploy a cada push no `main`.

## Relevant Files
- `server/services/supabase.ts`: `getAdminSupabase()`, `getPublicSupabase()`, `uploadToSupabase()`.
- `server/routes/public.ts`: GET /api/song/:id usa `getPublicSupabase()` (linha 387); signed URL usa `getAdminSupabase()` (linha 409); restante usa `getAdminSupabase()`.
- `server/routes/admin.ts`: importa `getAdminSupabase()`.
- `server/services/workflow.ts`: importa `getAdminSupabase()`.
- `supabase_setup.sql`: RLS policies existentes (linhas 121-188) + novas policies anon SELECT (linhas 298-309).
- `supabase_migration_advisor.sql`: mesmas políticas anon SELECT (secção 3).
- `.env.example`: todas as variáveis de ambiente documentadas.
