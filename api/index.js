// Vercel Serverless Function entry point (CommonJS compatible with top-level await wrapper)
// This exports the Express app as a serverless function

require('dotenv').config();

const { createApp } = require('../server/config/app.js');

// Initialize Sentry if DSN is provided
if (process.env.SENTRY_DSN) {
  try {
    const { init } = require('@sentry/node');
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
    });
  } catch (err) {
    console.warn('[WARN] Erro ao inicializar Sentry na Vercel:', err);
  }
}

// Create the Express app - wrap in async IIFE to handle top-level await
let appPromise = (async () => {
  return await createApp();
})();

// Export the app as the default handler for Vercel
module.exports = async (req, res) => {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error('Error in serverless function:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};