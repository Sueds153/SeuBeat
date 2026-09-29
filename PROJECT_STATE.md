# SeuBeat — Estado do Projeto (atualizado a cada sessão)

## Estado Atual (28/Set 2026)

### Tier 2 implementado + verificação browser mobile-first + E2E (28/Set 2026, sessão 8)
Utilizador aprovou: "Implementar tier 2, verificar no browser (mobile-first) e correr testes E2E". Tudo executado e verde:
- **Transições direcionais no wizard**: `stepDirection` state ('forward'/'back') setado em `handleNext`/`handleBack`; passo anima de `x:±28` na direção certa (Avançar entra da direita, Retroceder da esquerda), 0.28s easeOut; `useReducedMotion` → só fade. Descoberta: o wizard JÁ tinha `AnimatePresence mode="wait"` com slide fixo (não direcional) — foi direcionalizado, não criado de raiz.
- **Sticky CTA mobile com saída animada**: envolvido em `AnimatePresence` (antes pop abrupto ao desaparecer); entra com spring (y:80→0 + opacity), sai com y:80; reduced-motion → só opacity. **Histerese no scroll**: entra a >0.7vh, sai a <0.5vh (zona morta evita flicker/exit-repeated no threshold — handler `setShowStickyBar(prev => ...)`).
- **Auditoria visual browser (novo `e2e/visual-audit.spec.ts`, project mobile-chrome)**: valida via `page.evaluate` — shine CSS aplicado no CTA (`animationName: cta-shine`, 4.2s), reveals com opacity>0.9 pós-scroll, sticky aparece a 80% da página e **some no topo** (exit funciona), transform a meio da transição do wizard capturado (`matrix(1,0,0,1,-23.4,0)` = passo a sair), **0 console errors** nas 2 páginas (filtro de ruído FB/GA/Sentry). 8 screenshots em `test-results/visual-audit/` (01-hero … 08-wizard-back).
- **Validação completa**: `tsc --noEmit` ✓ · **535 testes unit** ✓ · **64/64 E2E** (chromium+mobile-chrome, 7.1m, `E2E_PORT=3100`) ✓ · audit visual 2/2 ✓.
- Nota: `npm run dev` arranca com `tsx server.ts` (PORT env respeitado em `ENV.PORT` → `app.listen(ENV.PORT)`); webServer do Playwright usa `E2E_PORT`.

### Animações Tier 1 de conversão na landing (28/Set 2026, sessão 7)
Plano de especialista proposto (Tier 1/2 + anti-padrões) — utilizador aprovou "Tier 1 (recomendado)". Descoberta: os cards "Como Funciona" e de Pricing **já tinham `whileInView` mas no-op** (`initial === whileInView`, infra desligada) — reativada com reveal real:
- **Scroll-reveal com stagger**: helper `revealInitial/revealInView/revealTransition(delay)` no `LandingPage.tsx` (fade + rise 24px, 0.55s easeOut, `once: true`, margin -40/-50px); aplicado aos headers das 3 secções (via novo componente `Reveal`), cards Como Funciona (stagger 0.1s), cards de Pricing (0.12s), grid de Ocasiões (0.06s/card, wrapper `motion.div` + `w-full` no botão para não partir o grid) e showcase "Transformação em Tempo Real".
- **Count-up no `deliveredTotal`**: novo `useInViewCount<T>` (rAF + IntersectionObserver + easeOutCubic 1.2s) — o número principal do hero já tinha count-up próprio (mantido); agora ambos os números "assentam" a contar.
- **Shine sweep no CTA primário** ("Criar Minha Música" do hero): keyframe `cta-shine` em `index.css` — pseudo-elemento com `translateX+skew`, **só transform** (compositável, zero repaint), ciclo 4.2s (86% em repouso), classe `.cta-shine` no botão.
- **`prefers-reduced-motion` respeitado em tudo**: reveals e shine desativados (`useReducedMotion` do motion/react + media query CSS).
- **Fora de scope (proposto, não implementado)**: Tier 2 (transições direcionais no wizard, sticky CTA mobile já existe parcialmente) — disponível para próxima sessão. Anti-padrões evitados: parallax/tilt 3D (tráfego FB in-app Android low-end), animação de box-shadow.
- Validação: `tsc --noEmit` ✓ + **535 testes** ✓ + `npm run build` ✓.

### Desemoji-ficação da UI e emails — visual de "especialista" (28/Set 2026, sessão 6)
Remoção de todos os emojis visíveis ao cliente (queixa: "site parece criado por IA") — substituídos por ícones lucide-react (já padrão do projeto, 23 ficheiros) e glifos tipográficos de marca:
- **UI (13 emojis → ícones lucide)**: LandingPage (🥀→`Leaf`, 🎵→`Music2`, ✓→`Check`, ✨ removido), Wizard (⚡→`ZapIcon` ×2, ❤️→`HeartSolidIcon`, 🎵→`MusicIcon`), SongShare (🆔/❤️ removidos de textos de partilha), PersonalizedSongPage (🎵→`Music`), AdminPanel (🎬→`Film` ×2).
- **Emails (35+ emojis → glifo tipográfico)**: todos os subjects limpos com sufixo "— SeuBeat" (ex.: "A música para Maria está pronta — SeuBeat"); cabeçalhos emoji de 32px → **glifo `♪` monocrómático em Georgia** (consistente com o `♪` já usado na landing); botões sem emojis ("🎧 Ouvir"→"Ouvir"); `▶` evitado (variante emoji em alguns clientes) → `►`; `✦` mantido (tipográfico puro).
- **Intocados de propósito**: `whatsappTemplates.ts` e `abandonedMessages.ts` (corpos têm de coincidir com templates Meta aprovados; emojis são o vernáculo do WhatsApp); `LandingPage:543` (♪ decorativo já existente).
- **Regra de design estabelecida**: em emails usar apenas caracteres com apresentação tipográfica garantida (`♪` U+266A, `►` U+25BA, `✦` U+2726) — nunca emoji-presentation (🎵, ▶ U+25B6, ⚠️).
- Nenhum teste/asserção dependia dos emojis ou subjects antigos. Validação: `tsc --noEmit` ✓ + **534/536 testes** (1 timeout flaky de hook em `metaPixelCapi.test.ts` — passa isolado 13/13, não relacionado).

### Consistência da copy de aprovação — "automática em segundos" (28/Set 2026, sessão 5)
Framing de aprovação do cliente unificado (era "manual/até 24h" — falsidade: o auto-approve AI existe e a aprovação real tem mediana 2h):
- **Wizard checklist**: "Confirmação manual até 24h" → **"Aprovação automática em segundos"** (sem emojis, a pedido).
- **Ecrã COMPROVATIVO RECEBIDO**: título "Aguardando confirmação" → "Aguardando aprovação"; corpo sem "pela nossa equipa" → "A verificação do comprovativo é automática e demora apenas segundos…".
- **Fallbacks de rejeição** (2 blocos): "não foi aceite pela nossa equipa" → "não foi aprovado" (auto-reject existe).
- **Terms §5**: "aprovação é manual até 24h úteis" → "verificação automática, maioria em segundos; revisão manual só quando necessário (até 24h úteis)".
- **Intocados de propósito**: promessas de ENTREGA 24h (Terms:55, `deliveryEta`, Express imediata), fallback de AI-em-baixo (`helpers.ts:116`, honesto), templates WhatsApp Meta (copy aprovada pela Meta), AdminPanel interno.
- Dados: auto-approve `confidence ≥0.85` (`proofVerification.ts`) · aprovação real 45d n=40: mediana 121min, média 370min · nenhum teste dependia dos textos antigos. Validação: `tsc --noEmit` + **535 testes** ✓.

