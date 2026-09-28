# SeuBeat — Creative Intelligence Engine

> Gerado: 28/Set/2026 · Fontes: Meta Marketing API (read-only, `verify` 3d/7d/30d + insights lifetime 01/Jun→28/Set), Supabase (SELECT read-only), repo (`REVISAO_META_REMINDER.md`, `CREATIVOS_RT_IA.md`, `PLANO_META_FASE2_FASE3.md`, `CONCORRENTES_META.md`, `PROJECT_STATE.md`).
>
> Regra de ouro: **Purchase = KPI principal.** CTR/CPL são só diagnóstico. Cada afirmação é marcada **DADO** (API/BD/repo), **INFERÊNCIA** (dedução dos nomes/estruturas) ou **HIPÓTESE** (a validar em teste).

---

## 1. Inventário de criativos (por conceito)

**19 anúncios** na campanha cold `SeuBeat_teste` (`120248973060170708`, ACTIVE, budget $10/dia). RT `SeuBeat_Retargeting` (`120250568225420708`): **PAUSED, 0 anúncios** (DADO).

Famílias de conceito (agrupamento INFERÊNCIA a partir dos nomes; métricas DADO):

| # | Conceito (framework) | Anúncios | Nº |
|---|---|---|---|
| **A** | **PERSONA** mulher/mulher a receber · **ANGLE** reação/surpresa · **OFFER** música da vossa história | wife_gestada, wife_01, wife_car, wife_car-careca, wife_buxexas, mulher triste_car, menina | 7 |
| **B** | **PERSONA** marido/homem · **ANGLE** declaração do homem ("chorão") · **OFFER** mesma, execução carro/noite | marido_claudino, marido_car-PAULO, marido_car-noite, man in car-henriques, Carlos chorão | 5 |
| **C** | **PERSONA** avô/vovô/senhora/mãe · **ANGLE** homenagem/recordar quem nos criou · **OFFER** música-eterno-retrato | avô 02, vovô 01, senhora no quintal, senhora MAKEUP, mãe_car | 5 |
| **D** | **PERSONA** casal/noivos · **ANGLE** celebrar casamento | casamento | 1 |
| **E** | **PERSONA** pessoa doente · **ANGLE** cuidar/consolar | doente | 1 |

Estado atual (DADO): **ACTIVE** = wife_gestada, avô 02, wife_01, Carlos chorão (4) · **PAUSED** = 15 (incl. marido_claudino, menina, casamento — pausados após gastar nos últimos 7d).

RT: 3 hooks escritos mas **não produzidos** (`CREATIVOS_RT_IA.md`: "A tua música está quase pronta", "Em minutos transformamos esta mensagem numa música", "A música que fiz para a minha esposa") — DADO: campanha existe vazia.

---

## 2. Decomposição por conceito

Cada campo: **D** = dado confirmado, **I** = inferência do nome (a confirmar por ti).

### Conceito A — Reação da esposa (7 execuções)
- Persona: mulher (esposa/grávida/namorada) — I
- Angle: reação emocional ao ouvir — I · Emoção: ternura/alegria — I
- Hook: reação no momento de dar auscultadores (formato Reaction Video, 46% do lean de referência PrayerSong — DADO `CONCORRENTES_META.md`) — I
- JTBD: demonstrar amor + criar memória + surpreender — I
- Objeção tratada: nenhuma (foco só emoção) — I · Estágio: consideration (já sabe o que é música personalizada?) — I
- Veredito: **1 conceito, 7 execuções** — gestada/buxexas/triste são variações de cenas, não conceitos novos (I). `wife_gestada` com "muxima/buxexa" = mesma persona grávida (I).

### Conceito B — Marido no carro (5 execuções)
- Persona: marido/homem (Paulo, Henriques, Claudino, Carlos) — I
- Angle: homem sensível que se emociona ("chorão") — I · Emoção: vulnerabilidade masculina — I
- JTBD: expressar sentimentos (homem que não fala) — I
- Veredito: **1 conceito, 5 execuções** (mesmo cenário carro, dia/noite/variações de actor) — I

### Conceito C — Homenagem a quem criou (5 execuções)
- Persona: avô/vovô/senhora/mãe — I · Angle: recordar/homenagear — I · Emoção: saudade/gratidão — I
- JTBD: homenagear + recordar + saudade — I
- Veredito: **1 conceito, 5 execuções**, mas com personas distintas (avô ≠ mãe ≠ senhora) — mais diversidade interna que A/B (I)

