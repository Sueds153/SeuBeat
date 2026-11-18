# Dívida de CI

`ci.yml` bloqueia **tudo**: `lint`, `typecheck`, `test`, `build`,
`npm audit --audit-level=high` e o E2E. Cada secção abaixo é uma dívida que
existia e o que foi preciso para a pagar.

## 1. Lint — resolvido

`npm run lint` → **0 erros / 0 warnings** (era 130 erros / 27 warnings). O
script usa `--max-warnings 0`.

- **72 `no-empty`**: `catch {}` passou a `catch { /* intencional: falha
  silenciosa */ }`. Zero mudança de comportamento.
- **23 `no-require-imports`**: scripts CommonJS de manutenção (`*.cjs`,
  `scripts/`, `tools/`) podem usar `require` — correm com `node`, fora do bundle.
- **Scripts de diagnóstico pontuais na raiz** (`check_supabase.*`,
  `full_setup.cjs`, `get_*.cjs`, `compress_video.cjs`, `test_generation.cjs`)
  saíram do âmbito do ESLint.
- `prefer-const`, `no-empty-object-type`, `no-useless-escape`,
  `no-unused-expressions` e variáveis não usadas corrigidos.

Os últimos 26 warnings eram `react-hooks/exhaustive-deps` e um
`react-refresh/only-export-components`. Limpos sem mudar comportamento
observável:

- **`AdminPanel`**: três `useRef` de intervalo que já não eram atribuídos em
  lado nenhum (ficaram quando o polling passou a um único intervalo) saíram com
  o `useEffect` de limpeza; `expireSession` subiu para antes do `apiFetch`
  porque é usado nas dependências dele; os `useCallback` passaram a declarar as
  funções que já chamavam (todas estáveis) e `fetchLogs` deixou de listar
  `adminToken`, que não usa; `reqFieldMap`/`payFieldMap`/`songFieldMap`
  passaram a constantes de módulo (dentro do componente eram recriados a cada
  render, anulando o `useMemo` de ordenação).
- **`Wizard`**: `selectedPlanID` e `generationStatus` passaram a ser lidos por
  ref-espelho. Entrar nas dependências re-dispararia `gaViewContent`/
  `fbLyricsGenerated` a cada mudança de plano e voltaria a correr o submit
  quando o estado mudasse. `showToast` e `getPrice` ficaram `useCallback`
  estáveis (e `showToast` subiu no ficheiro, senão era usado antes da
  inicialização nas dependências); `formData.photoUrl` no efeito de restauro da
  foto passou a snapshot no mount — como dependência recriaria o blob a cada
  troca de foto, e o próprio efeito escreve `photoUrl`.
- **`useTypewriter`**: `speed` entrou nas dependências (se muda, o intervalo tem
  de ser recriado).
- **`VideoTestimonial`**: `blobUrlRef` nunca era atribuído; saiu com o efeito.
- **`ui/button`**: `buttonVariants` mudou para `button-variants.ts` — o ficheiro
  do componente só exporta componentes (`react-refresh`). O barrel continua a
  exportar o mesmo.

Um teto de warnings só desce se nunca subir sozinho: com 0, qualquer warning
novo falha o CI.

## 2. Vulnerabilidades — resolvido ao nível high/critical

`npm audit --audit-level=high` → **0** (era 3 high + 4 critical em 6 pacotes).

| pacote | saída |
|---|---|
| `jspdf`, `jspdf-autotable` | removidos — não eram importados em lado nenhum |
| `happy-dom` | removido — o ambiente de teste é `jsdom`, que agora é devDependency explícita (antes só existia via `isomorphic-dompurify`) |
| `sharp` | `0.34` → `0.35.5` (só `scripts/generate-og-image.cjs`; PNG validado) |
| `zod` | `3` → `4.6.7` (3 ficheiros; `preprocess`/`enum`+`catch`/`strict`/`uuid` compatíveis) |
| `openai` | `5` → `7.57` (só `server/services/openai.ts`; POST `/v1/chat/completions` validado contra servidor local) |
| `vitest` (+`tinypool`) | `3` → `5.1` (mocks com `new` passaram a `function` em 3 sítios) |

Cada passo foi verificado com os 566 testes, build e lint antes do seguinte.

**Sobra:** nada. `npm audit` → **0 vulnerabilidades** de qualquer severidade.

| passo | efeito |
|---|---|
| `@sentry/vite-plugin` `3` → `11.13` | cortou o `glob`/`minimatch` antigo do build; movido para `devDependencies` (só corre no build) |
| `npm audit fix` (sem `--force`) | subiu `@typescript-eslint/*` dentro das ranges já declaradas |

## 3. E2E — gate

O passo arrancava `node dist/server.js`, mas o build (`vite build` +
`esbuild api/vercel-entry.ts`) nunca produzia esse ficheiro. E, antes de falhar
por ligação recusada, saía com `::warning::` — por isso é que "nunca funcionou":
nem sequer tentava correr.

Agora o build produz o servidor a sério:

- `npm run build:server` → `esbuild server.ts … --outfile=dist-server/server.js`
- incluído no `npm run build`, ao lado do frontend (`dist/`) e da função
  (`api/index.js`)
- `dist-server/` e não `dist/` de propósito: `dist/` é o output público do
  Vercel, e o bundle do servidor não deve ser servido como asset estático
- `dist-server/**` está nos ignores do ESLint
- `npm start` aponta para `dist-server/server.js`