### Landing CRO — números reais + selos Multicaixa (28/Set 2026, sessão 4)
Avaliação persuasão/animações da landing (7.5/10); fixes aprovados pelo utilizador ("Gostei apenas do fix 5 e sobre os numeros ficticios quero que seja numeros não arrendondados"):
- **Números reais não arredondados** (nada de "+200 entregues"/"60%"/"4.9★"): `/api/social-proof` ganha **`expressTotal`** (pagamentos `approved` com `plan='express'`) para quota real do Express; micro-stats do hero mostram só o que existe: `+N criadas hoje` (fallback `paidTotal` com label "músicas criadas" — nunca "+0"), `deliveredTotal entregues por email e WhatsApp` (omisso se 0), `100% personalizado`; quota Express no card de pricing = "`expressTotal` de `paidTotal` clientes escolheram esta opção" (ex.: "34 de 57"; omisso se 0); CTA final troca "9 em cada 10 choram" por "`paidTotal` pessoas já confiaram…" (fallback genérico honesto se 0).
- **Selos Multicaixa** abaixo dos 3 cards de pricing: ⚡ Multicaixa Express · 🎟 Referência Multicaixa · 🛡 "Só pagas depois de aprovar a letra" (ícones `Zap`/`Ticket`/`Shield`).
- **Limpeza**: "60%" estático removido de `pricing.ts` (`popularity` agora preenchido em runtime); `4.9★ (+200 entregues)` removido.
- **Suite: 535 testes** (39 ficheiros, 1 skipped) · `tsc --noEmit`/lint OK. Sem commit (aguarda pedido).

### Fase 1+2 — Recuperação + Checkout CRO (28/Set 2026, sessão 3)
Plano aprovado "Prioridades 1 + 2" executado na íntegra (instrução: *"Avance. não quebre o site porque ela está em produção e teste tudo"*). **Validação final: 535 testes unit (39 ficheiros, 1 skipped) + 64/64 E2E (chromium+mobile-chrome) + `tsc --noEmit`/lint + `npm run build` — TUDO VERDE. Sem commit (aguarda pedido do utilizador).**
- **1a WhatsApp delivery**: `sanitizeTemplateParam` (\r\n\t→espaço) nos params dos templates; `countFailedAttempts`/`hasBucketLog` (últimas 24h) → **máx 3 tentativas/dia** por pedido+bucket; skip "sem telefone" loga 1× (antes: 891 spam); cap diário → `return 'failed'` silencioso; `normalizePhoneToE164` (strip `00`, `09…`→strip `0`); `.env` `WHATSAPP_ENABLED_BUCKETS=30min,24h,48h,72h`.
- **1b auto-reject**: `paymentFields.notes` = motivo PT dos `proofVerification.checks` falhados; pedido passa a `payment_rejected` (antes: preso em `payment_submitted`); cliente notificado por **email + WhatsApp** com o motivo.
- **1c lembrete de rejeição 24h**: `sendRejectedReminderEmail` (`email/payment.ts`); `payment_rejected` adicionado aos allowedStatuses de `/song/:id/resume-link`, `/song/resume-data/:requestId`, `/song/recover-by-email`; scheduler `processRejectedReminder` (24h, guard em memória por requisição); +5 testes `abandoned-scheduler` + 5 novos `resume-recover.test.ts`. **⚠️ MIGRAÇÃO `supabase_migration_rejected_reminder.sql` — APLICAR EM PROD ANTES DO DEPLOY** (sem ela: dedupe só em memória → 1 lembrete duplicado por restart; não quebra).
- **2a** Wizard envia `email` no PUT `/song/:id/lyrics` (antes 400 em prod → "Confirmar e Gerar Música" falhava).
- **2b** Rejeitado pelo utilizador — letra editável só pós-pagamento mantida.
- **2c ETA honesto**: `deliveryEta` no Wizard — Express/upsell → *"logo após a aprovação"*; Standard → *"em até 24 horas"*.
- **2d** Banner de countdown morto do Wizard removido (estado+efeitos de expiry; título/subtítulo "Escolhe como queros receber" repostos após remoção acidental).
- **2e Garantia**: *"nova geração garantida + reembolso caso a caso"* em 6 locações (Wizard ×3, `pricing.ts` ×3, `faq.ts`, Landing, `TermsPage`).
- **2f Expiração falsa suavizada**: footers dos lembretes 30min/48h/72h + template WhatsApp '72h' — nada apaga letras automaticamente (delete é manual no admin).
- **2g Landing copy (5 edits)**: `popularity '83%'→'60%'` (real: Express 34/57 ≈ 60%, `pricing.ts`); *"(118 avaliações)"→"(+200 entregues)"*; *"Entrega por E-mail"→"Entrega por Email e WhatsApp"* ×2; *"Lê e edita a letra à vontade"→"Lê a prévia da letra · A música nasce após o teu sim"*. Fora de escopo mantido: `Wizard.tsx:3187` "Pode editar a letra à vontade" (follow-up possível).
- **2h Race fix auto-approve** (letra editada vs geração): geração **adiada 90s** — env `AUTO_APPROVE_GEN_DELAY_MS` (default 90000; **0 = síncrono, usado nos testes**); no fire-time **re-lê a letra da BD** com guards (cancela se `deleted_at`/`failed`/`payment_rejected`/áudio/task/generating) e só então chama `runBackgroundSunoWorkflow`; **touch de `songs.updated_at`** ao agendar + **4ª query no `stuckMusicRecoveryScheduler`** (`music_processing`+`not_started`+stale>15min) → timer perdido num restart é recuperado ao fim de 15min. Testes: +3 submit-payment (re-lê letra editada, cancela se rejeitado, espera delay+touch) +1 stuck (4 queries).
- **E2E infra**: `playwright.config.ts` ganha `E2E_PORT` (default 3000, CI inalterado) — local a porta 3000 estava ocupada por dev server de **outro projeto** (`surpresa-coletiva`/ComAmor; não foi morto) → correr `E2E_PORT=3100 npx playwright test`.
- **Suite final: 535 testes** (39 ficheiros) · E2E **64/64** (13.6m) · tsc/lint/build OK.

