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
  console.warn('[WARN] Erro ao inicializar Sentry (ignorando para manter o servidor ativo):', err);
}

import { createApp, startServer } from './server/config/app';
import { logInfo, logWarn, logError } from './server/utils/logger';
import { startDeliveryScheduler } from './server/services/deliveryScheduler';
import { startAbandonedRecoveryScheduler } from './server/services/abandonedRecoveryScheduler';
import { startFollowUpScheduler } from './server/services/followUpScheduler';
import { startFailedLyricsRecoveryScheduler } from './server/services/failedLyricsRecoveryScheduler';
import { startStuckMusicRecoveryScheduler } from './server/services/stuckMusicRecoveryScheduler';

const app = await createApp();

let server: import('http').Server | undefined;
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
