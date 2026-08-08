import rateLimit from 'express-rate-limit';
import { logWarn } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS - diferentes estratégias para diferentes endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global rate limiter
 * 100 requests por 15 minutos por IP
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  message: {
    success: false,
    error: 'Demasiados pedidos. Tente novamente mais tarde.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: 'Demasiados pedidos. Tente novamente em alguns minutos.'
    });
  }
});

/**
 * Limiter para geração de letras
 * 10 requests por hora por email (operação cara - IA)
 */
export const generateLyricsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  validate: false,
  keyGenerator: (req) => {
    // Usar email do body se disponível, senão IP
    const email = (req.body?.email || '').toLowerCase();
    return email && email.includes('@') ? email : req.ip;
  },
  message: {
    success: false,
    error: 'Limite de geração atingido. Máximo 10 gerações por hora.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Generate lyrics rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email || 'unknown'
    });
    let waitMsg = 'Tenta novamente dentro de 1 hora.';
    const resetHeader = res.getHeader('RateLimit-Reset');
    const resetSeconds = typeof resetHeader === 'string' ? Number(resetHeader) : NaN;
    if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
      const ms = resetSeconds * 1000 - Date.now();
      if (ms > 0) {
        const minutes = Math.ceil(ms / 60000);
        waitMsg = minutes <= 1 ? 'Tenta novamente em menos de 1 minuto.' : `Tenta novamente em ${minutes} min.`;
      }
    }
    res.status(429).json({
      success: false,
      error: `Limite de geração de músicas atingido (máximo 10 por hora). ${waitMsg}`
    });
  }
});

/**
 * Limiter para endpoint de envio de email
 * 20 requests por hora por IP
 */
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  message: {
    success: false,
    error: 'Demasiadas tentativas de envio de email.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Email rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: 'Limite de envios de email atingido. Tente novamente mais tarde.'
    });
  }
});

/**
 * Limiter para admin endpoints (mais restritivo)
 * 30 requests por hora
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 200,
  message: {
    success: false,
    error: 'Limite de requisições admin atingido.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Admin rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: 'Limite de requisições atingido. Tente novamente mais tarde.'
    });
  }
});

/**
 * Limiter para leitura de música (muito permissivo)
 * 500 requests por 15 minutos
 */
export const getSongLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500,
  message: {
    success: false,
    error: 'Demasiadas requisições.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Get song rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: 'Demasiadas requisições. Tente novamente mais tarde.'
    });
  }
});

/**
 * Limiter para submeter comprovativo (mais restritivo)
 * 20 requests por hora por IP
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Demasiadas requisições de pagamento.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Payment rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: 'Demasiadas tentativas de pagamento. Tente novamente mais tarde.'
    });
  }
});

/**
 * Limiter para dados de resume do wizard (expõe dados pessoais)
 * 30 requests por hora por IP
 */
export const resumeDataLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Demasiadas requisições.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Resume data rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: 'Demasiadas requisições. Tente novamente mais tarde.'
    });
  }
});

/**
 * Limiter para consulta de status de pagamento (mais permissivo)
 * 120 requests por hora por IP — para nao bloquear o polling automatico
 */
export const paymentStatusLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  message: {
    success: false,
    error: 'Demasiadas requisições.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Payment status rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: 'Demasiadas requisições. Tente novamente mais tarde.'
    });
  }
});

/**
 * Limiter para recuperação de música por email (página /retomar)
 * 20 requests por hora por IP
 */
export const recoverByEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Demasiadas tentativas de recuperação.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Recover by email rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: 'Demasiadas tentativas. Tente novamente mais tarde.'
    });
  }
});

/**
 * Limiter para disparar campanhas WhatsApp no admin (proteção contra abuso)
 * 10 requests por hora por IP
 */
export const whatsappBulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Limite de campanhas WhatsApp atingido.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('WhatsApp bulk rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: 'Limite de campanhas WhatsApp atingido. Tente novamente mais tarde.'
    });
  }
});
