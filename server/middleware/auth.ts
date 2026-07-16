import express from 'express';
import { timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || '';
}

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

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt + CLEANUP_MS) {
      attempts.delete(ip);
    }
  }
}, CLEANUP_MS).unref();

export function adminLogin(req: express.Request, res: express.Response) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiadas tentativas. Tente novamente mais tarde.' });
  }

  const { password } = req.body;
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD não configurado no servidor.' });
  }

  if (!password || !timingSafeCompare(String(password), adminPassword)) {
    return res.status(401).json({ error: 'Password inválida.' });
  }

  const token = jwt.sign({ role: 'admin', iat: Date.now() }, getJwtSecret(), { expiresIn: '2h' });
  res.json({ success: true, token, expiresIn: 7200 });
}

export function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'] as string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      jwt.verify(token, getJwtSecret());
      return next();
    } catch {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
  }

  const legacyPassword = req.headers['x-admin-password'] as string | undefined;
  const adminPassword = getAdminPassword();
  if (legacyPassword && adminPassword && timingSafeCompare(legacyPassword, adminPassword)) {
    return next();
  }

  return res.status(401).json({ error: 'Acesso não autorizado.' });
}


