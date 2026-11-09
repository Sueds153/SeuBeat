// Vercel Serverless Function entry point
// This exports the Express app as a serverless function

import { createApp, startSchedulers } from '../server/config/app';

// Initialize Sentry if DSN is provided (same as server.ts)
if (process.env.SENTRY_DSN) {
  try {
    const { init } = await import('@sentry/node');
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
    });
  } catch (err) {
    console.warn('[WARN] Erro ao inicializar Sentry na Vercel:', err);
  }
}

// Create the Express app
const app = await createApp();

// Start background schedulers (lazy, idempotent - only runs once per instance)
// On Vercel, function instances are kept warm between requests, so schedulers will run
let schedulersStarted = false;
function ensureSchedulersStarted() {
  if (!schedulersStarted) {
    schedulersStarted = true;
    try {
      startSchedulers();
    } catch (err) {
      console.error('Failed to start schedulers:', err);
    }
  }
}

// Middleware to ensure schedulers are running on each request
// (Vercel reuses function instances; this guarantees they're running)
app.use((_req, _res, next) => {
  ensureSchedulersStarted();
  next();
});

// Export the app as the default handler for Vercel
export default app;