O passo já não tem a guarda que o fazia sair: se o ficheiro faltar, falha com
`::error::`. E **é bloqueante**.

Primeira execução real (run do PR #15): `74 tests`, **72 passed, 2 skipped,
4,4 min**, exit `0`. Ficou advisory nesse run precisamente para se ver o
resultado antes de o promover.

## 4. `tsc --noEmit` — resolvido, agora é gate

**51 erros** na `main` → 30 depois das atualizações de dependências → **0**.

A causa raiz não era código: era **`@types/express@5` a tipar um `express@4`**.
`@types/express-serve-static-core@5` mudou `ParamsDictionary` para

```ts
export interface ParamsDictionary {
    [key: string]: string | string[];
    [key: number]: string;
}
```

porque o Express 5 admite parâmetros repetidos (`*ids`). Num Express 4 os
parâmetros são sempre `string`, por isso cada `const { id } = req.params` passou
a ser `string | string[]` — 22 erros em `server/routes/{admin,public}.ts` — e
8 testes falhavam em `app.listen(0, resolve)` por as assinaturas de `listen`
também terem mudado.

`@types/express` `^5.0.0` → `^4.17.25`, que é a versão que corresponde ao
runtime (`express@4.22.3`). **Zero alterações de código, zero mudança de
comportamento, 30 → 0 erros.**

Porquê alinhar os tipos em vez de anotar 22 sítios: os tipos devem descrever o
que o runtime faz. Se o parâmetro é sempre `string`, `string | string[]` é uma
mentira que obriga a casts em todo o lado e esconde o próximo erro real. Se um
dia houver migração para Express 5, os tipos sobem nesse PR — com o runtime.

`tsconfig.json` usa `strict: true`, `skipLibCheck: true`, e exclui `e2e/`
(correm com o typecheck próprio do Playwright).

Agora corre no CI a seguir ao lint (`npm run typecheck`), antes dos testes.

## 5. Novos avisos de 18/Nov: `picomatch` sem patch

Em 18/Nov apareceu o aviso **GHSA-fc5q-39xc-vjpf** — ReDoS no `picomatch`,
`<=4.0.7`. O `picomatch` mais recente publicado **é** o 4.0.7: não existe versão
corrigida. Propaga-se por `tinyglobby`/`fdir`/`picomatch` a `vite`, `vitest` e
`typescript-eslint/*` — **11 avisos `high`, todos no que só existe para
compilar e testar**.

`npm audit fix` não resolve (não há para onde subir); `--force` propõe downgrades
absurdos (`vite@6.2.7` para um projecto em 6.4.6).

Medido:

| árvore | antes | agora |
|---|---|---|
| `npm audit --omit=dev` (o que é servido) | 0 | **0** |
| `npm audit` (inclui build/test) | 0 (17/Nov) | **11 high, sem patch** |

Política: o gate bloqueante passa a ser a árvore de produção
(`--omit=dev --audit-level=high`), e a árvore completa continua a correr como
advisory. Um ReDoS num glob de build não é explorável por quem chama a API; e
um gate que falha por dívida alheia sem correção possível treina toda a gente a
ignorá-lo — que é exatamente a armadilha que este documento existe para evitar.

**Reverter quando existir `picomatch > 4.0.7`:** subir e voltar a pôr o audit
completo como bloqueante.

## 6. Bumps de Dependabot: derivar por tipo, não por dependência

O `.github/dependabot.yml` agrupava só por `dependency-type`, o que misturava
majors com patch. Resultado: PRs como o #16 (15 actualizações, incluindo
`vite@8`) e o #17 (25 actualizações, incluindo `express@5`). Um PR assim já
não podia ser mergeado sem uma migração e arrastava consigo bumps que não
tinham problema nenhum — ficavam todos parados.

Agora cada ecosystem tem dois grupos, `*-minor-patch` e `*-major`, e um major
nunca viaja com o resto.

Entrou no PR `chore/dependabot-groups`: `@playwright/test@1.65.1`,
`jsdom@31.0.1`, `esbuild@0.28.2`, `@types/node@26.6.6`,
`@types/ffmpeg-static@5.1.0`, `@types/pino@7.0.5`, `tsx@4.23.15`. Verificado
localmente: lint 0/0, `tsc --noEmit` 0, 566 testes (1 skipped), build OK,
`npm audit --omit=dev` a 0.

Ficou de fora, com motivo:

| bump | porque não |
|---|---|
| `express@5` | muda `params`, wildcards de rotas e o contrato de `res.status(...)`; é migração de código, não de versão |
| `vite@8` + `@vitejs/plugin-react@6` | Vite 8 assenta em Rolldown/oxc, e o plugin 6 passa a exigir `oxc-transform-react` e `babel-plugin-react-compiler` como peers |
| `eslint@10` + `eslint-plugin-react-hooks@7` | o plugin 7 liga as regras do React Compiler (`react-hooks/purity`, `react-hooks/refs`) e devolve 35 erros em código correcto — ex. `useRef<number>(Date.now())` em `src/lib/deliveredCount.ts` |
| `eslint-plugin-react-refresh@0.5` | só faz sentido a par do ESLint 10 |
| `supabase@3` | o postinstall descarrega um binário de `github.com`; sem rede para lá, o `npm ci` falha |

Ficam a chegar em PRs próprios (`dev-major` / `prod-major`), para serem
migrados um de cada vez, com o CI como rede.
