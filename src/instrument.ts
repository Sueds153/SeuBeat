import * as Sentry from '@sentry/react';
import type { ErrorEvent, EventHint } from '@sentry/browser';

const FB_WEBVIEW_NOISE: RegExp[] = [
  /window\.webkit\.messageHandlers/i,
  /webkit messagehandlers/i,
  /Java object is gone/i,
  /iabjs:\/\/navigation_performance_logger/i,
  /FBWebView/i,
];

function isFacebookWebviewNoise(event: ErrorEvent): boolean {
  const msg = event.message || '';
  if (FB_WEBVIEW_NOISE.some((re) => re.test(msg))) return true;
  const url = event.request?.url || '';
  if (/\biabjs:/i.test(url)) return true;
  const tags = event.tags || {};
  return typeof tags.browser === 'string' && /facebook/i.test(tags.browser);
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  tracePropagationTargets: ['localhost', /^https:\/\/seubeat\.onrender\.com/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event: ErrorEvent, hint: EventHint) {
    const originalException = hint?.originalException;
    if (originalException instanceof Error) {
      if (FB_WEBVIEW_NOISE.some((re) => re.test(originalException.message))) return null;
    }
    if (isFacebookWebviewNoise(event)) return null;
    return event;
  },
});
