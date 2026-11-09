// Vercel Serverless Function entry point
// This exports the Express app as a serverless function

import { createApp } from '../server/config/app';

// Initialize Sentry if DSN is provided
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

// Export the app as the default handler for Vercel
export default app;