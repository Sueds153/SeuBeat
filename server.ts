import dotenv from 'dotenv';
dotenv.config();

import { hasEnv } from './server/config/env';

if (hasEnv('SENTRY_DSN')) {
  const { init } = await import('@sentry/node');
  init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

import { createApp, startServer } from './server/config/app';
import { logFatal } from './server/utils/logger';

const app = await createApp();

startServer(app).catch(err => {
  logFatal('Erro fatal ao iniciar servidor', err);
  process.exit(1);
});
