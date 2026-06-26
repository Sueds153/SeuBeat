import express from 'express';
import { ENV, validateEnv } from './env';
import { globalLimiter, adminLimiter } from '../middleware/rateLimiter';
import { errorHandler } from '../middleware/errorHandler';
import { securityHeaders, corsMiddleware, httpLogger } from '../middleware/security';
import { logHttp, logFatal } from '../utils/logger';
import adminRouter from '../routes/admin';
import publicRouter from '../routes/public';

export function createApp(): express.Application {
  validateEnv();

  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(globalLimiter);
  app.use(corsMiddleware);
  app.use(securityHeaders);
  app.use(httpLogger);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', publicRouter);
  app.use('/api/admin', adminLimiter, adminRouter);
  app.use(errorHandler);

  return app;
}

export async function startServer(app: express.Application): Promise<void> {
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

  app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${ENV.PORT}`);
  });
}
