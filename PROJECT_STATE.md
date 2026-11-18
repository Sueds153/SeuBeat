# SeuBeat — Estado Atual

Atualizado em 18/Nov/2026. Snapshot operacional; o histórico detalhado está no Git.

## Stack e arquitectura
- React 19, Vite, TypeScript, Tailwind; API Node.js/Express empacotada para Vercel/Render.
- Supabase (Postgres/Auth/Storage), Suno/Mureka para áudio; R2 com fallback para Supabase Storage.
- Rotas API em `server/routes`; auth admin separada; workflows e schedulers em `server/services`.
- O wizard normal mantém geração de letras, aprovação/pagamento e entrega actuais.

## Estado de produção conhecido
- Fluxo normal: letras → escolha de plano → comprovativo → aprovação → Suno → entrega.
- Geração IA usa ordem configurada por `AI_PROVIDER_ORDER`; Suno/Mureka é processamento assíncrono.
- Schedulers activos incluem entrega, recuperação de músicas/letras e lembretes de abandono.
- Segredos críticos ficam apenas no servidor: Supabase service role, Suno, IA, email, WhatsApp e admin.
- `.env.example` documenta configuração; nunca incluir `.env` ou dados reais em commits.
- Produção: `https://seubeat.vercel.app`, deploy automático a partir da `main` (Vercel).

## Integração ComAmor — activa em produção
- Integração aditiva em `/api/v1/comamor`, ligada por `COMAMOR_INTEGRATION_ENABLED=true`.
- A referência `comamor_order` não autoriza: o servidor valida com o ComAmor antes de mostrar o formulário, criar job ou consultar resultado.
- Reserva de job usa `idempotency_key` do ComAmor e função transaccional; o retry com o mesmo texto recupera o mesmo job.
- Conteúdo fornecido pelo organizador é guardado na tabela normal de pedidos; nenhum dado ou mídia familiar é importado.
- Callback assinado por HMAC vai por outbox durável, com retry, timestamp e supressão de tentativas antigas.
- Áudio só é devolvido em HTTPS e host exacto incluído no allowlist.
- `COMAMOR_VERCEL_PROTECTION_BYPASS` é opcional e só para Preview protegido: o backend envia `x-vercel-protection-bypass` apenas nas chamadas server-to-server. Nunca no browser.
- Token e segredo de webhook são **distintos por ambiente** (Preview ≠ Production), gerados com CSPRNG. Não são copiados entre ambientes.
- Migração `supabase_migration_comamor_integration.sql`: **estado da aplicação não verificado** nesta sessão (o MCP desta sessão não tem acesso ao Supabase do SeuBeat). A rota de autorização responde correctamente em produção, mas a outbox e `idempotency_key` só são exercidas no fluxo completo — confirmar na base antes de considerar a integração fechada.
- Configuração no servidor: `COMAMOR_INTEGRATION_ENABLED`, `COMAMOR_API_BASE_URL`, `COMAMOR_INTEGRATION_TOKEN`, `COMAMOR_VERCEL_PROTECTION_BYPASS` (Preview apenas), `SEUBEAT_WEBHOOK_SECRET`, `COMAMOR_AUDIO_ALLOWED_HOSTS`.
- Contrato e procedimento em `docs/comamor-integration.md`.
- Verificação em produção: `POST /api/v1/comamor/authorize` com UUID inexistente → `403 {"code":"not_authorized"}` (cadeia SeuBeat → ComAmor → RPC executada). Token inválido no lado ComAmor → `401 unauthorized`.

## Upsell SeuBeat no ComAmor — activo em produção
- Gate real: `config.seubeatAddonCheckoutEnabled` (`src/config.ts`), alimentado por `VITE_SEUBEAT_ADDON_CHECKOUT_ENABLED` e consumido em `PostPaymentOffers.tsx` (oferta pós-pagamento) e `AdminPage.tsx` (tab de pedidos).
- Em Production do ComAmor: `VITE_SEUBEAT_ADDON_CHECKOUT_ENABLED=true` e `VITE_SEUBEAT_SITE_URL=https://seubeat.vercel.app`. Ambos são inlined pelo Vite no build — mudar env exige redeploy.
- O default no código é `https://seubeat.onrender.com` (host legado). Sem `VITE_SEUBEAT_SITE_URL` definido, o link do upsell aponta para um host morto.

## CI — sem dívida pendente
- `.github/workflows/ci.yml` bloqueia lint, typecheck, testes, build, audit (high+) e E2E. Detalhe em `docs/ci-debt.md`.
- `npm run typecheck` (`tsc --noEmit`) está a 0. A causa dos 51→0 erros era `@types/express@5` a tipar um `express@4`.
- `npm run lint` está a **0 erros / 0 avisos** e o script usa `--max-warnings 0`: qualquer aviso novo falha o CI. Como foram limpos os 26 `exhaustive-deps` está em `docs/ci-debt.md` §1.
- E2E: 74 testes, 72 passam, 2 ignorados, ~4,4 min, com servidor real (`dist-server/server.js`).
- `npm audit --omit=dev` → 0 vulnerabilidades. A árvore de build/test tem 11 `high` sem patch publicado (`picomatch <=4.0.7`, GHSA-fc5q-39xc-vjpf) — ver `docs/ci-debt.md` §5.
- Dependabot (npm) agrupa por tipo de bump: `dev/prod-minor-patch` (passam CI, merge directo) e `dev/prod-major` (um PR por migração: `express@5`, `vite@8`, `eslint@10`, `supabase@3`). `github-actions` mantém um PR por acção. Ver `docs/ci-debt.md` §6.

## Pendências
- ComAmor: `SUPABASE_SERVICE_ROLE_KEY` existe só em Production e Preview (não em Development) — irrelevante para deploy, mas bloqueia `vercel dev` local.
- ComAmor: o último deploy de produção feito por CLI não ficou ligado a um commit (`source: cli`); o próximo push por git repõe a proveniência.
- ComAmor: `VITE_SUPABASE_URL` é a mesma em Production e Preview; não há staging isolado. Ensaio de migração tem de ser feito com cuidado.
- `auth_leaked_password_protection` no Supabase: passo manual (Dashboard → Authentication → Password Protection).
