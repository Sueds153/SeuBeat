# Criativos RT — vídeo UGC gerado por IA (SeuBeat)

Adset: `rt_checkout_14d` (`120250568232860708`) · Campanha `SeuBeat_Retargeting` (`120250568225420708`) · **PAUSED até aprovares**  
Ângulo: continuidade checkout (não cold) · IA: **Kling 3.0** (ou Runway image→video) · Formato: **9:16**, 10–15s  
Base: `CONCORRENTES_META.md` secção RT (SGAI) · Preços: 7.900 / 9.900 / 14.900 Kz

---

## 1. Preset visual partilhado (colar em cada prompt)

```
UGC smartphone video, vertical 9:16, handheld with slight natural camera shake,
authentic phone-shot look, soft natural window light, real modest Angolan apartment
living room, simple casual clothes, shallow depth of field, 1080p, realistic not
cinematic commercial, no studio lighting, no text overlay, no watermark,
documentary authentic feel, 5 seconds
```

**Personagem (consistente — gerar 1ª imagem → image-to-video):**  
Black African woman, early 30s, natural hair, warm smile, simple modern casual top, Luanda apartment background, photorealistic iPhone photo quality, no makeup glam, natural daylight.

---

## 2. 3 hooks (1 persona × 3 = pack de teste)

### Hook A — Continuidade / “quase pronta” (prioritário RT)

```
[PRESET] Black African woman early 30s holds her smartphone up to camera showing a colorful app screen, 
slightly relieved smile, looks at camera then back at phone, nods as if deciding to continue a purchase, 
indoor evening warm light, emotion: hopeful relief, authentic UGC reaction
```

**Legenda (editor, não IA):** `A tua música está quase pronta`  
**Cut:** 0–1.5s rosto+telemóvel · 1.5–4s close ecrã (mockup real) · 4–5s sorriso + CTA overlay

### Hook B — Reacção emocional (prova do produto)

```
[PRESET] Black African woman puts wireless earbuds in, eyes widen with surprise then fill with tears of joy, 
hand over mouth, soft cry of happiness, listening to music from phone, intimate bedroom moment, 
emotional authentic first reaction, slight camera shake, 5 seconds
```

**Legenda:** `A reacção dela quando ouviu…`  
**Cut:** 0–2s pôr auscultadores · 2–4.5s emoção (lágrimas/surpresa) · 4.5–5s texto “Feito para a tua história”

### Hook C — Multicaixa / confiança pagamento

```
[PRESET] Black African woman smiles with confidence while holding phone showing a payment confirmation gesture, 
thumbs up to camera, relaxed home setting, trustworthy friendly vibe, clear positive body language, 
natural light through window, UGC selfie angle, 5 seconds
```

**Legenda:** `Multicaixa → WhatsApp. Continua onde paraste.`  
**Cut:** 0–2s confiança · 2–4s mock Multicaixa (gráfico no editor) · 4–5s CTA

---

## 3. Variante por cena (iterar barato)

| Cena | A (continuidade) | B (reação) | C (confiança) |
|------|------------------|------------|-----------------|
| 1 Hook | telemóvel em mão, “quase pronta” | auscultadores + surpresa | sorriso + “Multicaixa OK” |
| 2 Produto | close mockup wizard | close ouvidos + música | mock pagamento |
| 3 Emoção | sorriso aliviado | lágrimas aleges | thumbs-up |
| 4 CTA | overlay “Continuar” | overlay “Cria a tua” | overlay “Paga agora” |

**3 variantes de prompt por hook** = trocar apenas a acção da câmara (ex.: A2 “scrolls phone”; A3 “shows phone to friend off-screen”).

---

## 4. Estrutura de montagem (CapCut / editor)

1. **0–0.3s** — hook visual (rosto ou ecrã) + som ambiente  
2. **0.3–3s** — cena principal + legenda hook  
3. **3–7s** — prova (reação ou mockup Multicaixa/wizard)  
4. **7–12s** — CTA + preço opcional (`desde 7.900 Kz`)  
5. **12–15s** — logo SeuBeat + URL `seubeat.onrender.com/wizard`

- **Texto/num só no editor** (IA falha em texto legível)  
- Música: excerto licenciado ou silence + VO (se VO: PT-AO simples)  
- Export: 1080×1920, 30fps, MP4

---

## 5. Copy Meta ad (para o adset RT)

**Primary A (default):**  
> A tua música está quase pronta — falta só o pagamento.  
> Guardámos o teu pedido no SeuBeat. Continua onde paraste em 1 minuto.  
> Multicaixa Express ou Referência · entrega no WhatsApp.

**Primary B:**  
> 7 em cada 10 carrinhos ficam a meio. O teu pode ser dos que voltam.  
> A letra já está guardada — só falta o Multicaixa. Continua o teu pedido →

**Primary C:**  
> Quando ouvirem a música com o nome deles, vão se emocionar.  
> Não deixes o presente a meio. Continua onde paraste · desde 7.900 Kz

| Campo | Valor |
|-------|--------|
| Headline | Continua onde paraste |
| Description | Multicaixa · Entrega no WhatsApp |
| CTA | Shop Now (ou Complete Purchase se disponível) |
| URL | `https://seubeat.onrender.com/wizard` |

---

## 6. Checklist Meta / ética IA

- [ ] Vídeo gerado por IA → esperar label **“AI info”** ao lado de “Sponsored” (fotorealismo humano)  
- [ ] **Não** afirmar “reação de cliente real” se for IA — usar “inspirado em reacções reais” se precisar de texto  
- [ ] Sem deepfake de pessoas reais sem consentimento  
- [ ] Texto/legenda/num **só no editor**  
- [ ] Exclusão `EXCL - Compradores 180d` confirmada no Ads Manager  
- [ ] Criar **1 ad** no adset `rt_checkout_14d` com este vídeo + copy A  
- [ ] Manter campanha/adset **PAUSED** até aprovares  
- [ ] Publicar → regra freio: CPA >$6.50 e >$10 gasto → pausar; CPA ≤$5 no dia 5–7 → $2→$4

---

## 7. Próximos passos

1. Gerar imagem personagem (fotorealista) → animar cenas A/B/C em Kling  
2. Montar 1 vídeo final 15s (Hook A como vencedor esperado)  
3. Criar ad no Ads Manager (ou `meta-direct.mjs create-ad` quando existir ação)  
4. Confirmar exclusão compradores → publicar  
5. Dia 5–7: `node scripts/meta-direct.mjs verify 7`

**Créditos SGAI:** ~267 restantes (busca RT raw feita; síntese manual acima).  
**Estado:** pack de prompts pronto para geração — vídeo ainda não gerado/ad não criado.
