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
  console.log('[Vercel] Request body type:', typeof req.body, Array.isArray(req.body) ? 'array' : 'object');
  console.log('[Vercel] Request body:', JSON.stringify(req.body).slice(0, 200));
  
  // Test endpoint to debug body parsing
  if (req.url === '/api/_test-body') {
    return res.json({ method: req.method, body: req.body, headers: req.headers });
  }
  
  try {
    const app = await appPromise;
    console.log('[Vercel] App ready, handling request');
    
    // Add timeout to detect hangs
    const timeout = setTimeout(() => {
      console.error('[Vercel] Request timeout after 30s');
      if (!res.headersSent) {
        res.status(504).json({ success: false, error: 'Request timeout' });
      }
    }, 30000);
    
    const result = await app(req, res);
    clearTimeout(timeout);
    console.log('[Vercel] Request completed');
    return result;
  } catch (err) {
    console.error('[Vercel] Error in serverless function:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};