import dotenv from 'dotenv';
dotenv.config();

import { hasEnv } from './server/config/env';

// Initialize Sentry if DSN is provided
if (hasEnv('SENTRY_DSN')) {
  try {
    const { init } = await import('@sentry/node');
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  } catch (err) {
    console.warn('[WARN] Erro ao inicializar Sentry (ignorando para manter o servidor ativo):', err);
  }
}

import { createApp, startServer } from './server/config/app';
import { logInfo, logWarn, logError, logFatal } from './server/utils/logger';
import { startDeliveryScheduler } from './server/services/deliveryScheduler';
import { startAbandonedRecoveryScheduler } from './server/services/abandonedRecoveryScheduler';
import { startFollowUpScheduler } from './server/services/followUpScheduler';
import { startFailedLyricsRecoveryScheduler } from './server/services/failedLyricsRecoveryScheduler';
import { startStuckMusicRecoveryScheduler } from './server/services/stuckMusicRecoveryScheduler';

let server: import('http').Server | undefined;

async function main() {
  const app = await createApp();
  
  try {
    server = await startServer(app);
    try {
      startDeliveryScheduler();
      startAbandonedRecoveryScheduler();
      startFollowUpScheduler();
      startFailedLyricsRecoveryScheduler();
      startStuckMusicRecoveryScheduler();
    } catch (schedErr) {
      logError('Aviso: falha ao iniciar schedulers em segundo plano', schedErr);
    }
  } catch (err) {
    logError('Erro ao iniciar servidor HTTP', err);
  }
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

process.on('unhandledRejection', (reason) => {
  logError('[Process] Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (err) => {
  logFatal('[Process] Uncaught Exception — a encerrar', err);
});

main().catch(err => {
  logError('Erro fatal no main', err);
  process.exit(1);
});