### Auditoria Pixel/CAPI — melhorias F1/F2/F4/F5 (28/Set 2026, sessão 2)
Auditoria técnica de mensuração (formato A–H) entregue; decisões do utilizador: **F2 = Opção B** e lote **F1+F4**. Todas executadas + F5 (versão "não quebrar nada"):
- **F1 — `hashPhone` corrigido** (`metaPixelCapi.ts`): antes mantinha o `+` → hash `"+244922000000"` nunca casava com o da Meta (spec: só dígitos com country code). Agora `replace(/\D/g,'')` + guard 9 dígitos → `244922000000`. Match key `ph` (prioridade Média) reparada em TODOS os eventos server.
- **F4 — Graph API `v21.0` → `v25.0`**: `metaPixelCapi.ts` (hardcoded), `metaAds.ts` default (env `META_GRAPH_API_VERSION`), `meta-direct.mjs` `API_VERSION`. v21.0 expira **21/Jan/2027** → fallback silencioso. WhatsApp (`whatsapp/config.ts`) intocado (versioning próprio, env).
- **F2-B — Purchase só na aprovação** (spec Meta: Purchase = confirmação/recibo de compra):
  - Server: `/submit-payment` Purchase condicionado a `paymentStatus === 'approved'` (antes: qualquer não-rejected → disparava em `pending_verification`); bloco Purchase do video-upsell removido (nasce pendente); `admin.ts` approve = fonte primária (guard `meta_purchase_sent_at` idempotente, unchanged); Refund guard inalterado.
  - Browser: novo `firePurchaseOnApproval(requestId, plan, value, currency)` em `Wizard.tsx` (módulo) chamado nos 3 detetores de `approved` (resposta do submit, poll 30s, botão "Verificar Estado") com **guard `localStorage` `seubeat_purchase_sent_<requestId>`** (Meta não deduplica browser↔browser; par server usa o mesmo `event_id`); `VideoUpsellPage` deixou de disparar Purchase (video-upsell fica server-only).
  - **Efeito**: volume Purchase Meta cai ~80→~60 disparos — contagens pré/pós não comparáveis; learning re-estabiliza ~1–2 semanas.
- **F5 — match keys Lead/CompleteRegistration**: tipos `sendLeadEvent`/`sendCompleteRegistrationEvent` ganham `externalId`/`fbp`/`fbc`; server passa `externalId=email` + `fbp/fbc` de `req.body`; client envia `fbp/fbc` no `/generate-lyrics`.
- **Testes**: `metaPixelCapi.test.ts` +4 (3× hashPhone: formato internacional/local/legado-com-`+` nunca enviado; versão `/v25.0/` no URL) · `submit-payment.test.ts` Purchase reescrito (pendente→não dispara; **novo teste auto-approve→dispara 1× com fbp/fbc/orderId+flag**) · `video-upsell-payment.test.ts` reescrito (submit→não dispara) · `admin-fixes.test.ts` título corrigido. **Suite: 510 testes** (38 ficheiros, 1 skipped) passam; `tsc --noEmit`/lint limpos; `npm run build` OK.
- **Pós-deploy (checklist G)**: Test Events (1 Purchase, não 2) · baseline EMQ do `ph` antes/depois · paridade `count(payments approved 7d)` vs Purchase · logs `[MetaCAPI]` sem 4xx.
- **Pendências**: (1) diagnóstico read-only da inversão **API(94) > IC(72)** no Events Manager (contagem Browser vs Server por evento) → F6 (guards sessionStorage) só se H1 (duplicados por remount) confirmado; (2) video-upsell `fbp`/`fbc` no Purchase do approve requer persistir fbp/fbc na row `payments` (migration — adiado).

### Fase 1 — Tracking Meta (Pixel + CAPI) implementada (28/Set 2026)
Auditoria Meta Ads/PIX/CAPI/Funil (20 partes, dados reais) → plano em 3 fases aprovado; **esta sessão executou só a Fase 1 (Tracking)**. Orçamento $10/dia mantido + redução p/ 2-3 anúncios = ação manual no Ads Manager (fora do repo). Fases 2 (Funil) e 3 (Media Buying) pendentes.

**Correções aplicadas (16 ficheiros, +820/−115):**
- **CAPI 4xx não conta como sucesso**: `metaPixelCapi.ts` — bug `return res.status >= 500 ? false : true` fazia 4xx (token inválido/config errada) contar como entregue e gravar `meta_purchase_sent_at` → `Refund` nunca disparava. Agora `attemptSend` devolve `'success' | 'retry' | 'fail'`: 4xx = falha final sem retry, 5xx/timeout = retry com backoff (timeout 5s via `AbortSignal.timeout`).
- **`fbp`/`fbc` + `order_id` na CAPI**: browser captura cookie `_fbp` (`getFbp`) e `fbclid` (`getFbc`, persistido em sessionStorage 30 dias — o wizard muda de URL e perdia a query); enviados no FormData/JSON do `submit-payment` (`SubmitPaymentSchema` valida formato `fb.1.*`), encaminhados **sem hash** em `user_data` e `custom_data.order_id` = payment id (match browser↔servidor, crítico p/ tráfego in-app 98,5% do spend).
- **Moeda única AOA**: todos os eventos servidor (Purchase/InitiateCheckout/AddPaymentInfo/SubmitApplication/Refund/video-upsell) passaram de USD para **AOA** (valor do browser) — a Meta via dois valores diferentes para o mesmo `event_id`; `kzToUsd` deixou de ser usado nos eventos.
- **`sanitizePaymentAmount`** (`server/utils/helpers.ts`): amount do cliente validado contra o catálogo **por plano** (base + addons [0,1500,2500,4000]); valor desconhecido ou de outro plano cai no preço base do plano (BD + `value` do Purchase ficam coerentes com o plano).
- **Novos eventos browser**: `ViewContent` (one-shot, event_id determinístico), `payment_screen` corrigido para o passo 5 (eram 6), `InitiateCheckout` na escolha do plano e `AddPaymentInfo` na escolha Express/Referência (ids vindos de `generateEventId(dbSongRequestId, …)` p/ dedup com o servidor).
- **`Refund` condicional**: auto-reject (`public.ts`) e rejeição admin (`admin.ts`) enviam `Refund` **só quando `meta_purchase_sent_at` estiver preenchido** (sem Purchase prévio não há conversão negativa a criar); **motivo de rejeição obrigatório** — rota admin devolve 400 se `notes` vazio (validação depois do lookup 409), `AdminPanel` valida no modal, motivo segue no email/WhatsApp do cliente.
- **Higiene**: `<img>` PageView duplicado do `<noscript>` removido (`src/lib/metaPixel.ts`).