### Conceito D — Casamento (1) · Conceito E — Doente (1)
- D: celebrar (1 execução, 0 compras) · E: consolar (gasto mínimo, sem sinal) — D métricas / I ângulos

---

## 3. Performance por conceito (Purchase > diagnóstico)

### 3.1 Janelas Meta (DADO — API, level=ad)

| Janela | Gasto | Purchases | CPA | Leitura |
|---|---|---|---|---|
| 30d (29/Ago→28/Set) | $204.48 | 28 | **$7.30** | ≈ break-even ($7.29 seg. rodapé do script) |
| 7d (21→28/Set) | $67.68 | 5 | $13.54 | degradação |
| 3d (25→28/Set) | $33.61 | 2 | $16.80 | pior janela |

**Causa da degradação (DADO):** `teste_menina` sozinho gastou **$25.52 dos $33.61** dos últimos 3d com CPA $25.52; `casamento` $8.97 com 0 compras em 7d. Excluindo os queimadores, os 4 anúncios ativos restantes gastaram $7.76/3d. **Não é fadiga dos vencedores — é orçamento a ir para anúncios maus** (ambos já PAUSED no inventário).

⚠️ **Processo (DADO+I):** a regra "pausar se CPA > $6.50 E spend > $15" (`REVISAO_META_REMINDER.md`) era conhecida mas o menina só foi pausado depois de queimar $25.52 em 3 dias — não há enforcement automático (I). Consistente com a decisão de 08/08 de pausar `marido_claudino` (CPA 30d $7.42 na época).

### 3.2 Por família de conceito (DADO — lifetime 01/Jun→28/Set)

| Conceito | Gasto | Leads | Compras | Lead→compra | CPA | % do gasto |
|---|---|---|---|---|---|---|
| **C — Homenagem (avós/mãe)** | $55.90 | 59 | 9 | **15,3%** | **$6.21** | 14% |
| A — Reação esposa | $183.45 | 581 | 25 | 4,3% | $7.34 | 46% |
| B — Marido/carro | $153.66 | 480 | 18 | 3,8% | $8.54 | 38% |
| D — Casamento | $8.97 | 4 | 0 | 0% | — | 2% |
| E — Doente | $1.26 | 0 | 0 | — | — | 0,3% |
| **TOTAL** | **$403.24** | **1.124** | **52** | **4,6%** | **$7.75** | 100% |

**Leitura:** o conceito com a **melhor eficiência e intenção** (C: 3× o lead→compra de A/B) tem só 14% do orçamento; A+B concentram 83% do gasto em leads baratos que compram 3–4× menos.

### 3.3 Por anúncio — lifetime (DADO)

| Anúncio | Estado | Gasto | Leads | Reg | Checkout | Compra | CPL | L→P | CPA |
|---|---|---|---|---|---|---|---|---|---|
| wife_gestada | ACTIVE | $111.01 | 486 | 304 | 34 | **16** | $0.23 | 3,3% | $6.94 |
| marido_claudino | PAUSED | $74.58 | 214 | 122 | 23 | 7 | $0.35 | 3,3% | $10.65 |
| marido_car-PAULO | PAUSED | $42.46 | 133 | 68 | 5 | 5 | $0.32 | 3,8% | $8.49 |
| man in car-henriques | PAUSED | $35.27 | 132 | 60 | 6 | 4 | $0.27 | 3,0% | $8.82 |
| **avô 02** | ACTIVE | $34.57 | 21 | 13 | 3 | **5** | $1.65 | **23,8%** | **$6.91** |
| wife_01 | ACTIVE | $33.17 | 60 | 41 | 7 | 4 | $0.55 | 6,7% | $8.29 |
| menina | PAUSED | $29.63 | 19 | 18 | 3 | 2 | $1.56 | 10,5% | $14.82 |
| senhora no quintal | PAUSED | $16.08 | 32 | 17 | 2 | 3 | $0.50 | 9,4% | $5.36 |
| casamento | PAUSED | $8.97 | 4 | 4 | 0 | 0 | $2.24 | 0% | — |
| mulher triste_car | PAUSED | $4.71 | 11 | 4 | 0 | 2 | $0.43 | 18,2% | $2.36 |
| senhora MAKEUP | PAUSED | $3.76 | 2 | 1 | 1 | 0 | $1.88 | 0% | — |
| wife_car | PAUSED | $2.49 | 2 | 2 | 2 | 1 | $1.25 | 50%* | $2.49 |
| wife_buxexas | PAUSED | $2.16 | 3 | 1 | 0 | 0 | $0.72 | 0% | — |
| doente | PAUSED | $1.26 | 0 | 0 | 0 | 0 | — | — | — |
| Carlos chorão | ACTIVE | $1.14 | 1 | 1 | 1 | 2 | $1.14 | n=1* | $0.57 |
| mãe_car | PAUSED | $0.86 | 3 | 3 | 0 | 0 | $0.29 | 0% | — |
| vovô 01 | PAUSED | $0.63 | 1 | 0 | 1 | 1 | $0.63 | n=1* | $0.63 |
| wife_car-careca | PAUSED | $0.28 | 0 | 0 | 0 | 0 | — | — | — |
| marido_car-noite | PAUSED | $0.21 | 0 | 0 | 0 | 0 | — | — | — |

