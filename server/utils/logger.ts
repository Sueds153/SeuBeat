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

// File transports (só em produção ou se DEBUG ativo)
const fileTransports = process.env.NODE_ENV === 'production' || process.env.DEBUG
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
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      format: winston.format.uncolorize()
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      format: winston.format.uncolorize()
    })
  ]
});

// Métodos de conveniência com contexto
export function logInfo(message: string, metadata?: Record<string, any>) {
  logger.info(message, metadata);
}

export function logWarn(message: string, metadata?: Record<string, any>) {
  logger.warn(message, metadata);
}

export function logError(message: string, error?: Error | any, metadata?: Record<string, any>) {
  const errorObj = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { error: String(error) };
  
  logger.error(message, { ...errorObj, ...metadata });
}

export function logDebug(message: string, metadata?: Record<string, any>) {
  logger.debug(message, metadata);
}

export function logHttp(message: string, metadata?: Record<string, any>) {
  logger.http(message, metadata);
}

export function logFatal(message: string, error?: Error | any, metadata?: Record<string, any>) {
  const errorObj = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { error: String(error) };
  
  logger.log('fatal', message, { ...errorObj, ...metadata });
  process.exit(1);
}

// export default logger (removed — never imported as default)