**Validação: `npm test` → 505 testes passam (38 ficheiros, 1 skipped); `tsc --noEmit` limpo; `npm run build` OK.**
- Testes novos: `metaPixelCapi.test.ts` 9 (4xx→false/1 tentativa, 5xx→3 tentativas, fbp/fbc/order_id no payload, event_source_url real, Refund, ids 16 hex), `submit-payment.test.ts` +5 (fbp/fbc encaminhados, sanitize BD+CAPI, Refund condicional), `admin-fixes.test.ts` +4 (400 sem motivo, Refund com/sem Purchase), `helpers.test.ts` +5 (`sanitizePaymentAmount`), `metaPixel.test.ts` +6 (`getFbp`/`getFbc` incl. TTL 30 dias).
- **Bugfix de teste flaky**: `proof-verification` "recent date" usava hora fixa `01:26` (futura quando a suite corre pós-meia-noite) → data = 1h atrás.
- Rate limit nos testes de `submit-payment` (20/h/IP, sem `resetAll` no handler v8): contornado com `NODE_ENV=development` nos 2 describes novos (`skip()` do `paymentLimiter`).
- **Não bump de `WIZARD_BUILD`** (`20260819_1`): mudanças são aditivas/telemetria e `index.html` é servido com `maxAge:0` → clientes buscam o novo chunk no próximo load; bump apagaria o progresso de quem está a meio do funil. Decisão a rever se se mexer no fluxo do wizard.

### Correcções E2E (28/Set 2026) — CI verde depois de 12 falhas mobile-chrome
- **Causa raiz**: o contador do cabeçalho do wizard (`PASSO n`) tem `hidden sm:inline` (`Wizard.tsx:1817`) → nunca fica visível em ecrãs <640px; as 12 asserções `getByText(/PASSO n/)` falhavam sempre no projecto `mobile-chrome` (Pixel 7, 412px) e passavam no `chromium` desktop.
- **2ª causa (CI)**: o step "Start server & run E2E" arranca `node dist/server.js` (porta 3000) **antes** do Playwright, e `webServer.reuseExistingServer: false` fazia o Playwright abortar em 4–5s com *"http://localhost:3000/health is already used"* → **os E2E nunca correram no CI** (falha igual nos runs `36362512042`, `36148364562`, `36397714383`). Fix: `reuseExistingServer: !!process.env.CI` em `playwright.config.ts` (CI reusa o servidor já saudável; local mantém servidor próprio). Nota: o servidor CI arranca porque `CI=true` → `validateEnv` em modo teste não exige `BREVO_API_KEY`/`JWT_SECRET`.
- **Correcções (só testes; app intocada)** — commit `8072a75`:
  - **`expectWizardStep(page, step)`** novo em `e2e/fixtures/mocks.ts` — valida o `<h3>` do passo (títulos do `STEP_META`, responsivo) em vez do contador. Usado em `mocks.ts` (`completeWizardAndSubmit`), `wizard`, `landing`, `full-flow`, `lyrics-generation`, `premium-plan`, `recovery`, `resume-flow`.
  - `dedication-happy`: secção da letra via `Acompanha a reprodução` (`SongLyrics`) — `getByText('Letra').first()` caía no `hidden sm:inline` do `SongPlayer` (botão "Descarregar Letra").
  - `dedication` "renders loading state": **gate manual na route** (promise + `release()` após o expect) em vez de `setTimeout(2000)` — o delay fixo competia com o `goto` e a página já tinha os dados.
  - `admin-authenticated`: abre o sidebar mobile (`Abrir menu`) antes de clicar nas tabs — o `<aside>` está `-translate-x-full` fechado → "element is outside of the viewport" (overlay `z-40`, sidebar `z-50`).
- **3ª causa (o teste passava por acaso)**: `lyrics-generation` "503 transient" casava com `ROTATING_MESSAGES` do ecrã de processamento ("**Pedido** de casamento a transformar-se em musica") — não com a mensagem de fila; no CI o ecrã já tinha ido para o erro e o teste dava timeout (única falha: 62 ok / 2 falhas nos 2 projects). Fix: mock 503 replica o corpo real (`error` = `LYRIC_GENERATION_QUEUED_MESSAGE`), `/api/latest-song` mockado (`found:false`, sem tocar na Supabase de produção) e asserção explícita do ecrã de erro + "o teu pedido".
- **Relatório E2E legível sem auth**: logs e job summaries do Actions exigem login → o CI, em falha, gera `e2e-report.md` (resumo + últimas 300 linhas) e faz push para a **branch `ci-e2e-report`** (lido via `raw.githubusercontent.com`); passo "Publish E2E report" + reporter `list,json` (`playwright-results.json`) + `scripts/e2e-failures-summary.mjs`.
- **Validação local**: `npx playwright test` → **64/64 passam** (chromium + mobile-chrome, 7.7m); **64/64 em modo CI** (build + `node dist/server.js` + `CI=true`, 7.1m, exit 0); `tsc --noEmit` limpo; `npm test` → 505 passam (38 ficheiros).

### Fase 3 (parcial) — Exclusão de compradores aplicada + plano Fase 2/3 guardado (28/Set 2026)
- **Plano das fases 2 e 3 escrito em `scripts/PLANO_META_FASE2_FASE3.md`** (números de referência, tabela de ações Fase 2 funil / Fase 3 media buying, decisões tomadas, comandos).
- **Exclusão de compradores RESOLVIDA via API** (pendência antiga `1487916`): a Marketing API **v22+ removeu `targeting.exclusions.custom_audiences`** — o campo atual é **`targeting.excluded_custom_audiences`** (escrito em v25.0 ecoando o targeting completo; o POST substitui o objeto inteiro).
  - Aplicada e **verificada por leitura** nos 2 adsets: RT `120250568232860708` (PAUSED) e cold `120248973060180708` (ACTIVE) → `excluded_custom_audiences: ["EXCL - Compradores 180d" 120250568225030708]`.
  - No adset cold, efeitos colaterais verificados e inofensivos: `location_types` ganhou `frequently_in` (normalização Meta), `targeting_automation.individual_setting` deixou de ser devolvido (`advantage_audience` = 1 intacto), `age_range` legado `[22,55]` desapareceu (`age_min/max` 22–65 mantidos). Attribution/budget/status intactos.
- **`scripts/meta-direct.mjs`**: ação `exclude-buyers` corrigida (dry-run + `--live`), nova const `EXCLUSION_API_VERSION=v25.0`, `api()` aceita versão por chamada, `ensureAdset` usa `excluded_custom_audiences`, eco completo do targeting + verificação pós-escrita (`campos_alterados`) + sleep 35s entre POSTs (limite ~1/30s por adset, `error_subcode 4841018`).
- **Retargeting continua PAUSED à espera de criativos** (campanha + adset PAUSED, 0 anúncios) — decisão do utilizador; publicar só com criativo.

## Estado Atual (25/Set 2026)

