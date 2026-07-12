import { Request, Response, NextFunction } from 'express';
import { logWarn } from '../utils/logger';

/**
 * Middleware para tratar erros de forma consistente
 */
const KNOWN_ERRORS: Record<number, string> = {
  413: 'O ficheiro enviado é demasiado grande. Máximo 10MB.',
};

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = error.status ?? error.statusCode ?? 500;
  const message = error.message || 'Erro interno do servidor';

  logWarn('Request error', {
    path: req.path,
    method: req.method,
    status,
    message,
    stack: error.stack
  });

  res.status(status).json({
    success: false,
    error: KNOWN_ERRORS[status] || (status === 500 ? 'Erro interno do servidor' : message)
  });
}
