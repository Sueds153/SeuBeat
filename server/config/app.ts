import express from 'express';
import { ENV, validateEnv, getEnv } from './env';
import { errorHandler } from '../middleware/errorHandler';
import { helmetMiddleware, corsMiddleware, httpLogger, permissionsPolicyMiddleware } from '../middleware/security';
import { requestIdMiddleware } from '../middleware/requestId';
import { adminIpRestriction } from '../middleware/adminIpRestriction';
import { csrfProtection } from '../middleware/csrf';
import { logInfo, logError } from '../utils/logger';
import { getAdminSupabase } from '../services/supabase';
import { renderOgPage } from '../services/ogTemplate';
import adminRouter from '../routes/admin';
import publicRouter from '../routes/public';

const sentryDsn = getEnv('SENTRY_DSN');

export async function createApp(): Promise<express.Application> {
  validateEnv();

  const app = express();

  app.set('trust proxy', 1);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));
  app.use(requestIdMiddleware);
  app.use(corsMiddleware);
  app.use(helmetMiddleware());
  app.use(permissionsPolicyMiddleware);
  app.use(csrfProtection);
  app.use(httpLogger);

  app.get('/health', async (_req, res) => {
    const checks: Record<string, string> = {};
    const startTime = Date.now();

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

    const mem = process.memoryUsage();
    const isCi = process.env.CI === 'true';
    const allOk = checks.supabase === 'ok' || isCi;

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degradado',
      uptime: process.uptime(),
      responseTime: `${Date.now() - startTime}ms`,
      ci: isCi || undefined,
      checks,
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      },
      env: {
        node: process.version,
        platform: process.platform,
        sentry: !!getEnv('SENTRY_DSN'),
        suno: !!getEnv('SUNO_API_KEY'),
        anthropic: !!getEnv('ANTHROPIC_API_KEY'),
        openai: !!getEnv('OPENAI_API_KEY'),
        supabase: !!getEnv('SUPABASE_URL'),
        brevo: !!getEnv('BREVO_API_KEY'),
        adminPassword: !!getEnv('ADMIN_PASSWORD'),
        jwtSecret: !!getEnv('JWT_SECRET'),
        multicaixa: !!getEnv('MULTICAIXA_ENTIDADE') && !!getEnv('MULTICAIXA_REFERENCIA'),
      },
    });
  });

  app.use('/api/admin', adminIpRestriction, adminRouter);
  app.use('/api', publicRouter);

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
    app.get('*.map', (_req, res) => {
      res.status(404).type('text/plain').send('Not found');
    });
    app.use(express.static(distPath, {
      maxAge: 0,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.set('Cache-Control', 'public, max-age=300, must-revalidate');
        }
      }
    }));

    const CRAWLER_UA = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slack|Googlebot|bingbot|Pinterest|Slack|Discordbot/i;

    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const ua = (req.headers['user-agent'] || '');
      if (!CRAWLER_UA.test(ua)) return next();

      const appUrl = getEnv('APP_URL', 'https://seubeat.onrender.com');
      const fullUrl = `${appUrl}${req.originalUrl}`;

      const songMatch = req.path.match(/^\/song\/(.+)/);
      const songId = req.query.id as string;

      if (songMatch && songId) {
        try {
          const supabase = getAdminSupabase();
          if (!supabase) throw new Error('supabase not available');
          const { data } = await supabase
            .from('song_requests')
            .select('recipient_name, recipient_nick, music_style')
            .eq('id', songId)
            .maybeSingle();

          if (data?.recipient_name) {
            res.send(renderOgPage({
              title: `Música para ${data.recipient_name}`,
              description: `Canção personalizada em ${data.music_style || 'Kizomba'} criada com carinho no SeuBeat.`,
              image: `${appUrl}/assets/seubeat_card.svg`,
              url: fullUrl,
            }));
            return;
          }
        } catch (err) {
          logError('OG page: erro ao buscar dados da dedicatória', err as Error);
        }
      }

      res.send(renderOgPage({
        title: 'SeuBeat — Canções Personalizadas',
        description: 'Surpreenda quem mais ama com uma canção única — Kizomba, Semba, Pop e mais.',
        image: `${appUrl}/assets/seubeat_card.svg`,
        url: fullUrl,
      }));
    });

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'Rota nao encontrada' });
      }
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise((resolve) => {
    const server = app.listen(ENV.PORT, '0.0.0.0', () => {
      logInfo(`Servidor iniciado na porta ${ENV.PORT}`);
      // Aumentar timeout do servidor HTTP para 150s (AI pode demorar até 120s)
      server.setTimeout(150000);
      server.keepAliveTimeout = 150000;
      resolve(server);
    });
  });
}
