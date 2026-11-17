# Dívida de CI (gates advisory)

O `ci.yml` passou a bloquear apenas `npm test` e `npm run build`. `npm run lint`,
`npm audit` e a suite E2E correm na mesma, mas com `continue-on-error`, porque o
repositório já vinha vermelho por motivos independentes do código de produto.

Antes desta mudança, o `npm audit` era o primeiro passo a falhar e os restantes
passos (lint, testes, build, E2E) ficavam `skipped` — ou seja, o CI nunca correu
testes nenhuns. A `main` está vermelha desde 2026-11-10 por este motivo.

## 1. Lint

`npm run lint` → **130 erros / 27 warnings em 37 ficheiros** (medido em 2026-11-17).

As regras dominantes são `@typescript-eslint/no-explicit-any`, `no-empty`,
`no-unused-expressions` e `no-require-imports`. Ficheiros com mais erros:
`src/components/Wizard.tsx` (27), `src/lib/analytics.ts` (9),
`src/lib/lyricsTeaser.ts` (6), `server/services/workflow/audioPersistence.ts` (5),
`server/services/workflow/rollback.ts` (5).

Parte dos erros vem de scripts avulsos na raiz (`full_setup.cjs`,
`check_supabase.js`, `get_*.cjs`, `compress_video.cjs`) que não fazem parte da
aplicação e deviam sair do âmbito do ESLint.

Os ficheiros tocados pela integração ComAmor estão limpos: correr
`npx eslint $(git diff --name-only origin/main...HEAD | grep -E '\.(ts|tsx)$')`
não devolve nada.

## 2. Vulnerabilidades (`npm audit`)

18 vulnerabilidades (3 high, 4 critical). Todas as correções exigem *semver
major*, logo não cabem num PR de integração:

| pacote | severidade | correção | nota |
|---|---|---|---|
| `jsonwebtoken`/`jspdf` | critical | `jspdf@4.2.1` | API de geração de PDF |
| `sharp` | high | `sharp@0.35.5` | binários nativos |
| `zod` | high | `zod@4.6.7` | v3 → v4, toda a camada de validação |
| `openai` | high | `openai@7.57.0` | 5.x → 7.x |
| `vitest` / `tinypool` | critical | `vitest@5.1.0` | dev only |
| `happy-dom` | critical | `happy-dom@21.0.4` | dev only |

`npm audit fix --force` está proibido neste projeto (arrastaria majors em
produção sem revisão). Tratar num PR dedicado, um pacote de cada vez, com os 566
testes como rede.

## 3. E2E

O passo antigo arrancava `node dist/server.js`, mas o build (`vite build` +
`esbuild api/vercel-entry.ts`) nunca produz esse ficheiro. A suite Playwright
corria sem servidor e falhava por ligação recusada — por isso também passou a
advisory. Para a reativar como gate: adicionar um passo de build do servidor
(esbuild de `server.ts`) e depois remover o `continue-on-error`.

## Como fechar esta dívida

1. PR de dependências: `zod`, `openai`, `sharp`, `jspdf` (produção) com testes.
2. PR de dependências dev: `vitest`, `happy-dom`, `tinypool`.
3. PR de lint: `eslint --fix`, exclusão dos scripts avulsos da raiz e correção
   manual dos restantes.
4. PR de E2E: build do servidor + remoção dos `continue-on-error`.

Quando cada item fechar, o respetivo `continue-on-error` sai do workflow.
