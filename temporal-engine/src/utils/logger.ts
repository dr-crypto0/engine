import winston from 'winston';
import path from 'path';

/**
 * Logger configuration for the Temporal Engine
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  defaultMeta: { service: 'temporal-engine' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join('logs', 'temporal-engine-error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
  
  logger.add(new winston.transports.File({
    filename: path.join('logs', 'temporal-engine-combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

export default logger;

/**
 * Create a child logger with additional context
 */
export function createLogger(context: string): winston.Logger {
  return logger.child({ context });
}

/**
 * Log performance metrics
 */
export function logPerformance(operation: string, startTime: number, metadata?: any): void {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation} completed`, {
    duration,
    operation,
    ...metadata
  });
}

/**
 * Log memory usage
 */
export function logMemoryUsage(context: string): void {
  const usage = process.memoryUsage();
  logger.debug(`Memory usage: ${context}`, {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024)
  });
}