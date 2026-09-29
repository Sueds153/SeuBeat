import { useEffect, useRef, useState } from 'react';

/**
 * Contador de músicas entregues apresentado na landing.
 *
 * Número apresentado (fictício mas credível — nunca arredondado):
 * - Base fixa não arredondada (107).
 * - Deriva diária determinística: +0–11 por dia (mesmo número para todos os
 *   visitantes durante o dia — evita contradições entre sessões/abas).
 * - Deriva lenta de sessão: +1 por cada 90 min na página, máx +5 (dá sensação
 *   de operação viva em sessões longas sem saltos visíveis).
 */
const DELIVERED_BASE = 107;

/** Hash simples e estável de string → inteiro não negativo. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deriva diária: 0–11 novas entregas por dia, estável durante todo o dia. */
function dailyDrift(date: Date): number {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return hashString(`seubeat-delivered-${key}`) % 12;
}

/** Deriva de sessão: +1 por cada 90 min na página, máx +5. */
function sessionDrift(sessionStartMs: number, nowMs: number): number {
  return Math.min(5, Math.floor((nowMs - sessionStartMs) / (90 * 60 * 1000)));
}

/** Número apresentado para um dado momento. Exportado para testes. */
export function deliveredCountAt(now: Date, sessionStartMs: number): number {
  const base = DELIVERED_BASE + dailyDrift(now) + sessionDrift(sessionStartMs, now.getTime());
  // Nunca apresentar múltiplos de 10 (parecem arredondados/fictícios):
  // +1 determinístico mantém a estabilidade por dia/sessão.
  return base % 10 === 0 ? base + 1 : base;
}

/**
 * Hook: devolve o número de entregues a apresentar (estável por dia,
 * com deriva lenta em sessões longas — reavaliado a cada `tickMs`).
 */
export function useDeliveredCount(tickMs = 10 * 60 * 1000): number {
  const sessionStartRef = useRef<number>(Date.now());
  const [count, setCount] = useState(() => deliveredCountAt(new Date(), sessionStartRef.current));

  useEffect(() => {
    const id = setInterval(() => {
      setCount(deliveredCountAt(new Date(), sessionStartRef.current));
    }, tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return count;
}