### Bugs Corrigidos Hoje (25/Set 2026) — Pagamento auto-aprovado pela AI nunca gerava a música
- **Caso real**: pedido `62a31f31-1bd4-4c8a-b4be-b5ff577602b8` (premium pago, auto-approve AI 24/Set 00:11) → `approved`→`delivered` 00:21 **sem música** (`songs.audio_url=null`, `mureka_status=not_started`) → dedicatória servida sem áudio. Causa raiz: o bloco auto-approve de `POST /submit-payment` (`server/routes/public.ts`) fazia `status='approved'` **sem nunca chamar `runBackgroundSunoWorkflow`** (a aprovação manual do admin chama em `admin.ts:552`).
- **Fix raiz** (`server/routes/public.ts`): auto-approve lê pedido + música (`songs(id,title,lyrics,audio_url,full_song_url,mureka_status,mureka_task_id)`); sem áudio → **`music_processing`** + `runBackgroundSunoWorkflow(...)` em background; com áudio → `approved` como antes; já em geração → `music_processing` sem workflow duplicado; email de confirmação usa `recipient_name` (antes: plan). Update único (`status`+`deliver_at`) evita race com deliveryScheduler; falha no fetch cai no caminho antigo (aprovação simples) sem downgrade.
- **Guardas anti-entrega-sem-áudio**:
  - `deliveryScheduler.ts`: não marca `delivered` sem (`final_mixed_audio_url`/`songs.audio_url`/`full_song_url`) → `logWarn 'Pedido aprovado sem áudio — entrega adiada'`; select inclui os 2 campos de áudio.
  - `public.ts` `GET /api/song/:id` (auto-delivery): não entrega se não há `fullUrl` → `logWarn '[API] Auto-delivery adiada'`.
  - `stuckMusicRecoveryScheduler.ts`: **3ª query** candidata recupera pedidos `approved`/`delivered` sem `audio_url` (staleness `songs.updated_at`); `recoverStuckSong` exige **payment `status='approved'`** (nunca música grátis) — erro na verificação aborta; dedupe por id.
- **Testes +11**: `submit-payment.test.ts` +3 (auto-approve→`music_processing`+workflow+email `('cliente@test.com','Ana','req-1')`; com áudio→`approved` sem workflow; `mureka_status:generating`→sem duplicado; **novo mock `../services/proofVerification`** c/ defaults `null`/`true`), `stuck-music-recovery.test.ts` +4 (approved/delivered recuperam; sem payment não; erro payment aborta; mock estendido: `payment`, `currentTable`, `limit`), novo `delivery-scheduler.test.ts` (4: guard + entrega normal preservada + `final_mixed` + songId em falta). **Suite: 468 testes** (37 ficheiros, 1 skipped) passam; `tsc --noEmit`/lint limpos.
- **Pós-deploy CONCLUÍDO (25/Set 09:42–09:48)**: sem ação manual — o **stuckMusicRecovery** (3ª query) recuperou `62a31f31` no boot do deploy (`regeneration_count=1`, task `e5788bcb…`, `voice_processing`→`generating`→`completed` **234s**); request `delivered`; `GET /api/song/b2785b07-…` serve `audioUrl` (R2 200, 3.75 MB). Nota: `elevenlabsVoiceId={"failed":true}` (clonagem falhou → degradação controlada, conhecida). (Pedidos `d2520959`/`89a03ad9` sem pagamento são casos distintos, fora de escopo.)

### Bugs Corrigidos Hoje (25/Set 2026) — Sessão 2: 3 bugs de dedupe/telemetria
1. **Flags de email com `Date.now()` (epoch ms) em coluna `timestamptz`** (`abandonedRecoveryScheduler.ts`) — o PostgREST rejeitava o update em silêncio (erro ignorado) → dedupe de email **morto desde 12/Ago** (blame: `5338751`) → reenvio potencial de lembretes a cada tick de 10min. Fix: `nowIso` (string ISO) + helper `markEmailFlag` com check de `{error}` + `logError` (sem throw — senão salta o bloco WhatsApp).
2. **`whatsapp_send_log` sem logs desde 20/Ago** — duas causas: (a) `insertSendLog` não enviava `bucket` (coluna `NOT NULL` sem default → insert rejeitado, `.error` ignorado); (b) `getDailySentCount` filtrava `created_at` (coluna **não existe**; real = `sent_at`) → cap diário contava 0 → sempre esgotado/bloqueante. Fix: param `bucket?` (default `'manual'`) + `logError` em `{error}` + `sent_at` no cap; **todos os call sites** ganham bucket explícito (`transactional.ts`: delivery/payment_approved/payment_rejected/video_upsell/feedback; `bulkCampaign.ts`/`abandonedSender.ts`: `client.bucket`).
3. **`delivered_at` null em 52 pedidos `delivered`** — os 2 caminhos do workflow (`sunoOrchestration.ts`: `completeSunoWorkflowFromAudio` + update final `nextStatus`) gravavam `status='delivered'` sem `delivered_at` → follow-ups 7d/30d nunca disparavam (admin/public/deliveryScheduler já gravavam). Fix: `delivered_at` condicional a `nextStatus==='delivered'`; **backfill em produção** (52→0, `delivered_at = updated_at`).
- **Testes +11**: novo `whatsapp-send-log.test.ts` (10: bucket default/explicito, logError sem lançar, `sent_at` no cap, `markBucketSent` ISO/unknown, `markContacted`) + `abandoned-scheduler.test.ts` +1 (flag com string ISO válida). **Suite: 479 testes** (38 ficheiros, 1 skipped) passam; `tsc --noEmit`/lint limpos.


### Ads / Criativos (23/Set 2026)
- **Meta RT**: campaign `SeuBeat_Retargeting` `120250568225420708` PAUSED; adset `rt_checkout_14d` `120250568232860708` PAUSED (AO 22–65, PURCHASE) — **sem anúncio ainda**
- **Audiências**: RT Checkout 14d `120250568224670708`, RT LeadWizard 30d `120250568224870708`, EXCL Compradores 180d `120250568225030708`, RT Visitantes 30d `120250568225150708`
- Cold `120248973060170708` ACTIVE $10; pixel `1928777041139855`; conta `act_3968691273389952`; page `1186144217916410`
- **Criativos**: `scripts/CREATIVOS_RT_IA.md` (UGC 9:16) + `scripts/CONCORRENTES_META.md` secção RT (~l.173)
- **Demografia compradores** (n=57): 61% compra para mulher; ~82% cônjuges/namorados; Express 34 > Standard 14 > Premium 9; declaração/aniversário/agradecimento top; Luanda domina; pt-PT 100%
- **Vídeo editado**: `editar01_final.mp4` — 1080×1920 H.264 yuv420p 30fps, 213.9s, **45.9 MB** (de 207 MB HEVC), 8 legendas 3ª pessoa centradas (`editar01.ass` Alignment 5); QC 8/8 OK. Fonte: `editar01.mp4`
- **ScrapeGraphAI**: key no `.env` L62; ~267 créditos; usar `search` com `usePrompt: false`
- Pendências Ads: anúncio RT (criativo do utilizador), decisão Shot 3 A/B/C, prompts avatar 10s em CREATIVOS_RT_IA.md · ~~exclusão EXCL via API 1487916~~ **RESOLVIDA 28/Set** (v25 `targeting.excluded_custom_audiences`, aplicada ao RT + cold)

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
- **CI**: GitHub Actions (lint + test + audit + build + E2E)
- **MCP Servers**: Supabase + Jina AI (busca web, embeddings, leitura de URLs)

