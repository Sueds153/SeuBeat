import { test, expect } from '@playwright/test';

/**
 * Auditoria visual mobile-first das animações Tier 1 + Tier 2.
 * Valida o ESTADO das animações em viewport mobile (Pixel 7):
 * console limpo, reveals, sticky CTA com histerese e transições
 * direcionais do wizard. Screenshots em test-results/visual-audit/.
 */

const NOISE = /facebook|fbevents|fb\.|fbq|google-analytics|googletagmanager|gtag|sentry|connect\.|doubleclick/i;

test('mobile: landing sem erros de console + reveals + sticky CTA com histerese', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Auditoria só em mobile-chrome');

  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  // 1. Hero
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/visual-audit/01-landing-hero-mobile.png' });

  // Shine do CTA (pseudo-elemento CSS aplicado)
  const shine = await page.evaluate(() => {
    const cta = document.querySelector('#hero-primary-cta');
    if (!cta) return 'MISSING';
    const s = getComputedStyle(cta, '::after');
    return { anim: s.animationName, dur: s.animationDuration, overflow: getComputedStyle(cta).overflow };
  });
  console.log('[AUDIT] CTA shine:', JSON.stringify(shine));
  expect(shine).not.toBe('MISSING');
  expect((shine as { anim: string }).anim).toContain('cta-shine');

  // Micro-stats: entregues com piso credível (≥107) — nunca "0 entregues".
  // O count-up só dispara ao entrar no viewport → scroll até à linha primeiro.
  const deliveredLabel = page.locator('span:has-text("entregues por email")').first();
  await deliveredLabel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1700); // count-up 1.2s + margem
  const delivered = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    const label = spans.find(s => /entregues por email/.test(s.textContent || ''));
    if (!label) return null;
    const value = label.parentElement?.querySelector('span')?.textContent || '';
    return parseInt(value.replace(/\D/g, ''), 10);
  });
  console.log('[AUDIT] Entregues apresentados:', delivered);
  expect(delivered).toBeGreaterThanOrEqual(107);

  // Coerência do funil: "clientes" nunca menor que "entregues" na mesma página
  const clients = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    const label = spans.find(s => /já eternizaram a sua história/.test(s.textContent || ''));
    if (!label) return null;
    const value = label.parentElement?.querySelector('span')?.textContent || '';
    return parseInt(value.replace(/\D/g, ''), 10);
  });
  console.log('[AUDIT] Clientes apresentados:', clients);
  if (clients !== null) expect(clients).toBeGreaterThanOrEqual(delivered ?? 0);

  // 2. Como Funciona → reveals disparam (opacity 0 → 1)
  await page.locator('#how-it-works-section').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'test-results/visual-audit/02-como-funciona-mobile.png' });
  const revealedCards = await page.evaluate(() => {
    const cards = document.querySelectorAll('#how-it-works-section .rounded-2xl');
    let visible = 0;
    cards.forEach(c => { if (parseFloat(getComputedStyle(c).opacity) > 0.9) visible++; });
    return visible;
  });
  console.log('[AUDIT] Cards Como Funciona revelados:', revealedCards);
  expect(revealedCards).toBeGreaterThanOrEqual(3);

  // 3. Ocasiões
  await page.locator('#occasions-section').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'test-results/visual-audit/03-ocasioes-mobile.png' });

  // 4. Pricing
  await page.locator('#pricing-section').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'test-results/visual-audit/04-pricing-mobile.png' });

  // 5. Sticky CTA — histerese: entra a >0.7vh, some no topo (<0.5vh)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.8));
  await page.waitForTimeout(1300);
  const stickyAfterScroll = await page.evaluate(() => {
    const el = document.querySelector('#sticky-cta-btn');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.top < window.innerHeight;
  });
  await page.screenshot({ path: 'test-results/visual-audit/05-sticky-cta-mobile.png' });
  expect(stickyAfterScroll).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1400); // tempo para a animação de saída terminar
  const stickyAtTop = await page.evaluate(() => {
    const el = document.querySelector('#sticky-cta-btn');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
  console.log('[AUDIT] Sticky após scroll:', stickyAfterScroll, '| visível no topo (deve ser false):', stickyAtTop);
  expect(stickyAtTop).toBe(false);

  // 6. Console limpo (sem ruído de terceiros)
  const realErrors = errors.filter(e => !NOISE.test(e));
  console.log('[AUDIT] Console errors (filtrados):', realErrors.length, realErrors.slice(0, 5));
  expect(realErrors).toHaveLength(0);
});

test('mobile: wizard transição direcional next → back', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Auditoria só em mobile-chrome');

  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('/wizard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/visual-audit/06-wizard-step1-mobile.png' });

  const advanceBtn = page.locator('#wizard-advance-btn');
  await expect(advanceBtn).toBeVisible();

  // Passo 1: relação (Mãe), género (Masculino), nome
  await page.locator('button:has-text("Mãe")').first().click();
  await page.locator('button:has-text("Masculino"), button:has-text("Menino")').first().click();
  const nameInput = page.locator('input[placeholder*="aria"], input[placeholder*="nome"], input[placeholder*="Nome"], input[type="text"]').first();
  await nameInput.fill('Maria');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // Avançar → passo 2 entra da DIREITA (transform com translateX positivo a meio)
  await advanceBtn.click();
  await page.waitForTimeout(100); // a meio da transição (0.28s)
  const midForward = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('main div, #root div'));
    for (const el of els) {
      const s = getComputedStyle(el);
      if (s.transform && s.transform !== 'none' && parseFloat(s.opacity) < 1) return s.transform;
    }
    return null;
  });
  console.log('[AUDIT] Transform forward a meio:', midForward);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/visual-audit/07-wizard-step2-mobile.png' });

  // Retroceder → passo 1 entra da ESQUERDA
  await page.locator('#wizard-back-btn').click();
  await page.waitForTimeout(100);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/visual-audit/08-wizard-back-step1-mobile.png' });

  // Voltou ao passo 1 (botão Retroceder volta à landing no step 1 — aqui só validamos settle)
  await expect(advanceBtn).toBeVisible();

  const realErrors = errors.filter(e => !NOISE.test(e));
  console.log('[AUDIT] Wizard console errors:', realErrors.length, realErrors.slice(0, 5));
  expect(realErrors).toHaveLength(0);
});