\* n<5 → ruído de atribuição (compras > checkouts acontece por janelas de atribuição diferentes — DADO).

Mapeamento para o funil do projeto (validação cruzada — DADO):
- `lead` API (1.124) ≈ 1.078 pedidos com letras (`PLANO_META_FASE2_FASE3.md`) ✓
- `initiate_checkout` API (88) ≈ 80 submissões de pagamento do funil ✓
- `purchase` API (52) vs 60 pagamentos aprovados (BD) → 83% atribuídos a anúncios ✓
- `complete_registration` (659) = evento intermédio do wizard — **INFERÊNCIA** (não consta no funil documentado)

---

## 4. Lead barato vs lead que compra (eixo central)

**Validação dos teus números (DADO — API lifetime):** `marido_claudino` **214 leads / 7 purchases** ✓ exato · `avô 02` **21 leads / 5 purchases** ✓ exato.

| Perfil | Exemplos | CPL | Lead→compra | CPA | Veredito |
|---|---|---|---|---|---|
| Lead barato, compra pouco | claudino, henriques, paulo, gestada | $0.23–0.35 | 3,0–3,8% | $6.94–10.65 | Volume, não receita eficiente |
| Lead caro, compra muito | **avô 02** | $1.65 | **23,8%** | **$6.91** | 7× mais caro por lead, mas **melhor cliente** |
| Meio-termo | wife_01, quintal, triste | $0.43–0.55 | 6,7–18,2% | $2.36–8.29 | Promissores com n pequeno |

**DADO:** a ordem por CPL (gestada < claudino < avô) é **inversa** à ordem por qualidade. Escolher anúncios por CPL maximiza volume de leads e piora o CPA — exatamente o erro que o prompt manda evitar ("lead ≠ comprador").

---

## 5. Redundâncias (execução nova ≠ conceito novo)

- **A**: 7 anúncios, 1 conceito. Gestada + buxexas = mesma persona grávida (I). Trocar cenário/actor = nova execução.
- **B**: 5 anúncios, 1 conceito (carro/marido), variações actor/noite (I).
- **C**: 5 anúncios, 1 ângulo (homenagem) mas 5 personas diferentes → **menos redundante** (I) — e é a família mais eficiente.
- Concentração: **`wife_gestada` = 28% do gasto lifetime e 31% das compras** — dependência de um único anúncio (DADO). Top-2 (gestada+claudino) = 46% do gasto.
- Total: **11 de 19 anúncios** (58%) são 2 conceitos (A+B) — I.

---

## 6. Lacunas (por que não compram mais)

**Cobertura JTBD × dados de compra (DADO — Supabase, pedidos `approved`/`delivered`, n=63):**

| JTBD (prompt) | Ocasiação (BD) | Pagos | Pedidos | Taxa pagos/pedidos |
|---|---|---|---|---|
| Expressar sentimentos / demonstrar amor | declaração | 16 | 382 | 4,2% |
| Agradecer | agradecimento | 13 | 168 | **7,7%** |
| Celebrar | aniversário | 13 | 192 | 6,8% |
| Homemagear | homenagem | 6 | 128 | 4,7% |
| Recordar / saudade / criar memória | saudade | 5 | 69 | **7,2%** |
| Celebrar (casamento) | casamento | 4 | 44 | **9,1%** |
| — | sem motivo | 3 | 44 | 6,8% |
| Pedir desculpas | pedido de desculpas | 2 | 40 | 5,0% |
| Celebrar (namoro) | aniversário de namoro | 1 | 37 | 2,7% |
| Surpreender / presentear | (cruzado em todas) | — | — | — |