### Produção
- **URL**: https://seubeat.onrender.com
- **Último deploy**: `9886664` (28/Set ~11:20) **LIVE** (`/health` ok, uptime resetado pós-push)
- **Testes**: 535 unitários (39 ficheiros, 1 skipped) + **64/64 E2E Playwright** (chromium + mobile-chrome, local `E2E_PORT=3100`) — **CI verde de ponta a ponta** (`36407703814`: lint/test/build/**E2E** success)
- **Commits da sessão**: `ad5088c` (Fase 1 tracking) · `166bc80` (plano F2/F3 + exclusão compradores) · `8072a75` (E2E mobile-aware) · `9ff3c79` (CI reuse do servidor) · `9d67191`+`af6de41` (relatório E2E público) · `9886664` (teste do 503)

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

### Melhorias Hoje (23/Set 2026) — Retargeting Meta ($2/dia) + Meta Purchase + ScrapeGraphAI
1. **Campanha Retargeting criada (PAUSED, $2/dia)** — `scripts/meta-direct.mjs create-retargeting --live`:
   - **Campaign** `SeuBeat_Retargeting` `120250568225420708` — OUTCOME_SALES, AUCTION, daily $2, PAUSED, intocado cold `120248973060170708`.
   - **Adset** `rt_checkout_14d` `120250568232860708` — inclusion `RT - Checkout 14d`, age 22–65, AO, OFFSITE_CONVERSIONS→PURCHASE, attribution 7d click/1d view/1d engaged video (igual cold), `targeting_relaxation_types` off, **PAUSED, sem ad** (criativo = utilizador).
   - **4 audiências Website** (regras no pixel `1928777041139855`): `RT - Checkout 14d` `120250568224670708`, `RT - LeadWizard 30d` `120250568224870708`, `EXCL - Compradores 180d` `120250568225030708`, `RT - Visitantes 30d` `120250568225150708`.
   - **Exclusão de compradores**: ~~API rejeitava `targeting.exclusions` (erro 1487916)~~ → **resolvido 28/Set** com `targeting.excluded_custom_audiences` (v25), aplicado ao adset RT e ao cold.
   - Script `scripts/meta-direct.mjs` reconstruído (ações `create-retargeting`/`verify`/`pause`/`attribution`, load `.env`, retry rate-limit 613). Audiências antigas da conta continuam inválidas (template ALL_VISITORS sem filtro).
2. **Cold 3d (verify 20–23/Set)**: spend $15.68, **0 compras** — `teste_casamento` $5.60/0pur é o maior queimador (regra freio: >$6.50+>$15 → pausar); vencedores 30d (`wife_gestada`, `avô 02`) sem pur em 3d. Regra dia 5–7 de RT mantida.
3. **Meta Purchase (CAPI + Pixel)** — ver secção abaixo (commit `c009bfa`).
4. **ScrapeGraphAI — análise de concorrentes (criativos/ângulos)**:
   - Key `SGAI_API_KEY` em `.env` + `.env.example` (Free Plan; **~267 créditos** após rt-hooks).
   - Script `scripts/sgai-competitors.mjs` (ações `credits`/`analyze [pages|search]`/`extract`/`search`; base v2, header `SGAI-APIKEY`; fallback scrape→markdown; checkpoint incremental em `sgai-competitors-state.json`).
   - Relatório: `scripts/CONCORRENTES_META.md` — MakeCustomSong (R$179, 10 min) + Muz.cam (R$289–949) extraídos OK; **Songfinch landing bloqueada** (502 fetch_failed anti-bot) mas ângulo real do anúncio captado via FB video: *prova social "350k clientes / ~10 anos"* em vídeo institucional.
   - **9 ângulos imitáveis** para SeuBeat (síntese no fim do relatório): reacção da esposa, presente perfeito, preço acessível vs presentes caros, "sem ideias", UGC selfie, WhatsApp+Multicaixa, personalização profunda, surpresa emocional, credibilidade numérica.
   - **Ação `rt-hooks`** no script: 3 buscas raw (2 cr/result) + 1 busca LLM AO; síntese RT em `CONCORRENTES_META.md` (6 hooks + 6 gatilhos AO + copy Primary A/B/C). **~267 créditos** restantes. Aprendizagem: search com prompt+schema estoura timeout 180s no free plan (cobrar no servidor apesar do abort do cliente) → usar raw e sintetizar local.
5. **Pack criativos RT IA** — `scripts/CREATIVOS_RT_IA.md`: preset UGC 9:16, 1 persona × 3 hooks (continuidade / reação / confiança Multicaixa), estrutura CapCut, copy Meta ad, checklist AI label Meta, próximos passos Kling → ad PAUSED. Vídeo **ainda não gerado**; adset `rt_checkout_14d` continua sem anúncio.

### Melhorias Hoje (23/Set 2026) — Meta Purchase (CAPI + Pixel)
1. **#1 Dupla contagem Purchase eliminada** — admin `firePurchaseEvent` usava `generateServerEventId(payment.id)` enquanto browser/submit usavam `songRequestId` → Meta contava 2×. Fix: admin usa `generateServerEventId(requestId)` (exceto `plan==='video_upsell'` → `payment.id`); `/submit-payment` grava `meta_purchase_sent_at` após CAPI ok (admin salta reenvio via flag já existente).
2. **#2 Pixel Purchase em rejeitados** — servidor respondia `success:true` mesmo com `paymentStatus='rejected'` (auto-reject AI) → Wizard fazia `fbPurchase` incondicional. Fix: resposta inclui `paymentStatus`; `Wizard.tsx` só dispara `fbPurchase` se `paymentStatus !== 'rejected'`.
3. **#4 Video-upsell sem Purchase** — rota `/song/:id/video-upsell-payment` e `VideoUpsellPage` não disparavam Purchase. Fix: server `sendPurchaseEvent` (eventID=`paymentId`, `contentName='video_upsell'`, value `kzToUsd(2900)`, flag `meta_purchase_sent_at`); client `fbPurchase` após sucesso com `generateEventId(paymentId,'Purchase')` (dedup).
4. **#3 (moeda AOA/USD browser vs server) SALTADO** — a pedido do utilizador.
5. **Testes**: +2 admin-fixes (eventID requestId / video payment.id / flag skip), +1 submit-payment (paymentStatus + CAPI flag), novo `video-upsell-payment.test.ts` (5). **Suite: 457 testes** (36 ficheiros); `tsc`/lint limpos.

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

### Melhorias Hoje (22/Set 2026) — Sessão 2 (P1+P2 prompts + teste real)
13. **P1+P2 refinamento de prompts completo** (após commit `27f10d6`):
    - **P1.1** frases-exemplo removidas: `prompts/memorial.txt`, `prompts/paramim.txt`, `prompts/filho.txt`.
    - **P1.2** `FORCED_LYRIC_TERMS` + warnings "termo(s) possivelmente forçado(s)" em `aiShared.ts` — watch de regressão diagnóstico (nunca rejeita).
    - **P1.3** `prompts/LEIA-ME.txt`: docs corrigidos (sem "Claude"), secção WATCH única.
    - **P2.4** GANCHO unificado em `prompts.ts` (fallback + dinâmico).
    - **P2.5** OpenAI temperature 0.75 (alinha com DeepSeek).
    - **P2.6** `languageInstruction` idiomas nacionais suavizados ("não força a lista").
    - **Duplicações 15× corrigidas** (script temporário, já removido): `aiShared.ts` (const 1×), `LEIA-ME.txt` (secção 1×), `aiShared.test.ts` (testes 1×).
    - **Suite: 438 testes** (34 ficheiros) passam; `tsc --noEmit`/lint limpos.
15. **P1+P2 timbre/voz — todas as músicas pareciam ter o mesmo timbre** (22/Set, sem commit — aguarda pedido):
    - **P1** (`server/services/suno.ts`): `STYLE_MAP` sem descritores de timbre vocal (competiam com o token de género); `VOICE_STYLE_MAP['sem preferência']` deixou de ser `''`; nova `buildSunoStylePrompt()` — ordem: voz/género **primeiro** → baseStyle → emoção → artista → sotaque. `ACCENT_STYLE_MAP` intocado.
    - **P2** (`server/services/workflow/voiceCloning.ts`): falha de clonagem Premium deixou de ser silenciosa — retry 1× só p/ transitórios (`Internal Error`, `not ready after N`), frase expirada do wizard → regenera frase nova e tenta de novo, e falha final grava `error_details` + **`sendAdminNotification`** ao admin (antes: 11/12 clonagens falhavam sem alerta).
    - **Testes**: novo `suno-style.test.ts` (10) + `process-suno-voice.test.ts` 5→7 (retry transitório, fallback frase expirada, admin notification). **Suite: 450 testes** (35 ficheiros); `tsc`/lint limpos.
14. **Teste real de geração DeepSeek validado** — script temporário `test-real-generation.ts` (removido) com formData realista (Ana, aniversário, Kizomba, Luanda):
    - Provider deepseek, **3.5s**, custo ~$0.003.
    - **0 issues, 0 warnings, 0 termos forçados, 0 marcadores em falta** (6/6 na ordem correta).
    - Gancho "Tu és a minha vida" presente no refrão; personalização com nome/local/ocasião correta.
    - Dedicatória e snippet válidos.

### Melhorias Hoje (22/Set 2026)
1. **Bug fix ESM crítico** — `env.ts` tinha `require()` num módulo ESM (commit `94da31e`), que impedia o servidor de arrancar (`ERR_AMBIGUOUS_MODULE_SYNTAX`). Fix: remover `logWarnLazy` e voltar a `console.warn` direto (startup warnings não precisam de logger estruturado).
2. **Bug fix admin: cartão "Pagamento" sempre vazio** — rota `GET /api/admin/requests` fazia `.in('request_id', requestIds)` com ~1000 UUIDs → URL ~37KB → PostgREST 400 Bad Request **silencioso** (error ignorado) → `paymentsMap = {}` → frontend mostrava "—"/"Pendente" em todos os campos. Fix em `server/routes/admin.ts`: fetch completo da tabela `payments` (só 75 linhas, sem `.in()`), `logWarn` no erro, fallback `plan = plan || plan_type` (39/75 payments legacy têm `plan: null`). Shape da resposta inalterado; 431 testes + `tsc --noEmit` limpos.
2. **E2E Playwright — 32/32 testes a passar** — 6 correções em testes desatualizados:
   - `landing.spec.ts` + `wizard.spec.ts`: "Transforme a sua história" é `<p>`, não heading — `getByRole('heading')` → `getByText()`
   - `full-flow.spec.ts` + `express-plan.spec.ts` + `payment-rejection.spec.ts`: ecrã de validação de letras (`lyricsValidating`) após pagamento — adicionado `skipLyricsValidation()` helper + mock `PUT /api/song/*/lyrics`
   - `resume-flow.spec.ts`: timeout por consumo de retries — resolveu-se com correções dos outros testes
3. **E2E test helpers** — `mockLyricsConfirm()` + `skipLyricsValidation()` adicionados a `e2e/fixtures/mocks.ts`
4. **Bug fix: upload de comprovativos** — investigação completa do bug do `eliassauimbo@gmail.com` (15.000 Kz, status `lyrics_ready`, zero payments):
   - **Root cause**: a tabela `payments` em produção não tinha as 4 colunas (`proof_hash`, `transaction_id`, `ai_verified`, `verification_result`) apesar do código INSERT incluí-las. O schema cache fallback existente em `public.ts` (linhas 1506-1518) estava correto mas **o handler nunca chegava ao INSERT** — o Render proxy (timeout ~30s) cortava a conexão antes porque a verificação AI (Gemini 15s + OpenAI 15s = worst-case 30s) combinada com upload lento de Angola excedia o limite.
   - **Fix 1**: Migration `supabase_migration_proof_verification.sql` + `supabase_migration_proof_dedup.sql` aplicadas via Postgres direto (pooler). 4 colunas + 4 índices criados + schema cache recarregado (`pg_notify pgrst`).
   - **Fix 2**: `AI_TIMEOUT_MS` reduzido de 15s→10s em `proofVerification.ts` — worst-case do handler cai de ~35s para ~25s, dentro do limite de 30s do Render proxy.
   - **Resultado**: 419 testes passam; `tsc --noEmit` limpo.
5. **Pedido do utilizador mantém `lyrics_ready`** — o estado não está corrompido; o utilizador pode retentar o upload pelo Wizard normalmente.
6. **Migrações payments re-aplicadas com sucesso (22/Set 15:45)** — `add_payment_verification_result_columns` + `add_payment_proof_dedup_columns` via MCP `supabase` (projeto `uqmqkntnpuecswcrtulz`). Colunas confirmadas: `verification_result jsonb`, `ai_verified boolean`, `proof_hash text`, `transaction_id text` + índices + `NOTIFY pgrst`.
7. **Chaves AI em produção confirmadas** — `GET /health` devolve `gemini: ok` (`gemini-2.5-flash`, available) + `deepseek: ok` ($1.39 saldo) + `env.openai: true` / `env.gemini: true`. NOTA: `/health` não reporta saldo OpenAI (só presença da key).
8. **Fix normalização de data AI** — `parseProofDate()` em `proofVerification.ts` aceita agora `DD/MM/YYYY [HH:mm]` (formato Multicaixa/Angola) além de ISO e `YYYY-MM-DD HH:mm`; valida ranges (mês 1–12, dia 1–31) e prefere day-first quando ambíguo. Antes: `new Date("22/09/2026 01:26")` → Invalid Date → check de data falhava → perdia 0.10 de confiança → comprovativos legítimos podiam cair em `manual_review` por engano. **Thresholds NÃO alterados** (`PROOF_AUTO_APPROVE_THRESHOLD=0.85`, `PROOF_AUTO_REJECT_THRESHOLD=0.50`); override de `transactionId` mantido estrito. +2 testes (31→33 no ficheiro; suite 431+2).
9. **Causa `manual_review` no c4ca21cf (12/Set 12:02) concluída por código** — comprovativo sem Transaction ID legível (só `639182******5895` mascarado) → AI `transactionId: null` → conf. 0.85 → **override Layer 4 força `manual_review`** (`public.ts:1377-1384` + `proofVerification.ts:389-396`). Comprovativo: Express 15.000 Kz, phone 929423278 ✓, data 2026-09-22 01:26:55 ✓. Admin aprovou 12:07:18 (`notes: "Pagamento verificado e aprovado."`); delivered 12:10:02. Logs Render dessa janela não retidos (free tier).
10. **`render_list_env_vars` indisponível** — tool não existe no MCP Render (só `render_update_environment_variables` / `render_get_service`). Verificação de keys AI em prod via `/health` (confirmado).
11. **Opção B — Transaction IDs mascarados aceites sem afrouxar anti-fraud** (22/Set, commit `caa845c`):
    - **Problema**: screenshots Multicaixa mostram ID parcialmente mascarado (ex: `639182******5895`) → prompt antigo não instruía a extrair com asteriscos → AI devolvia `null` → Check 6 falhava (−0.15) mas conf. ficava exatamente 0.85, e o Layer 4 antigo (`length < 3`) forçava `manual_review` mesmo com 7/7 checks certos.
    - **Fix** (`server/services/proofVerification.ts`):
      - `VISION_PROMPT` reescrito: extrair o ID exatamente como visível (com asteriscos); `null` só se nenhum número visível; exemplo `639182******5895` documentado.
      - Novo helper **`isTxIdAcceptable(txId)`** (exportado): null/curto → rejeita; **mascarado (contém `*`) exige ≥6 dígitos visíveis**; não-mascarado ≥3 dígitos ou ≥1 letra.
      - **Check 6** e **Layer 4** (`proofVerification.ts`) e **override** (`public.ts:1377-1384`) agora usam o mesmo helper → invariante check6 == Layer4 restaurado (o Layer 4 nunca fica mais frouxo que o Check 6).
    - **Anti-fraud intacto**: thresholds inalterados (0.85/0.50); IDs mascarados com <6 dígitos (ex: `12***34`) continuam a cair em `manual_review`; dedupe cross-request por `transaction_id` inalterado.
    - **Testes**: +2 em `proof-verification.test.ts` (auto_approve com `639182******5895`; `12***34` → manual_review). **Suite: 435 testes** (34 ficheiros) passam; `tsc --noEmit` limpo.
12. **Prompts de letras: termos forçados eliminados** (22/Set) — causa raiz dos "ecoa"/"candongueiro"/"bué" nas letras:
    - **Problema**: `prompts/mestre.txt` continha linhas-exemplo literais que os modelos copiavam: "Em vez de… escreva 'o som da tua gargalhada **ecoa** na cozinha vazia'" (l.7-8) + "EXEMPLO DE TOM" com **candongueiro**/**Mussulo**/**bué** (l.29-31); `amizade.txt`/`familia.txt` reforçavam "gargalhada"; `LEIA-ME.txt` listava gírias a usar.
    - **Fix**:
      - `mestre.txt`: exemplos removidos; regra 2 agora exige imagens "tiradas dos dados fornecidos"; regra 4 explícita — *"sem forçar gírias ou expressões locais (ex.: candongueiro, bué, xé) — só se vierem dos dados do utilizador"*; "EXEMPLO DE TOM" eliminado.
      - `amizade.txt`/`familia.txt`: Ponte sem "gargalhada".
      - `LEIA-ME.txt`: secção sotaque reescrita (NÃO forçar gírias).
      - `prompts.ts`: fallback do `promptMestre` sincronizado (adicionada regra 6 género + regra anti-gírias); `languageInstruction('português')` e instrução final reforçadas.
    - **DeepSeek `temperature 0.65 → 0.75`** (`deepseek.ts:47`) — mais diversidade; JSON mode + `thinking: disabled` mantidos.
    - **Não alterado**: estrutura de marcadores, GANCHO, validação diagnóstica, `ACCENT_STYLE_MAP` (só sotaque vocal).
    - **Testes**: 435 passam; `tsc`/lint limpos.

### Melhorias Hoje (21/Set 2026)
1. **Health & Observabilidade** — `unhandledRejection`/`uncaughtException` handlers em `server.ts`; httpLogger filtra `/health`, OPTIONS, assets estáticos; `console.*` substituídos por logger estruturado (audio.ts, env.ts, admin.ts, public.ts).
2. **Segurança** — webhook token com `timingSafeEqual` (timing-safe comparison); `ADMIN_ALLOWED_IPS` adicionado ao `.env.example`.
3. **CI/CD** — `npm audit --audit-level=high` no pipeline; Dependabot config (npm + github-actions); `SMTP_HOST` morto removido do CI.
4. **Deps limpas** — `@types/qrcode` removido (dead); `@types/multer` movido para devDependencies; `package.json name` corrigido (`react-example` → `seubeat`).
5. **Bug fix** — `ensureSentry` memoization (`null` vs `undefined`) — imports falhados eram re-tentados em cada chamada em vez de cacheados.

### Pendências Conhecidas
- `auth_leaked_password_protection` — ativar manualmente no Dashboard Supabase
- Paginação no endpoint `/requests` (retorna todos sem limit)
- Response shapes inconsistentes no admin (alguns sem `success` field)
- Admin IP restriction opcional (via `ADMIN_ALLOWED_IPS`)
- WhatsApp verificação formal impossível para +244 (limitação Meta error 136024)
- Pagamentos antigos com `verification_result` = NULL (re-analisar manualmente)
- Re-analyze não atualiza `ai_verified` (inconsistência menor)
- Cap PostgREST 1000 linhas — rota `/songs` (`admin.ts:738-752`) — não tocar (adiado)
- `/health` não valida saldo OpenAI (só presença da key) — melhorar futuramente
- **Deploy Meta Purchase (23/Set)** — commit `c009bfa` pushado; confirmar deploy Render + eventos em Events Manager
- **RT publish pendente** — `SeuBeat_Retargeting` criada PAUSED sem anúncio: gerar vídeo com prompts em `scripts/CREATIVOS_RT_IA.md` (Kling), utilizador mete criativo e publica (toggle ACTIVE); ~~confirmar exclusão compradores~~ **exclusão já aplicada 28/Set**; regra freio CPA >$6.50 / >$10 gasto
- **Plano Fase 2 (funil) / Fase 3 (media buying)** guardado em `scripts/PLANO_META_FASE2_FASE3.md` — execução pendente
- **SGAI** — ~267 créditos free; evitar search com prompt+schema (timeout) — preferir raw ou extract
- **Sem LAL nesta ronda** — decisão; Lookalike só se RT escalar com CPA ≤$5 (dia 5–7)

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
- E2E tests precisam de env vars dummy no .env local para o servidor arrancar (SUNO_API_KEY, BREVO_API_KEY, ADMIN_PASSWORD, JWT_SECRET) — **remover antes de commit**
- Após pagamento submetido com sucesso, o wizard mostra ecrã `lyricsValidating` (confirmação de letras) — os E2E tests devem incluir `skipLyricsValidation()`
