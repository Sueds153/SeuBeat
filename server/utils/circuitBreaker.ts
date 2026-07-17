import { logWarn, logError, logInfo } from './logger';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  name: string;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

const breakers = new Map<string, CircuitBreakerState>();

export function createCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): {
  exec<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitState;
  reset(): void;
} {
  const opts: CircuitBreakerOptions = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60_000,
    name,
    ...options,
  };

  const state: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0,
  };

  breakers.set(name, state);

  return {
    getState: () => state.state,
    reset: () => {
      state.state = 'closed';
      state.failures = 0;
      state.successes = 0;
      state.nextAttemptTime = 0;
    },
    async exec<T>(fn: () => Promise<T>): Promise<T> {
      if (state.state === 'open') {
        if (Date.now() >= state.nextAttemptTime) {
          state.state = 'half-open';
          logWarn(`[CircuitBreaker:${opts.name}] Half-open, tentando novamente`);
        } else {
          throw new Error(`Circuito aberto para ${opts.name}. Tentar novamente em ${Math.ceil((state.nextAttemptTime - Date.now()) / 1000)}s.`);
        }
      }

      try {
        const result = await fn();
        state.successes++;
        state.failures = 0;
        if (state.state === 'half-open' && state.successes >= opts.successThreshold) {
          state.state = 'closed';
          state.successes = 0;
          logInfo(`[CircuitBreaker:${opts.name}] Circuito fechado após ${opts.successThreshold} sucessos`);
        }
        return result;
      } catch (err) {
        state.failures++;
        state.lastFailureTime = Date.now();
        if (state.failures >= opts.failureThreshold) {
          state.state = 'open';
          state.nextAttemptTime = Date.now() + opts.timeout;
          logError(`[CircuitBreaker:${opts.name}] Circuito aberto após ${state.failures} falhas`, err instanceof Error ? err : undefined);
        }
        throw err;
      }
    },
  };
}