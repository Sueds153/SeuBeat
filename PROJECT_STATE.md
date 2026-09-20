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
- **Último deploy**: commit `ea98b7d` (undo limpa AI verification)
- **Testes**: 419 passam (34 ficheiros), `tsc --noEmit` limpo

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

### Pendências Conhecidas
- `auth_leaked_password_protection` — ativar manualmente no Dashboard Supabase
- Paginação no endpoint `/requests` (retorna todos sem limit)
- Response shapes inconsistentes no admin (alguns sem `success` field)
- Admin IP restriction opcional (via `ADMIN_ALLOWED_IPS`)
- WhatsApp verificação formal impossível para +244 (limitação Meta error 136024)
- Pagamentos antigos com `verification_result` = NULL (re-analisar manualmente)
- Re-analyze não atualiza `ai_verified` (inconsistência menor)

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
