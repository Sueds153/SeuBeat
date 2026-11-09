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
import { startDeliveryScheduler } from '../services/deliveryScheduler';
import { startAbandonedRecoveryScheduler } from '../services/abandonedRecoveryScheduler';
import { startFollowUpScheduler } from '../services/followUpScheduler';
import { startFailedLyricsRecoveryScheduler } from '../services/failedLyricsRecoveryScheduler';
import { startStuckMusicRecoveryScheduler } from '../services/stuckMusicRecoveryScheduler';

const sentryDsn = getEnv('SENTRY_DSN');

export function startSchedulers(): void {
  try {
    startDeliveryScheduler();
    startAbandonedRecoveryScheduler();
    startFollowUpScheduler();
    startFailedLyricsRecoveryScheduler();
    startStuckMusicRecoveryScheduler();
  } catch (schedErr) {
    logError('Aviso: falha ao iniciar schedulers em segundo plano', schedErr);
  }
}

export async function createApp(): Promise<express.Application> {
  validateEnv();

  const app = express();

  app.set('trust proxy', 1);

  // In Vercel, skip express.json (Vercel pre-parses JSON bodies); keep urlencoded for form posts
  const isVercel = !!process.env.VERCEL;
  if (!isVercel) {
    app.use(express.json({ limit: '1mb' }));
  }
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Vercel fallback: if body is undefined for JSON requests, read stream manually
  if (isVercel) {
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      if (req.body !== undefined) return next();
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('multipart/form-data') || ct.includes('x-www-form-urlencoded')) return next();
      const len = Number(req.headers['content-length'] || 0);
      if (ct.includes('json') && len > 0) {
        const chunks: Buffer[] = [];
        let done = false;
        const finish = (body: unknown) => {
          if (done) return;
          done = true;
          req.body = body;
          next();
        };
        const safety = setTimeout(() => finish({}), 10000);
        (safety as { unref?: () => void }).unref?.();
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          clearTimeout(safety);
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            finish(raw ? JSON.parse(raw) : {});
          } catch {
            finish({});
          }
        });
        req.on('error', () => {
          clearTimeout(safety);
          finish({});
        });
        return;
      }
      req.body = {};
      next();
    });
  }

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
      const supabaseUrl = getEnv('SUPABASE_URL', '');
      const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      const supabase = getAdminSupabase();
      if (supabase) {
        // Direct raw fetch test first
        let rawFetchOk = false;
        let rawFetchErr: string | null = null;
        if (supabaseUrl && supabaseKey) {
          try {
            const testUrl = supabaseUrl.replace(/\/$/, '') + '/rest/v1/';
            const r = await fetch(testUrl, {
              headers: { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` },
              method: 'HEAD'
            });
            rawFetchOk = r.ok;
            if (!r.ok) rawFetchErr = `HTTP ${r.status}`;
          } catch (fe) {
            const ferr = fe instanceof Error ? fe : new Error(String(fe));
            rawFetchErr = ferr.message + (ferr.cause ? ` (${JSON.stringify(ferr.cause)})` : '');
          }
        }

        const { error } = await supabase.from('song_requests').select('id').limit(1).maybeSingle();
        checks.supabase = error ? `erro: ${error.message}` : 'ok';
        if (!rawFetchOk) {
          checks.supabase += ` [raw fetch: ${rawFetchErr || 'failed'}]`;
        }
      } else {
        checks.supabase = `não configurado (URL: ${supabaseUrl ? supabaseUrl.slice(0, 30) + '...' : 'vazio'})`;
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      const cause = (err as { cause?: unknown }).cause;
      checks.supabase = `erro: ${err.message}${cause ? ` (cause: ${JSON.stringify(cause)})` : ''}`;
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

      const appUrl = getEnv('APP_URL', 'https://seubeat.vercel.app');
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
      server.setTimeout(90000);
      server.keepAliveTimeout = 90000;
      resolve(server);
    });
  });
}
