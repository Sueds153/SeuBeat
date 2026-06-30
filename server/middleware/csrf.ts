import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getEnv } from '../config/env';

const ALLOWED_ORIGIN = getEnv('ALLOWED_ORIGIN', '');

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers['origin'] as string | undefined;
  const allowedOrigins = ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(',').map(s => s.trim()) : [];

  if (allowedOrigins.length > 0) {
    const isSameOrigin = origin && allowedOrigins.some(a => origin === a || origin === a.replace(/\/$/, ''));
    if (!isSameOrigin) {
      res.status(403).json({ error: 'Requisição rejeitada por segurança (origem inválida).' });
      return;
    }
  }

  next();
}

export function csrfTokenEndpoint(_req: Request, res: Response): void {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf-token', token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600000,
  });
  res.json({ token });
}
