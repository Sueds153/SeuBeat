import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { getEnv, ENV } from '../config/env';
import { logHttp } from '../utils/logger';

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowedOrigin = getEnv('ALLOWED_ORIGIN', ENV.NODE_ENV === 'production' ? '' : '*');
  if (allowedOrigin === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && (allowedOrigin === origin || allowedOrigin.split(',').map(s => s.trim()).includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
}

export function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co'],
        frameAncestors: ["'none'"],
      },
    } : false,
    strictTransportSecurity: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
    } : false,
    crossOriginEmbedderPolicy: false,
  });
}

export function permissionsPolicyMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  res.on('finish', () => {
    logHttp(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });
  });
  next();
}
