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
import webhookRouter from '../routes/webhook';
import { hasDeepSeekApiKey } from '../services/deepseekConfig';
import { checkDeepSeekCredits, checkGeminiCredits } from '../services/aiHealth';

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
    } catch (e: unknown) {
      checks.supabase = `erro: ${e instanceof Error ? e.message : 'desconhecido'}`;
    }

    // R2 storage diagnostic
    checks.storage = `${getEnv('STORAGE_PROVIDER', 'r2')} (bucket: ${getEnv('R2_BUCKET_NAME', '?')})`;
    checks.r2Vars = [
      getEnv('R2_ACCOUNT_ID') ? 'account' : null,
      getEnv('R2_ACCESS_KEY_ID') ? 'access' : null,
      getEnv('R2_SECRET_ACCESS_KEY') ? 'secret' : null,
      getEnv('R2_BUCKET_NAME') ? 'bucket' : null,
      getEnv('R2_PUBLIC_DOMAIN') ? 'domain' : null,
    ].filter(Boolean).join(',') || 'nenhuma';

    // Test AWS SDK dynamic import (one-shot gate in storage.ts)
    try {
      const t0 = Date.now();
      const s3mod = await import('@aws-sdk/client-s3');
      checks.r2Sdk = `ok (${Date.now() - t0}ms, exports: ${Object.keys(s3mod).length})`;
    } catch (e: unknown) {
      checks.r2Sdk = `FALHOU: ${e instanceof Error ? e.message : String(e)}`;
    }

    const [deepseek, gemini] = await Promise.all([
      checkDeepSeekCredits(),
      checkGeminiCredits(),
    ]);
    checks.deepseek = deepseek.ok ? 'ok' : `erro: ${String(deepseek.error || 'desconhecido')}`;
    checks.gemini = (gemini as { quota_exceeded?: boolean; ok?: boolean; error?: unknown }).quota_exceeded
      ? 'quota excedida (429/403)'
      : gemini.ok
      ? 'ok'
      : `erro: ${String(gemini.error || 'desconhecido')}`;

    const mem = process.memoryUsage();
    const isCi = process.env.CI === 'true';
    const allOk = checks.supabase === 'ok' || isCi;

    res.status(200).json({
      status: allOk ? 'ok' : 'degradado',
      uptime: process.uptime(),
      responseTime: `${Date.now() - startTime}ms`,
      ci: isCi || undefined,
      checks,
      ai: { deepseek, gemini },
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
        gemini: !!getEnv('GEMINI_API_KEY'),
        deepseek: hasDeepSeekApiKey(),
        supabase: !!getEnv('SUPABASE_URL'),
        brevo: !!getEnv('BREVO_API_KEY'),
        adminPassword: !!getEnv('ADMIN_PASSWORD'),
        jwtSecret: !!getEnv('JWT_SECRET'),
        multicaixa: !!getEnv('MULTICAIXA_ENTIDADE') && !!getEnv('MULTICAIXA_REFERENCIA'),
        whatsapp: !!getEnv('WHATSAPP_API_TOKEN') && !!getEnv('WHATSAPP_PHONE_NUMBER_ID'),
      },
    });
  });

  app.use('/api/admin', adminIpRestriction, adminRouter);
  app.use('/api', publicRouter);
  app.use('/api', webhookRouter);

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
              image: `${appUrl}/assets/seubeat_share_v2.png`,
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
        image: `${appUrl}/assets/seubeat_share_v2.png`,
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
      server.setTimeout(300000);
      server.keepAliveTimeout = 300000;
      resolve(server);
    });
  });
}
