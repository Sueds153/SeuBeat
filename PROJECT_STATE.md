# SeuBeat — Estado do Projeto (atualizado a cada sessão)

## Estado Atual (31/Ago 2026)

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
- **Último deploy**: commit `31f00fd` (payment proof upload via FormData)
- **Testes**: 372 passam (32 ficheiros), `tsc --noEmit` limpo

### DB Schema (tabelas principais)
- `song_requests` — pedido do cliente (status, dados wizard)
- `songs` — música gerada (audio_url, audio_url_v2, mureka_status, mureka_task_id)
- `payments` — pagamentos (status, proof_url, payment_method)
- `users` — clientes (email, phone, name)
- `email_events` — tracking de emails
- `whatsapp_send_log` — log de envios WhatsApp
- `admin_audit_log` — audit log admin

### Admin Panel Tabs
1. **Pedidos** — lista de song_requests com filtros ✅ funcional
2. **Pagamentos** — lista de payments com aprovação/rejeição ✅ funcional
3. **Músicas** — lista de songs (515 not_started = esperando pagamento, by design) ✅ funcional
4. **Clientes** — lista de users ✅ funcional
5. **Abandonados** — leads sem pagamento, filtros por tempo ✅ funcional
6. **Créditos** — créditos Suno/IA ✅ funcional
7. **Métricas** — KPIs funil ✅ funcional
8. **Lucratividade** — receita/custos ✅ funcional
9. **Meta Ads** — configuração de campanhas ✅ funcional
10. **WhatsApp** — estado de envios ✅ funcional

### Bugs Corrigidos Hoje (31/Ago)
1. Undo route retornava sucesso mesmo com erro na DB → fix: `if (undoError)` return 500
2. Undo force_status sem tratamento de erros → fix: error checking em todos os caminhos
3. force-voice `.maybeSingle().then()` engolia erros → fix: log de erros
4. `handleForceStatus`/`handleUpdateStyle` sem `apiHeaders` no deps array → fix adicionado
5. Approve flow sem guard `voice_processing` → fix adicionado
6. Pagamento comprovativo: payload base64+JSON (~13MB) causava timeout no Render → fix: multer + FormData (binário, 25% menor), AbortController 90s, backward-compat JSON para testes
7. **Aprovação Premium ficava "processing"** — `admin.ts:418`: `hasGeneratedAudio && !hasVoiceSample` bloqueava entrega Premium com voz clonada. Fix: `hasGeneratedAudio` (remove `!hasVoiceSample`), agora Premium com áudio existente entrega direta
8. **Guard errado no workflow Suno** — `admin.ts:522`: `.eq('status', 'approved')` mas status era `payment_submitted` → update silencioso 0 rows. Fix: `.eq('status', 'payment_submitted')`
9. **isProcessing sem completed** — `admin.ts:501`: `mureka_status === 'completed'` não estava na lista,permitia workflow redundante. Fix: adicionado `completed`
10. **Comprovativos não apareciam** — `admin.ts proof-url`: retornava URL R2 diretamente (pode ser privado). Fix: prioriza URL assinada quando `proof_path` existe, fallback URL HTTP

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
