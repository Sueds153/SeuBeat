declare module '@sentry/node' {
  export function init(options: {
    dsn?: string;
    environment?: string;
    tracesSampleRate?: number;
    [key: string]: unknown;
  }): void;
  export function setupExpressErrorHandler(app: import('express').Application): void;
}

declare module '@sentry/react' {
  export function init(options: {
    dsn?: string;
    environment?: string;
    integrations?: unknown[];
    tracesSampleRate?: number;
    tracePropagationTargets?: (string | RegExp)[];
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
    [key: string]: unknown;
  }): void;
  export function browserTracingIntegration(): unknown;
  export function replayIntegration(options?: { maskAllText?: boolean; blockAllMedia?: boolean }): unknown;
  export function reactErrorHandler(): (error: unknown, errorInfo: unknown) => void;
  export function captureException(error: Error, context?: { contexts?: Record<string, Record<string, unknown>> }): string;
}
