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

// Create the Express app
const appPromise = createApp();

// Export the app as the default handler for Vercel
export default async (req: Request, res: Response) => {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error('Error in serverless function:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};