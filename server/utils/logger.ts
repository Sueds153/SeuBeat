import winston from 'winston';

// Define níveis customizados
const customLevels = {
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    http: 4,
    debug: 5,
    trace: 6
  },
  colors: {
    fatal: 'red',
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    trace: 'gray'
  }
};

// Formato estruturado
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let meta = '';
    if (Object.keys(metadata).length > 0) {
      // Remover stack trace para console (apenas em files)
      const { stack, ...safeMetadata } = metadata;
      if (Object.keys(safeMetadata).length > 0) {
        meta = ` ${JSON.stringify(safeMetadata)}`;
      }
    }
    return `${timestamp} [${level.toUpperCase()}] ${message}${meta}`;
  })
);

// Console transport (sempre ativo)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize({ colors: customLevels.colors }),
    winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
      let meta = '';
      if (Object.keys(metadata).length > 0) {
        const { stack: _, ...safeMetadata } = metadata;
        if (Object.keys(safeMetadata).length > 0) {
          meta = ` ${JSON.stringify(safeMetadata)}`;
        }
      }
      if (stack) {
        return `${timestamp} [${level}] ${message}\n${stack}${meta}`;
      }
      return `${timestamp} [${level}] ${message}${meta}`;
    })
  )
});

import fs from 'fs';
import path from 'path';

// Garantir que a pasta de logs existe sem rebentar o arranque em ambientes como o Render
const logsDir = path.join(process.cwd(), 'logs');
let canWriteLogs = false;
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  canWriteLogs = true;
} catch {
  canWriteLogs = false;
}

// File transports (apenas se a pasta de logs for gravável)
const fileTransports = ((process.env.NODE_ENV === 'production' || process.env.DEBUG) && canWriteLogs)
  ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.uncolorize(),
          winston.format.json()
        ),
        maxsize: 10485760, // 10MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(
          winston.format.uncolorize(),
          winston.format.json()
        ),
        maxsize: 10485760,
        maxFiles: 5
      })
    ]
  : [];

// Criar logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  format,
  defaultMeta: { service: 'seubeat' },
  transports: [consoleTransport, ...fileTransports],
  exceptionHandlers: canWriteLogs ? [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      format: winston.format.uncolorize()
    })
  ] : undefined,
  rejectionHandlers: canWriteLogs ? [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      format: winston.format.uncolorize()
    })
  ] : undefined
});

let sentryModule: unknown = null;

async function ensureSentry() {
  if (sentryModule === undefined) {
    try {
      sentryModule = await import('@sentry/node');
    } catch {
      sentryModule = null;
    }
  }
  return sentryModule;
}

async function captureSentry(level: string, message: string, err?: Error | unknown, metadata?: unknown) {
  const Sentry = await ensureSentry();
  if (!Sentry || typeof Sentry !== 'object' || !('captureException' in Sentry)) return;
  const sentry = Sentry as { captureException: (e: Error, opts: Record<string, unknown>) => void };
  const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  const error = err instanceof Error ? err : new Error(String(err || message));
  sentry.captureException(error, {
    level: level === 'fatal' ? 'fatal' : 'error',
    tags: { source: 'winston' },
    extra: { ...meta, logMessage: message },
  });
}

export function logInfo(message: string, metadata?: unknown) {
  logger.info(message, metadata);
}

export function logWarn(message: string, metadata?: unknown) {
  logger.warn(message, metadata);
}

export function logError(message: string, error?: Error | unknown, metadata?: unknown) {
  const errorObj = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { error: String(error) };
  
  const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  logger.error(message, { ...errorObj, ...meta });
  captureSentry('error', message, error, metadata);
}

export function logDebug(message: string, metadata?: unknown) {
  logger.debug(message, metadata);
}

export function logHttp(message: string, metadata?: unknown) {
  logger.http(message, metadata);
}

export function logFatal(message: string, error?: Error | unknown, metadata?: unknown) {
  const errorObj = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { error: String(error) };
  
  const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  logger.log('fatal', message, { ...errorObj, ...meta });
  captureSentry('fatal', message, error, metadata).then(() => process.exit(1));
}

