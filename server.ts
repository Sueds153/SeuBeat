import dotenv from 'dotenv';
dotenv.config();

import { hasEnv } from './server/config/env';

try {
  if (hasEnv('SENTRY_DSN')) {
    const { init } = await import('@sentry/node');
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }
} catch (err) {
  console.error('[FATAL] Erro ao inicializar Sentry:', err);
  process.exit(1);
}

import { createApp, startServer } from './server/config/app';
import { logInfo, logWarn, logFatal } from './server/utils/logger';

const app = await createApp();

let server: import('http').Server | undefined;
try {
  server = await startServer(app);
} catch (err) {
  logFatal('Erro fatal ao iniciar servidor', err);
  process.exit(1);
}

async function gracefulShutdown(signal: string) {
  logInfo(`Recebido ${signal}. A encerrar servidor graciosamente...`);
  if (server) {
    server.close(() => {
      logInfo('Servidor encerrado.');
      process.exit(0);
    });
    setTimeout(() => {
      logWarn('Forçando encerramento após timeout de 10s.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
