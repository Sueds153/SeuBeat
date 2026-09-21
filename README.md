# SeuBeat — Canções Personalizadas

Plataforma de geração de músicas personalizadas para Angola. O cliente preenche um Wizard (5 passos), a IA gera a letra, o Suno AI compõe a música, e o cliente recebe a dedicatória completa.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS + TypeScript
- **Backend**: Express + TypeScript (esbuild bundle)
- **Base de Dados**: Supabase (PostgreSQL)
- **Armazenamento**: Cloudflare R2 (áudio, comprovativos, voz) + Supabase Storage (fallback)
- **Geração de Letras**: DeepSeek → Gemini → OpenAI → Claude (fallback automático)
- **Geração de Música**: Suno API (api.sunoapi.org)
- **Email**: Brevo (REST API)
- **WhatsApp**: Meta WhatsApp Business Cloud API
- **Pagamentos**: Multicaixa Express + Referência
- **Monitorização**: Sentry
- **CI/CD**: GitHub Actions + Render (auto-deploy)

## Pré-requisitos

- Node.js 22+
- npm

## Configuração

1. Instalar dependências:
   ```bash
   npm install
   ```

2. Copiar `.env.example` para `.env` e preencher as variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```

3. Variáveis obrigatórias:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SUNO_API_KEY`
   - `BREVO_API_KEY`
   - `ADMIN_PASSWORD`, `JWT_SECRET`
   - Pelo menos uma chave de IA: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, ou `ANTHROPIC_API_KEY`

## Desenvolvimento

```bash
npm run dev          # Inicia o servidor com hot-reload (Vite middleware)
```

## Build & Produção

```bash
npm run build        # Vite build (frontend) + esbuild (server bundle)
npm start            # Inicia o server bundle em dist/server.js
```

## Testes

```bash
npm test             # Vitest — 419 testes unitários (~40s)
npm run test:watch   # Watch mode
npm run test:e2e     # Playwright E2E (13 testes)
npm run lint         # tsc --noEmit (type-checking)
```

## Estrutura do Projecto

```
├── server.ts                  # Entry point — Sentry init, schedulers, graceful shutdown
├── server/
│   ├── config/                # env.ts (validação), app.ts (Express setup + /health)
│   ├── middleware/             # security.ts, auth.ts, rateLimiter.ts, csrf.ts
│   ├── routes/
│   │   ├── admin.ts           # ~2400 linhas — painel admin (25+ endpoints)
│   │   ├── public.ts          # ~2200 linhas — wizard, pagamento, dedicatória
│   │   └── webhook.ts         # Brevo + WhatsApp delivery webhooks
│   ├── services/
│   │   ├── email/             # 11 módulos — Brevo templates + envio
│   │   ├── whatsapp/          # 10 módulos — Cloud API, bulk, abandoned, delivery
│   │   ├── workflow/          # 6 módulos — Suno orchestration, voice cloning, rollback
│   │   ├── ai.ts              # Orquestrador DeepSeek→Gemini→OpenAI→Claude
│   │   ├── suno.ts            # API Suno — tasks, polling, retry
│   │   ├── storage.ts         # R2 + Supabase Storage (com fallback)
│   │   └── ...                # audio, prompts, proofVerification, etc.
│   ├── utils/                 # logger.ts (pino), helpers.ts, audit.ts
│   └── __tests__/             # 34 ficheiros de teste
├── src/                       # Frontend React
│   ├── components/
│   │   ├── Wizard.tsx         # Wizard principal (5 passos)
│   │   ├── WizardSteps.tsx    # Sub-componentes do wizard
│   │   ├── AdminPanel.tsx     # Painel admin completo
│   │   └── ...
│   ├── lib/
│   │   ├── validation.ts      # Zod schemas (frontend)
│   │   └── uuid.ts            # safeUUID() com fallback
│   └── api/                   # API layer (song.ts, lyrics.ts, payment.ts)
├── e2e/                       # Playwright tests
└── supabase_migration_*.sql   # Migrações SQL aplicadas em produção
```

## Deploy

O Render faz auto-deploy a cada push no `main`. O pipeline CI corre:
1. `npm ci`
2. `npm audit --audit-level=high`
3. `npm run lint` (tsc --noEmit)
4. `npm test` (419 testes)
5. `npm run build`
6. E2E tests (Playwright)

## Variáveis de Ambiente

Ver `.env.example` para a lista completa. As variáveis sensíveis (`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `JWT_SECRET`, `SUNO_API_KEY`) devem ser configuradas no Render Dashboard (Environment Variables), nunca no `.env` do repositório.

## Licença

Privado — SeuBeat © 2026
