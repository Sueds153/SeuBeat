import { describe, it, expect } from 'vitest';
import { deliveredCountAt, credibleFunnelAt } from '../lib/deliveredCount';

/**
 * Piso credível de entregues apresentado na landing.
 * "0 entregues" destrói confiança — o número tem de ser sempre ≥107,
 * nunca arredondado, e estável entre sessões/abas do mesmo dia.
 */
describe('deliveredCountAt — piso credível de entregues', () => {
  it('nunca abaixo de 107 (piso credível)', () => {
    const now = new Date('2026-09-29T12:00:00');
    const sessionStart = now.getTime() - 5 * 60 * 1000; // 5 min de sessão
    expect(deliveredCountAt(now, sessionStart)).toBeGreaterThanOrEqual(107);
  });

  it('nunca arredondado (não termina em 0)', () => {
    // Varre 120 dias — a base 107 + drift 0-11 pode ocasionalmente acabar em 0;
    // se tal acontecer, é um bug do piso (número "redondo" parece falso).
    for (let day = 0; day < 120; day++) {
      const now = new Date(2026, 0, 1 + day, 12, 0, 0);
      const sessionStart = now.getTime();
      const n = deliveredCountAt(now, sessionStart);
      expect(n % 10).not.toBe(0);
    }
  });

  it('estável durante o mesmo dia para visitantes que chegam (drift de sessão ≈ 0)', () => {
    // O drift de sessão (+1/90min) é intencional; para visitantes frescos o número
    // do dia é o mesmo — evita contradições entre abas/sessões no mesmo dia.
    const sessionStart1 = new Date('2026-09-29T10:00:00').getTime() - 5 * 60 * 1000;
    const sessionStart2 = new Date('2026-09-29T17:00:00').getTime() - 5 * 60 * 1000;
    const morning = deliveredCountAt(new Date('2026-09-29T10:00:00'), sessionStart1);
    const afternoon = deliveredCountAt(new Date('2026-09-29T17:00:00'), sessionStart2);
    expect(morning).toBe(afternoon);
  });

  it('deriva diária determinística: dois dias diferentes podem divergir (0-11)', () => {
    const sessionStart = new Date('2026-09-29T09:00:00').getTime();
    const a = deliveredCountAt(new Date('2026-09-29T09:00:00'), sessionStart);
    const b = deliveredCountAt(new Date('2026-09-30T09:00:00'), sessionStart);
    expect(a).toBeGreaterThanOrEqual(107);
    expect(b).toBeGreaterThanOrEqual(107);
    expect(b - a).toBeGreaterThanOrEqual(-11); // nunca salta para baixo além do drift
  });

  it('deriva de sessão: +1 por 90 min, máximo +5', () => {
    const now = new Date('2026-09-29T12:00:00');
    const start = now.getTime();
    const short = deliveredCountAt(now, start);
    const long4h = deliveredCountAt(now, start - 4 * 60 * 60 * 1000);
    const long12h = deliveredCountAt(now, start - 12 * 60 * 60 * 1000);
    expect(long4h - short).toBeLessThanOrEqual(3); // 4h ≈ 2 increments (270m) → +2
    expect(long12h - short).toBeLessThanOrEqual(5); // cap de +5
    expect(long12h).toBeGreaterThanOrEqual(short);
  });

  it('funil credível: pagantes > entregues, nunca redondos', () => {
    for (let day = 0; day < 90; day++) {
      const now = new Date(2026, 0, 1 + day, 12, 0, 0);
      const f = credibleFunnelAt(now, now.getTime());
      expect(f.paid).toBeGreaterThan(f.delivered); // alguém está sempre em produção
      expect(f.express).toBeGreaterThanOrEqual(1);
      expect(f.express).toBeLessThanOrEqual(f.paid);
      expect(f.paid % 10).not.toBe(0);
      // Rácio Express ~60% (real 34/57)
      expect(f.express / f.paid).toBeGreaterThan(0.5);
      expect(f.express / f.paid).toBeLessThanOrEqual(0.65);
    }
  });
});
