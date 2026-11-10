import pino from 'pino';
import fs from 'fs';
import path from 'path';

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

// Detect if running in Vercel/serverless environment
const isVercel = !!process.env.VERCEL;
const isProduction = process.env.NODE_ENV === 'production';
const isDev = process.env.NODE_ENV !== 'production' && !isVercel;

// Criar logger
// In Vercel: plain pino (no transport) → JSON to stdout, no worker threads
// In local dev: pino-pretty transport for colored output
// In production (non-Vercel): file transports
const defaultLogLevel = isProduction ? 'info' : 'debug';

function createLogger() {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || defaultLogLevel,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: 'seubeat' },
  };

  if (isVercel) {
    // Plain pino, no transport - simplest and most reliable for serverless
    return pino(options);
  } else if (isDev) {
    // Local development: pretty transport
    return pino(options, pino.transport({
      targets: [{
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }],
    }));
  } else {
    // Production (non-Vercel): file transports
    const transports: pino.TransportTargetOptions[] = [];
    if (canWriteLogs) {
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
    return pino(options, pino.transport({ targets: transports }));
  }
}

const logger = createLogger();

// Sentry integration
let sentryModule: unknown = null;

async function ensureSentry() {
  if (sentryModule === null) {
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

// Helper to get first header value (handles string | string[])
function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const val = headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  return val;
}

// Use 'info' level for http logs (standard pino level)
function logHttp(message: string, metadata?: unknown) {
  if (metadata && typeof metadata === 'object') {
    logger.info(metadata as Record<string, unknown>, message);
  } else {
    logger.info(message);
  }
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

export function logFatal(message: string, error?: Error | unknown, metadata?: unknown) {
  const errorObj = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { error: String(error) };

  const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  logger.fatal({ ...errorObj, ...meta }, message);
  captureSentry('fatal', message, error, metadata).then(() => process.exit(1));
}

export { getHeader, logHttp };
