# SeuBeat — Estado Atual

Atualizado em 16/Nov/2026. Snapshot operacional; o histórico detalhado está no Git.

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

## Mudança desta branch: integração ComAmor
- Branch isolada `codex/comamor-integration`, baseada no commit limpo `2af7449`.
- Integração aditiva em `/api/v1/comamor`, desligada por omissão (`COMAMOR_INTEGRATION_ENABLED=false`).
- A referência `comamor_order` não autoriza: o servidor valida com ComAmor antes de mostrar o formulário, criar job ou consultar resultado.
- Reserva de job usa `idempotency_key` do ComAmor e função transaccional; o retry com o mesmo texto recupera o mesmo job.
- Conteúdo fornecido pelo organizador é guardado na tabela normal de pedidos; nenhum dado ou mídia familiar é importado.
- Callback assinado por HMAC vai por outbox durável, com retry, timestamp e supressão de tentativas antigas.
- Áudio só é devolvido em HTTPS e host exacto incluído no allowlist.
- Suporte a preview Vercel protegido: `COMAMOR_VERCEL_PROTECTION_BYPASS` é opcional e o backend envia `x-vercel-protection-bypass` apenas nas chamadas server-to-server de autorização e callback. Configurar somente no ambiente Preview do SeuBeat, nunca no browser ou em Production. A flag continua desligada até migração e segredos de staging verificados.
- Migração aditiva `supabase_migration_comamor_integration.sql` ainda não aplicada em base remota; não houve deploy nem mudança no ComAmor.
- Configuração no servidor: `COMAMOR_INTEGRATION_ENABLED`, `COMAMOR_API_BASE_URL`, `COMAMOR_INTEGRATION_TOKEN`, `COMAMOR_VERCEL_PROTECTION_BYPASS` (Preview apenas), `SEUBEAT_WEBHOOK_SECRET`, `COMAMOR_AUDIO_ALLOWED_HOSTS`.
- Contrato e procedimento de staging em `docs/comamor-integration.md`.

## Validação desta branch
- Baseline antes da implementação: 504 testes passaram; 3 suites falharam por ausência de `@testing-library/jest-dom`, `@testing-library/react` e `@testing-library/user-event`.
- Esta branch adiciona as 3 bibliotecas, `@testing-library/dom` e as dependências que faltavam no botão (`@radix-ui/react-slot`, `class-variance-authority`). As três suites antes bloqueadas passaram (37 testes, 1 ignorado).
- Testes ComAmor: 24/24; E2E completo: 72 passaram, 2 ignorados (Chromium + Mobile Chrome); build passou também após actualizar dependências.
- Suite completa pós-dependências: 564 passaram, 1 ignorado e 1 timeout intermitente em `metaPixelCapi.test.ts`; essa suite passou isolada (13/13).
- ESLint 9 agora tem `eslint.config.js`; lint dos ficheiros ComAmor passou. Lint global expõe 130 erros e 27 avisos preexistentes noutros ficheiros, não corrigidos fora do escopo.
- `tsc --noEmit` continua com erros preexistentes em testes e rotas Express; nenhum diagnóstico ComAmor apareceu.
- Cliente ComAmor com header de bypass condicional: 10 testes específicos passaram; 25 testes ComAmor, lint dos ficheiros alterados e build passaram após `npm ci`.
- `npm audit fix` sem `--force` actualizou apenas versões compatíveis e reduziu 27 para 22 avisos. O gate `npm audit --audit-level=high` continua bloqueado por vulnerabilidades alta/críticas que exigem upgrades major; não foram ignoradas nem forçadas.

## Pendências
- A Vercel mostra a mesma `VITE_SUPABASE_URL` associada a Production e Preview do ComAmor; o Preview não está isolado numa base staging. Confirmar/criar staging antes de aplicar migração ComAmor ou fazer ensaio.
- Ainda falta gerar o Protection Bypass do ComAmor e configurá-lo no ambiente Preview do SeuBeat; manter as flags desligadas até migração e todos os segredos de staging verificados.
- A sessão só tem acesso Vercel à equipa do ComAmor e o Supabase ligado corresponde ao projecto ComAmor; não foi possível configurar a Preview nem aplicar a migration no Supabase do SeuBeat. Não consultar ou alterar mais recursos ComAmor via estas credenciais.
- Credenciais ComAmor não estão configuradas no `.env`, shell ou GitHub Secrets. Manter a feature desactivada até configurar o endpoint/hosts e inserir token/HMAC no secret manager do serviço.
- Instalar/recuperar dependências de testes frontend e configuração ESLint para desbloquear as suites antigas.
- Não aplicar migração, fazer deploy ou merge sem revisão e autorização operacional.