**Relações pagas (DADO):** esposa 29 (46%) · marido 15 (24%) · namorado 10 (16%) · mãe 3 · pai 3 · filho 1 · amigo 1 · outro 1 → **86% casais**.
**Planos aprovados (DADO):** sem plano registado 29 · express 19 (avg 9.900 Kz) · standard 7 (7.900) · premium 5 (14.900).

**Lacunas concretas:**
1. **RT = 0** — maior lacuna estrutural: 976 leads `lyrics_ready` sem pagar + ~80 abandonos/mês, campanha vazia, 3 hooks já escritos (DADO).
2. **Agradecimento (7,7%) e saudade (7,2%)** over-performam a declaração (4,2%) mas **não têm nenhum criativo próprio** (I: nenhum nome indica estes ângulos; `doente` é o mais próximo e gastou $1.26).
3. **Pais/avós sub-explorados**: mãe+pai = 6 pagos, avô = 5 compras — mas `mãe_car` teve $0.86 e `pai` **nunca teve anúncio** (DADO+I).
4. **Objeção preço/fricção Multicaixa**: nenhum criativo (I) — apesar de ser 1 dos 9 ângulos imitáveis (`CONCORRENTES_META.md` #6 preço acessível, #9 processo WhatsApp) e de o funil perder 92,6% entre letras e submissão (80/1.078).
5. **Prova social/institucional** (ângulo #1 dos 9): zero criativos (I).
6. **Estágio de consciência**: os 19 são todos "reaction/solution" — nenhum problem-aware ("esgotado de presentes?") ou competitor-aware (I).
7. **Casamento**: 1 criativo, $8.97, 0 compras com a 2ª maior taxa de conversão de pedido (9,1%) — ângulo caro-testado-e-morto cedo demais (DADO+I).

---

## 7. Decisões por conceito (status)

| Conceito/Anúncio | Evidência | Status | Justificação (Purchase) |
|---|---|---|---|
| A · wife_gestada | 16 pur, CPA $6.94 (30d $6.16) | **ESCALAR** (com teto) | único com escala real abaixo do break-even; risco = dependência 1 anúncio |
| C · avô 02 | 5 pur, CPA $4.17 (30d), L→P 23,8% | **ESCALAR** | melhor CPA escalável; gasto só $20.86/30d |
| A · wife_01 | 4 pur, CPA $5.18 (30d) | **MANTER** | testemunha barata do conceito A |
| B · Carlos chorão | 2 pur / $1.14 | **TESTAR** | sinal forte, n minúsculo — 1 variação nova |
| C · senhora no quintal | 3 pur, CPA $5.36 | **TESTAR** | prova adicional da família C |
| A · mulher triste_car | 2 pur, CPA $2.36 | **TESTAR** | melhor CPA absoluto, n pequeno |
| B · claudino / paulo / henriques | 7/5/4 pur, CPA $8.5–10.7 | **PAUSADO (manter)** | acima do break-even; lead volume não salva |
| D · casamento | 0 pur / $8.97 | **REFORMULAR** | ocasião converte 9,1% — o ângulo é que falhou, não a ocasião (HIPÓTESE) |
| A · menina | 2 pur, CPA $14.82 | **PAUSADO (manter)** | violou a regra freio; queimou $25.52/3d |
| B/C menores (noite, careca, makeup, mae, vovô, doente, buxexas) | 0–1 pur, ≤$4 | **PAUSADO** | amostra insuficiente; `mãe_car`/`vovô` merecem re-teste dentro do plano C |

---

## 8. Próximos testes (hipótese comercial, nunca "A vs B")

Cada teste: **hipótese explícita → variável de conceito → métrica de decisão → kill rule**. Orçamento sugerido: $3–5/dia por teste, janela mínima ~$15 ou 5 compras. KPI = **Purchase**; diagnósticos: CPL, lead→compra, initiate_checkout/lead, CTR.

1. **T1 — Escalar a família C (homenagem).** HIPÓTESE: "quem compra é sobretudo quem homenageia quem criou (avô/mãe/pai) — dobrar o gasto em C reduz o CPA global mesmo com leads mais caros". Novos: `avô 03`, `mãe 02`, `pai 01` (persona nunca testada). Métrica: CPA de C ≤ $7 mantendo ≥20% do gasto. Kill: CPA > $10 a $15 gastos.
2. **T2 — Agradecer > declarar.** HIPÓTESE: "o ângulo 'obrigado por tanto tempo' (agradecimento: 7,7% pagos/pedido vs 4,2% de declaração) gera lead→compra ≥2× o do conceito A". 1 criativo novo (persona mãe/filha). Métrica: L→P vs 4,3% baseline de A.
3. **T3 — Saudade/recordar (distância).** HIPÓTESE: "angolanos no estrangeiro/saudade (69 pedidos, 7,2%) respondem a 'não podes estar lá, manda a tua voz'". Métrica: L→P ≥10%.
4. **T4 — Casamento reenquadrado.** HIPÓTESE: "o casamento (9,1% pedidos) não compra em 'reaction de noivos' mas em 'presente dos padrinhos para os noivos' (1 decisão, 1 pagador)". Reformula D, não testa a mesma execução. Kill: $15 gastos, 0 compras → abandonar ocasião.
5. **T5 — Objeção-derrube (preço/Multicaixa).** HIPÓTESE: "um criativo que assume a objeção ('9.900 Kz, Multicaixa Express, música no WhatsApp em 24h') sobe initiate_checkout/lead acima dos 7,8% (88/1.124) da média". Métrica: checkout/lead; CTR é só diagnóstico.
6. **T6 — RT (recuperação).** HIPÓTESE: "os 976 `lyrics_ready` + 80 abandonos/mês reagem a 'guardámos o teu pedido — falta só o pagamento' com L→P ≥20% (5× o cold)". Produzir os 3 hooks de `CREATIVOS_RT_IA.md`; campanha PAUSED→ACTIVE com budget $5/dia; isolar de cold na leitura.

**Regra de leitura de testes (do prompt):** nunca declarar vencedor por CTR/implicações visuais — só por Purchase em janela ≥$15 gastos; empate → não se conclui.

---

## 9. Plano de produção (ordem)

1. **Semana 1:** RT (T6) — maior lacuna, demanda já quente, hooks prontos; + 2 criativos família C (T1: avô 03, pai 01).
2. **Semana 2:** T2 (agradecer) + T5 (objeção preço) — cobrem JTBD #2 e a maior perda de funil.
3. **Semana 3:** T3 (saudade) + T4 (casamento reenquadrado) + 1 variação de gestada (reduzir dependência do anúncio que é 31% das compras).
4. **Contínuo:** aplicar a regra freio automaticamente (CPA > $6.50 e spend > $15 → pausar) — hoje manual e falhou (menina).
5. **Produção:** formatos manter UGC/reaction (proven); 1º "processo/como funciona" e 1º "prova social" novos.

---

## 10. DADOS vs INFERÊNCIA vs HIPÓTESE

**DADOS (API Meta / BD / repo — verificáveis):**
- Todos os números de gasto/leads/compras/CPA/CTR/CPL (janelas 3d/7d/30d + lifetime 01/Jun→28/Set); inventário e status dos 19 anúncios; RT PAUSED com 0 anúncios; validação exata 214/7 e 21/5; agregados por família; ocasião×pagos (n=63), relações (86% casais), planos; funil 1.124→659→88→52 e o seu encaixe com 1.078→80→60; break-even documentado $7.29 (rodapé `verify`) e $8.30 (`PLANO_META_FASE2_FASE3.md` — **inconsistência: dois valores oficiais**); regra freio $6.50+$15; campanha $10/dia (3d gastou $33.61 → acima de $30, I: budget foi ajustado ou arredondamento de janelas).

**INFERÊNCIA (deduzido — confirmar):**
- Todo o conteúdo criativo (persona/ângulo/hook/emoção) derivado dos **nomes** dos anúncios; agrupamento em 5 famílias; `complete_registration` = evento intermédio do wizard; menina/casamento/doente pausados recentemente; mapeamento JTBD↔ocasiões.

**HIPÓTESE (a validar nos testes da secção 8):**
- Família C é o melhor crescimento; agradecer/saudade > declaração em intenção; casamento falhou por execução e não por ângulo; objeção-preço sobe checkout/lead; RT converte ≥20%; gestada não sofre fadiga imediata ao escalar; lead barato (A/B) não é alvo ideal.

**Não sabemos (marcar para medição):**
- Qual evento Meta equivale exatamente ao "lead" interno por criativo fora da API; demografia dos 52 compradores por anúncio (n=57 agregado só); se `Carlos chorão` (2 compras/1 lead) é sinal real ou ruído de atribuição; OCASIÃO dos compradores de cada anúncio.
