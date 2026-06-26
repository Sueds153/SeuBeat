import { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env';
import { logHttp } from '../utils/logger';

const allowedOrigin = getEnv('ALLOWED_ORIGIN', '*');

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
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
