import express from 'express';
import { ENV, validateEnv, getEnv } from './env';
import { globalLimiter, adminLimiter } from '../middleware/rateLimiter';
import { errorHandler } from '../middleware/errorHandler';
import { helmetMiddleware, corsMiddleware, httpLogger, permissionsPolicyMiddleware } from '../middleware/security';
import { adminIpRestriction } from '../middleware/adminIpRestriction';
import { logInfo } from '../utils/logger';
import adminRouter from '../routes/admin';
import publicRouter from '../routes/public';

const sentryDsn = getEnv('SENTRY_DSN');

export async function createApp(): Promise<express.Application> {
  validateEnv();

  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(globalLimiter);
  app.use(corsMiddleware);
  app.use(helmetMiddleware());
  app.use(permissionsPolicyMiddleware);
  app.use(httpLogger);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', publicRouter);
  app.use('/api/admin', adminLimiter, adminIpRestriction, adminRouter);

  if (sentryDsn) {
    const { setupExpressErrorHandler } = await import('@sentry/node');
    setupExpressErrorHandler(app);
  }

  app.use(errorHandler);

  return app;
}

export async function startServer(app: express.Application): Promise<import('http').Server> {
  if (ENV.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const path = await import('path');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const path = await import('path');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'Rota nao encontrada' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise((resolve) => {
    const server = app.listen(ENV.PORT, '0.0.0.0', () => {
      logInfo(`Servidor iniciado na porta ${ENV.PORT}`);
      resolve(server);
    });
  });
}
