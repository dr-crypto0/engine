/**
 * Logger utility for Interaction Discovery System
 */

import winston from 'winston';
import path from 'path';

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}] ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata, null, 2)}`;
          }
          return msg;
        })
      )
    }),
    
    // File transport
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'interaction-discovery.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Export convenience methods
export const logInfo = (message: string, metadata?: any) => logger.info(message, metadata);
export const logError = (message: string, error?: any, metadata?: any) => {
  logger.error(message, { error: error?.message || error, stack: error?.stack, ...metadata });
};
export const logWarn = (message: string, metadata?: any) => logger.warn(message, metadata);
export const logDebug = (message: string, metadata?: any) => logger.debug(message, metadata);