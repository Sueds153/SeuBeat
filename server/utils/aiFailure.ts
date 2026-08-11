export interface AIProviderFailureSummary {
  provider: string;
  kind: string;
  message: string;
}

export const LYRIC_GENERATION_QUEUED_MESSAGE =
  'O serviço de geração está temporariamente sobrecarregado. Guardámos o teu pedido — vamos gerar a tua música automaticamente e avisamos por email.';

// Devolve true quando o array de falhas de providers existe, não é vazio e TODOS
// são transitórios (503/429/tempo limite) — sem falhas de créditos, config ou auth.
// Nesse cenário a geração é recuperada em background pelo failedLyricsRecoveryScheduler.
export function allFailuresTransient(failures: unknown): failures is AIProviderFailureSummary[] {
  return (
    Array.isArray(failures) &&
    failures.length > 0 &&
    failures.every((f) => f && typeof f === 'object' && (f as AIProviderFailureSummary).kind === 'transient')
  );
}
