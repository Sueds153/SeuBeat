import { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env';
import { logWarn } from '../utils/logger';

export function adminIpRestriction(req: Request, res: Response, next: NextFunction): void {
  const allowedIps = getEnv('ADMIN_ALLOWED_IPS', '');
  if (!allowedIps) return next();

  const ips = allowedIps.split(',').map(ip => ip.trim());
  const clientIp = req.ip || req.socket.remoteAddress || '';

  const allowed = ips.some(allowed => allowed === clientIp);
  if (!allowed) {
    logWarn('Admin IP restriction denied', { ip: clientIp });
    res.status(403).json({ error: 'Acesso não autorizado.' });
    return;
  }

  next();
}
