# SeuBeat — Estado do Projeto (atualizado a cada sessão)

## Estado Atual (20/Set 2026)

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
- **MCP Servers**: Supabase + Jina AI (busca web, embeddings, leitura de URLs)

### Produção
- **URL**: https://seubeat.onrender.com
- **Último deploy**: commit `7282f09` (plan_type/amount_kz fix + debug cleanup)
- **Testes**: 399 passam (33 ficheiros), `tsc --noEmit` limpo

### DB Schema (tabelas principais)
- `song_requests` — pedido do cliente (status, dados wizard)
- `songs` — música gerada (audio_url, audio_url_v2, mureka_status, mureka_task_id)
- `payments` — pagamentos (status, proof_url, payment_method, verification_result, ai_verified)
- `users` — clientes (email, phone, name)
- `email_events` — tracking de emails
- `whatsapp_send_log` — log de envios WhatsApp
- `admin_audit_log` — audit log admin

### Admin Panel Tabs
1. **Pedidos** — lista de song_requests com filtros ✅ funcional
2. **Pagamentos** — lista de payments com aprovação/rejeição + verificação AI ✅ funcional
3. **Músicas** — lista de songs (515 not_started = esperando pagamento, by design) ✅ funcional
4. **Clientes** — lista de users ✅ funcional
5. **Abandonados** — leads sem pagamento, filtros por tempo ✅ funcional
6. **Créditos** — créditos Suno/IA ✅ funcional
7. **Métricas** — KPIs funil ✅ funcional
8. **Lucratividade** — receita/custos ✅ funcional
9. **Meta Ads** — configuração de campanhas ✅ funcional
10. **WhatsApp** — estado de envios ✅ funcional

### Bugs Corrigidos Hoje (20/Set)
1. **SUPABASE_URL em falta no Render** — variável `SUPABASE_URL` não existia no Render (só `VITE_SUPABASE_URL`). O admin client Supabase não conseguia inicializar corretamente, causando falhas silenciosas em queries. Fix: adicionar `SUPABASE_URL` e `SUPABASE_ANON_KEY` via Render API + redeploy.
2. **NOT NULL violation em payments (23502)** — PostgREST schema cache tem colunas `plan_type` e `amount_kz` que são NOT NULL mas o código não as enviava no INSERT. Fix: adicionar `plan_type: plan` e `amount_kz: parsedAmount` em ambos os paths (`submit-payment` e `video-upsell`).
3. **3 pedidos stuck em `payment_submitted`** — clientes que submeteram pagamento quando `SUPABASE_URL` não existia ficaram com status alterado mas sem registo de pagamento. Fix: reverter manualmente para `lyrics_ready` para poderem re-submeter.
4. **E2E test confirmado** — fluxo completo criado: user → song_request → submit-payment → AI verification → payment gravado na DB. Funcionou com status 200, decision `manual_review` (esperado com imagem fake).

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

### Pendências Conhecidas
- `auth_leaked_password_protection` — ativar manualmente no Dashboard Supabase
- Paginação no endpoint `/requests` (retorna todos sem limit)
- Response shapes inconsistentes no admin (alguns sem `success` field)
- Admin IP restriction opcional (via `ADMIN_ALLOWED_IPS`)

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
