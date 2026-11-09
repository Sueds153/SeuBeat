// Vercel Serverless Function entry point - only exports the Express app
// This file is bundled separately by esbuild for the serverless function

import 'dotenv/config';
import type { Request, Response } from 'express';

// Initialize Sentry if DSN is provided (async IIFE for top-level await)
if (process.env.SENTRY_DSN) {
  (async () => {
    try {
      const { init } = await import('@sentry/node');
      init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'production',
        tracesSampleRate: 0.1,
      });
    } catch (err) {
      console.warn('[WARN] Erro ao inicializar Sentry (ignorando para manter o servidor ativo):', err);
    }
  })();
}

import { createApp } from '../server/config/app';

console.log('[Vercel] Starting serverless function...');
console.log('[Vercel] Environment:', process.env.NODE_ENV);
console.log('[Vercel] VERCEL:', process.env.VERCEL);

// Create the Express app
const appPromise = createApp().catch(err => {
  console.error('[Vercel] Failed to create app:', err);
  throw err;
});

// Export the app as the default handler for Vercel
export default async (req: Request, res: Response) => {
  console.log('[Vercel] Request received:', req.method, req.url);
  try {
    const app = await appPromise;
    console.log('[Vercel] App ready, handling request');
    return app(req, res);
  } catch (err) {
    console.error('[Vercel] Error in serverless function:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};