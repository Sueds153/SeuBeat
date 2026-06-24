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
  max: 100,
  message: {
    success: false,
    error: 'Demasiados pedidos. Tente novamente mais tarde.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Não limitar localhost (IPv4 e IPv6) em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      return req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
    }
    return false;
  },
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
 * 5 requests por hora por IP (operação cara - Claude API)
 */
export const generateLyricsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  validate: false,
  keyGenerator: (req) => {
    // Usar email do body se disponível, senão IP
    const email = (req.body?.email || '').toLowerCase();
    return email && email.includes('@') ? email : req.ip;
  },
  message: {
    success: false,
    error: 'Limite de geração atingido. Máximo 5 gerações por hora.'
  },
  skip: (req) => process.env.NODE_ENV !== 'production',
  handler: (req, res) => {
    logWarn('Generate lyrics rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email || 'unknown'
    });
    res.status(429).json({
      success: false,
      error: 'Limite de geração de músicas atingido. Máximo 5 por hora. Tente novamente depois.'
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
  max: 30,
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
 * Limiter para endpoints de pagamento (submeter comprovativo + consultar status)
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
      error: 'Demasiadas tentativas. Tente novamente mais tarde.'
    });
  }
});
