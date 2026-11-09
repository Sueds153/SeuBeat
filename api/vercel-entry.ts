// Vercel Serverless Function entry point - only exports the Express app
// This file is bundled separately by esbuild for the serverless function

import { createApp } from '../server/config/app';

// Create the Express app
const appPromise = createApp();

// Export the app as the default handler for Vercel
export default async (req, res) => {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error('Error in serverless function:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};