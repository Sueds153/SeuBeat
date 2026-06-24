import express from 'express';
import { timingSafeEqual } from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ATTEMPT_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;
const CLEANUP_MS = 60 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function timingSafeCompare(a: string, b: string): boolean {
  const maxLen = 256;
  const bufA = Buffer.alloc(maxLen, a);
  const bufB = Buffer.alloc(maxLen, b);
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > ATTEMPT_LIMIT) return true;
  return false;
}

// Periodic cleanup of stale IP entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt + CLEANUP_MS) {
      attempts.delete(ip);
    }
  }
}, CLEANUP_MS).unref();

export function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiadas tentativas. Tente novamente mais tarde.' });
  }

  const password = req.headers['x-admin-password'] as string | undefined;

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD não configurado no servidor.' });
  }

  if (!password || !timingSafeCompare(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }

  next();
}
