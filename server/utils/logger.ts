import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Níveis customizados (alinhar com Winston: fatal=0, error=1, ..., trace=6)
const customLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  http: 4,
  debug: 5,
  trace: 6,
};

// Garantir que a pasta de logs existe sem rebentar o arranque
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

// Transports
const transports: pino.TransportTargetOptions[] = [];

// Console (sempre ativo)
transports.push({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    ignore: 'pid,hostname',
    singleLine: false,
  },
});

// File transports (apenas em produção ou com DEBUG)
if ((process.env.NODE_ENV === 'production' || process.env.DEBUG) && canWriteLogs) {
  transports.push({
    target: 'pino/file',
    options: { destination: path.join(logsDir, 'error.log'), mkdir: true },
    level: 'error',
  });
  transports.push({
    target: 'pino/file',
    options: { destination: path.join(logsDir, 'combined.log'), mkdir: true },
  });
}

// Criar logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  customLevels,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'seubeat' },
}, pino.transport({ targets: transports }));

// Sentry integration
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
    tags: { source: 'pino' },
    extra: { ...meta, logMessage: message },
  });
}

// Exportar API identical ao Winston anterior
export function logInfo(message: string, metadata?: unknown) {
  if (metadata && typeof metadata === 'object') {
    logger.info(metadata as Record<string, unknown>, message);
  } else {
    logger.info(message);
  }
}

export function logWarn(message: string, metadata?: unknown) {
  if (metadata && typeof metadata === 'object') {
    logger.warn(metadata as Record<string, unknown>, message);
  } else {
    logger.warn(message);
  }
}

export function logError(message: string, error?: Error | unknown, metadata?: unknown) {
  const errorObj = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { error: String(error) };

  const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  logger.error({ ...errorObj, ...meta }, message);
  captureSentry('error', message, error, metadata);
}

export function logDebug(message: string, metadata?: unknown) {
  if (metadata && typeof metadata === 'object') {
    logger.debug(metadata as Record<string, unknown>, message);
  } else {
    logger.debug(message);
  }
}

export function logHttp(message: string, metadata?: unknown) {
  if (metadata && typeof metadata === 'object') {
    logger.http(metadata as Record<string, unknown>, message);
  } else {
    logger.http(message);
  }
}

export function logFatal(message: string, error?: Error | unknown, metadata?: unknown) {
  const errorObj = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { error: String(error) };

  const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  logger.fatal({ ...errorObj, ...meta }, message);
  captureSentry('fatal', message, error, metadata).then(() => process.exit(1));
}
