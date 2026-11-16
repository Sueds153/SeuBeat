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
- Migração aditiva `supabase_migration_comamor_integration.sql` ainda não aplicada em base remota; não houve deploy nem mudança no ComAmor.
- Configuração no servidor: `COMAMOR_INTEGRATION_ENABLED`, `COMAMOR_API_BASE_URL`, `COMAMOR_INTEGRATION_TOKEN`, `SEUBEAT_WEBHOOK_SECRET`, `COMAMOR_AUDIO_ALLOWED_HOSTS`.
- Contrato e procedimento de staging em `docs/comamor-integration.md`.

## Validação desta branch
- Baseline antes da implementação: 504 testes passaram; 3 suites falharam por ausência de `@testing-library/jest-dom`, `@testing-library/react` e `@testing-library/user-event`.
- Esta branch adiciona as 3 bibliotecas, `@testing-library/dom` e as dependências que faltavam no botão (`@radix-ui/react-slot`, `class-variance-authority`). As três suites antes bloqueadas passaram (37 testes, 1 ignorado).
- Testes ComAmor: 24/24; E2E completo: 72 passaram, 2 ignorados (Chromium + Mobile Chrome); build passou também após actualizar dependências.
- Suite completa pós-dependências: 564 passaram, 1 ignorado e 1 timeout intermitente em `metaPixelCapi.test.ts`; essa suite passou isolada (13/13).
- ESLint 9 agora tem `eslint.config.js`; lint dos ficheiros ComAmor passou. Lint global expõe 130 erros e 27 avisos preexistentes noutros ficheiros, não corrigidos fora do escopo.
- `tsc --noEmit` continua com erros preexistentes em testes e rotas Express; nenhum diagnóstico ComAmor apareceu.

## Pendências
- Rever a migração em staging e sincronizar segredo HMAC, token e allowlist com o ComAmor antes de activar a flag.
- Credenciais ComAmor não estão configuradas no `.env`, shell ou GitHub Secrets. Manter a feature desactivada até configurar o endpoint/hosts e inserir token/HMAC no secret manager do serviço.
- Instalar/recuperar dependências de testes frontend e configuração ESLint para desbloquear as suites antigas.
- Não aplicar migração, fazer deploy ou merge sem revisão e autorização operacional.
