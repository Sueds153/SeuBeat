import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Import routers
import adminRouter from './server/routes/admin';
import publicRouter from './server/routes/public';

// Import middlewares e logger
import { globalLimiter, adminLimiter } from './server/middleware/rateLimiter';
import { errorHandler } from './server/middleware/errorHandler';
import { logHttp, logFatal } from './server/utils/logger';

// Load environmental variables
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// ENV VALIDATION (fail fast)
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUNO_API_KEY', 'ANTHROPIC_API_KEY', 'SMTP_HOST', 'ADMIN_PASSWORD'] as const;
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  logFatal('Variaveis de ambiente em falta', undefined, { missing });
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Global rate limiter
app.use(globalLimiter);

// CORS restrito
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'");
  }
  next();
});

// HTTP request logging (all requests)
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logHttp(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
});

// Healthcheck
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API Routes
app.use('/api', publicRouter);
app.use('/api/admin', adminLimiter, adminRouter);

// Error handler (deve ser o último middleware)
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// VITE / STATIC SETUP
// ─────────────────────────────────────────────────────────────────────────────

async function setupApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    // SPA fallback (except API routes)
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'Rota nao encontrada' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupApp().catch(err => {
  logFatal('Erro fatal ao iniciar servidor', err);
  process.exit(1);
});
