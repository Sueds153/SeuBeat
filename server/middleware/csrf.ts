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

  if (allowedOrigins.length > 0 && origin) {
    const isAllowed = allowedOrigins.some(a => origin === a || origin === a.replace(/\/$/, ''));
    if (!isAllowed) {
      res.status(403).json({ error: 'Requisição rejeitada por segurança (origem inválida).' });
      return;
    }
  }

  next();
}


