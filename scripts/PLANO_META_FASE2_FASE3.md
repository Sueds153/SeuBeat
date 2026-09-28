# SeuBeat — Plano Meta Ads: Fase 2 (Funil) e Fase 3 (Media Buying)

> Origem: auditoria Meta Ads / Pixel / CAPI / Funil (20 partes, dados reais de produção).
> **Fase 1 (Tracking)** — concluída e validada (505 testes, `tsc` limpo, build OK).
> Este documento guarda as fases 2 e 3 para execução futura. Atualizado a 28/Set 2026.

## Números de referência (base do plano)

| Métrica | Valor | Nota |
| --- | --- | --- |
| Spend (janela da auditoria) | $411.54 | 98,5% em `mobile_app` |
| Purchase (AM / EM) | 54 / 63 | dedup = mesmo `event_id`+`event_name` por Pixel ID em 48h |
| Pagamentos aprovados | 60 | receita 610.180 Kz · AOV 10.170 Kz |
| CAC / ROAS | $6.86 / 1.24–1.31 | **break-even CAC ≈ $8.30** |
| Funil | 1.078 pedidos → 80 submissões (7,4%) → 60 aprovados | queda na submissão de pagamento |
| Pool por recuperar | 976 pedidos `lyrics_ready` sem pagamento | maior ativo do funil |
| Rejeições | 18 (14 sem motivo) | motivo passou a obrigatório no admin |

---

## Fase 2 — Funil (site + CRM) · objetivo: submissão de pagamento 7,4% → ≥12%

| # | Ação | Detalhe | Prioridade |
| --- | --- | --- | --- |
| 2.1 | **Recuperar o pool `lyrics_ready`** | 976 pedidos com letra pronta e sem pagar: campanha de email + WhatsApp segmentada (já existe scheduler 30min/24h/48h/72h) — reutilizar buckets e `abandonedRecoveryScheduler.ts`. CTA = `/wizard?resume=<id>&step=payment` | Alta |
| 2.2 | **4º lembrete "7 dias"** | O scheduler pára aos 72h e há ~160 leads com >72h que nunca mais são contactados — novo bucket em `abandonedRecoveryScheduler.ts` + flag `abandoned_7d_sent_at` + migration (mesmo padrão dos 4 atuais) | Alta |
| 2.3 | **Reduzir fricção no pagamento** | Multicaixa Express já pré-selecionado ("MAIS RÁPIDO"); reforçar copy do passo 5 com tempo médio de aprovação + WhatsApp de ajuda. Alvo: submissão 7,4% → 12% | Alta |
| 2.4 | **Analisar rejeições** | 14/18 sem motivo antes da obrigatoriedade; com `notes` obrigatório (Fase 1) categorizar motivos e corrigir causa raiz (comprovativos mal fotografados → copy/dica de foto) | Média |
| 2.5 | **Follow-ups pós-entrega** | 7d/30d já ativos (`delivered_at` corrigido) — medir reativação e preparar upsell (video-upsell 2.900 Kz) | Média |
| 2.6 | **Instrumentação de funil** | Métricas já existem (`payment_screen`, `resume-data`, aba Métricas/Lucratividade) — acompanhar semanalmente: criados → letras → submissões → aprovados → entregues | Contínuo |

---

## Fase 3 — Media Buying · objetivo: CPA ≤ $6.50 com $10/dia

| # | Ação | Estado | Detalhe |
| --- | --- | --- | --- |
| 3.1 | Orçamento **$10/dia** | ✅ decidido | cold `120248973060170708` mantém $10; RT $2 (só quando publicado) |
| 3.2 | Reduzir para **2–3 anúncios** | ⏳ manual (Ads Manager) | hoje ~10 anúncios no cold; manter vencedores históricos + 1 novo ângulo |
| 3.3 | **Exclusão de compradores** | ✅ **FEITO (28/Set)** | `EXCL - Compradores 180d` `120250568225030708` aplicado **e verificado por leitura** no adset RT (`120250568232860708`) e no cold (`120248973060180708`) via `node scripts/meta-direct.mjs exclude-buyers --live` |
| 3.4 | **Retargeting publicado** | ⏳ à espera de criativos | campanha `SeuBeat_Retargeting` `120250568225420708` **PAUSED**, adset `rt_checkout_14d` PAUSED **com 0 anúncios** — publicar (toggle ACTIVE) só depois de o criativo entrar |
| 3.5 | Attribution **7d click / 1d view** | ✅ | igual em cold e RT (`attribution_spec`) — verificar com `node scripts/meta-direct.mjs attribution` |
| 3.6 | **Regra `freio_CPA`** | ⏳ manual / dia | pausar anúncio com **CPA > $6.50 e spend > $15**; break-even $8.30 — histórico: `teste_casamento` $5.60 sem compra |
| 3.7 | **Criativos RT** | ⏳ utilizador | presets UGC 9:16 em `scripts/CREATIVOS_RT_IA.md` + ângulos em `scripts/CONCORRENTES_META.md`; copy já sugerida pelo script `create-retargeting` |
| 3.8 | Monitorização diária | ✅ script | `node scripts/meta-direct.mjs verify 3` (spend/CTR/CPA por anúncio) |
| 3.9 | Lookalike (LAL) | ❌ adiado | só se RT escalar com CPA ≤ $5 no dia 5–7 |

### Decisões já tomadas (não rever sem pedido)
- Compra reportada em **AOA** (browser + servidor); `Purchase` na submissão do comprovativo, `Refund` só com `meta_purchase_sent_at`.
- Domínio **só `https://seubeat.onrender.com`** (sem trabalho de DNS/custom domain nesta ronda).
- Sem contas/campanhas novas até as atuais mostrarem CPA ≤ break-even.

### Comandos úteis
```bash
node scripts/meta-direct.mjs verify 3              # insights cold (3 dias)
node scripts/meta-direct.mjs exclude-buyers        # dry-run da exclusão
node scripts/meta-direct.mjs exclude-buyers --live # aplica (RT + cold), mantém RT PAUSED
node scripts/meta-direct.mjs pause <ad_id|adset_id>
node scripts/meta-direct.mjs attribution           # mostra/altera attribution do cold
```

### Notas técnicas da exclusão (Fase 3.3)
- Desde a **Marketing API v22 (jan/2025)** a Meta removeu `targeting.exclusions.custom_audiences` — daí o erro **#1487916** ("campos de definição de público-alvo duplicados") e **#1870221**.
- O campo atual é **`targeting.excluded_custom_audiences`** (docs: *Advanced Targeting*), escrito com a versão **v25.0** e sempre ecoando o targeting completo (o POST substitui o objeto inteiro).
- Escrita confirmada por leitura: `GET /{adset}?fields=targeting` devolve `excluded_custom_audiences`.
- Endpoint de adset aceita **~1 POST / 30s** (`error_subcode 4841018`) — o script respeita isso com sleep.
- Alterações observadas no adset cold ao escrever: `location_types` ganhou `frequently_in` (normalização Meta) e `targeting_automation.individual_setting` deixou de ser devolvido (`advantage_audience` continua `1`). Nada funcional foi perdido.
