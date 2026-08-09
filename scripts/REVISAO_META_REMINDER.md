# REVISÃO META ADS — LEMBRETE (criado 04/08/2026)

> Lembrar o utilizador de reavaliar a campanha `SeuBeat_teste` após ~3 dias.

## ÚLTIMA AÇÃO (08/08/2026)
- 🔴 **`teste_marido_claudino` PAUSADO à mão** — CPA 3d $10.30 / 30d $7.42 (acima do break-even ~$7.29 e da regra $6.50). Era o maior queimador: ~70% do orçamento 3d ($20.59) com 53% do gasto 30d ($29.69). Converteu mais em volume (4) mas com prejuízo.
- ✅ Ficam **4 ATIVOS**: `teste_wife_car` ($1.53), `Teste_mulher triste_car` ($1.77), `teste_man in car - henriques` ($2.89), `teste_senhora no quintal` ($4.42).
- ⚠️ CPA global 3d $8.05 > break-even — mas era o claudino a puxar; orçamento libertado (~$7/dia) realoca automaticamente para os vencedores.

## Próximo check: DIA 5 (≈ 10/08/2026)

### Como verificar (via API, pedir ao assistente para correr)
```bash
$env:META_ACCESS_TOKEN="<token do opencode.json: mcp.meta-ads.environment.META_ACCESS_TOKEN>"
node "scripts/meta-direct.mjs" verify
```
- Melhor: pedir ao assistente: *"corre a análise dos últimos 3 dias da campanha SeuBeat_teste"*.

### Checklist do Dia 5
1. **[ ]** Correr análise dos últimos 3 dias (compras + CPA por anúncio).
2. **[ ]** Conferir os 4 anúncios ATIVOS — compras e CPA por anúncio.
3. **[ ]** Confirmar que o orçamento libertado pelo claudino foi para os vencedores (mulher triste_car / wife_car / henriques / no quintal) e que o CPA global baixou para ≤ $5.
4. **[ ]** Se algum ativo tiver CPA > $6.50 e gasto > $15 → pausar (regra `freio_CPA` apertada).
5. **[ ]]** Confirmar CPA global ≤ $4-5.

## Pontos de decisão futuros (acordados)
- **Dia 7**: se algum vencedor tiver CPA <$2 → considerar subir para $15/dia.

## Estado implementado em 04/08/2026
- ✅ Orçamento: $4/dia → **$10/dia**
- ✅ Pausados (0 conversões): `Teste_marido_car - noite`, `teste_wife_car - careca`, `teste_mãe_car`, `Teste_marido_car - PAULO`
- ✅ Pausado em 08/08 (CPA degradado): `teste_marido_claudino`, `teste_senhora MAKEUP`
- ✅ Ativos (4): `teste_wife_car`, `teste_man in car - henriques`, `Teste_mulher triste_car`, `teste_senhora no quintal`
- ✅ Regra automática `freio_CPA` — **AJUSTAR para CPA > $6.50 / gasto > $15 → pausar** (decisão 08/08, mais reativa; break-even ~$7.29)
- ℹ️ Atribuição: bloq. pela Meta (7d/1d mantida)

## Lucro líquido (câmbio 1.200 Kz/USD, sem taxas/custos fixos)
- Custo por venda: CPA $4.08 (4.896 Kz) + música $0.13 (156 Kz) ≈ **5.052 Kz**
- Lucro líquido/venda: Standard 7.900→**2.848 Kz** (36%) | Express 9.900→**4.848 Kz** (49%) | Premium 14.900→**9.848 Kz** (66%)
- Por dia (2-3 vendas, mix St+Ex): **~7.700–11.500 Kz/dia** → **~230k–346k Kz/mês**
- **Break-even**: CPA máx ~$7.29 (média) / ~$6.45 (só Standard). Regra `freio_CPA` deve cortar a $6.50.
- ⚠️ CPA > $8 → prejuízo no Standard.

### Referência de compras (30d, 09/07–08/08)
| Anúncio | Gasto | Compras | CPA |
|---|---|---|---|
| Teste_mulher triste_car | $3.53 | 2 | $1.77 ⭐ |
| teste_wife_car | $1.53 | 1 | $1.53 ⭐ |
| teste_man in car - henriques | $2.89 | 1 | $2.89 |
| teste_senhora no quintal | $13.27 | 3 | $4.42 |
| teste_marido_claudino (pausado 08/08) | $29.69 | 4 | $7.42 🔴 |
| teste_mãe_car (pausado) | $0.86 | 0 | — |
| Teste_marido_car - PAULO (pausado) | $0.57 | 0 | — |
| teste_senhora MAKEUP (pausado) | $3.76 | 0 | — |
| Teste_marido_car - noite (pausado) | $0.21 | 0 | — |
| teste_wife_car - careca (pausado) | $0.28 | 0 | — |
| **Total** | **$56.59** | **11** | **$5.14** |