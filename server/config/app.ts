import express from 'express';
import { ENV, validateEnv, getEnv } from './env';
import { globalLimiter, adminLimiter } from '../middleware/rateLimiter';
import { errorHandler } from '../middleware/errorHandler';
import { helmetMiddleware, corsMiddleware, httpLogger, permissionsPolicyMiddleware } from '../middleware/security';
import { adminIpRestriction } from '../middleware/adminIpRestriction';
import { logInfo } from '../utils/logger';
import { getAdminSupabase } from '../services/supabase';
import adminRouter from '../routes/admin';
import publicRouter from '../routes/public';

const sentryDsn = getEnv('SENTRY_DSN');

export async function createApp(): Promise<express.Application> {
  validateEnv();

  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(corsMiddleware);
  app.use(helmetMiddleware());
  app.use(permissionsPolicyMiddleware);
  app.use(httpLogger);

  app.get('/health', async (_req, res) => {
    const checks: Record<string, string> = {};

    try {
      const supabase = getAdminSupabase();
      if (supabase) {
        const { error } = await supabase.from('song_requests').select('id').limit(1).maybeSingle();
        checks.supabase = error ? `erro: ${error.message}` : 'ok';
      } else {
        checks.supabase = 'não configurado';
      }
    } catch (e: any) {
      checks.supabase = `erro: ${e?.message || 'desconhecido'}`;
    }

    const allOk = checks.supabase === 'ok';

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degradado',
      uptime: process.uptime(),
      checks,
      env: {
        sentry: !!getEnv('SENTRY_DSN'),
        suno: !!getEnv('SUNO_API_KEY'),
        anthropic: !!getEnv('ANTHROPIC_API_KEY'),
        supabase: !!getEnv('SUPABASE_URL'),
        smtp: !!getEnv('SMTP_HOST'),
        adminPassword: !!getEnv('ADMIN_PASSWORD'),
      },
    });
  });

  app.use('/api', globalLimiter, publicRouter);
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
