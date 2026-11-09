// Vercel Serverless Function entry point (CommonJS for maximum compatibility)
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

// Create the Express app
const appPromise = createApp();

// Export the app as the default handler for Vercel
module.exports = async (req, res) => {
  const app = await appPromise;
  return app(req, res);
};