/**
 * Logger utility for Visual Capture Engine
 * Provides structured logging with performance tracking
 */

import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'magenta'
};

// Add colors to winston
winston.addColors(colors);

// Create custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }
    
    return msg;
  })
);

// Create custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.json()
);

// Create the logger instance
export const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'visual-capture.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log')
    })
  ]
});

// Performance logging helper
export class PerformanceLogger {
  private static timers: Map<string, number> = new Map();
  
  /**
   * Start a performance timer
   */
  static start(label: string): void {
    this.timers.set(label, performance.now());
    logger.debug(`Performance timer started: ${label}`);
  }
  
  /**
   * End a performance timer and log the duration
   */
  static end(label: string, metadata?: any): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      logger.warn(`No timer found for label: ${label}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(label);
    
    logger.info(`Performance: ${label}`, {
      duration: `${duration.toFixed(2)}ms`,
      ...metadata
    });
    
    return duration;
  }
  
  /**
   * Log a metric
   */
  static metric(name: string, value: number, unit: string = 'ms', metadata?: any): void {
    logger.info(`Metric: ${name}`, {
      value,
      unit,
      ...metadata
    });
  }
}

// Memory usage logger
export class MemoryLogger {
  /**
   * Log current memory usage
   */
  static log(context: string): void {
    const usage = process.memoryUsage();
    
    logger.debug(`Memory usage: ${context}`, {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
      arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)} MB`
    });
  }
}

// Frame capture logger
export class CaptureLogger {
  private static frameCount = 0;
  private static startTime = 0;
  
  /**
   * Start capture logging
   */
  static startCapture(): void {
    this.frameCount = 0;
    this.startTime = performance.now();
    logger.info('Capture started');
  }
  
  /**
   * Log a captured frame
   */
  static logFrame(frameNumber: number, metadata?: any): void {
    this.frameCount++;
    
    if (this.frameCount % 100 === 0) {
      const elapsed = (performance.now() - this.startTime) / 1000;
      const fps = this.frameCount / elapsed;
      
      logger.info(`Capture progress`, {
        framesCaptures: this.frameCount,
        elapsedTime: `${elapsed.toFixed(2)}s`,
        averageFps: fps.toFixed(2),
        ...metadata
      });
    }
  }
  
  /**
   * End capture logging
   */
  static endCapture(metadata?: any): void {
    const elapsed = (performance.now() - this.startTime) / 1000;
    const fps = this.frameCount / elapsed;
    
    logger.info('Capture completed', {
      totalFrames: this.frameCount,
      totalTime: `${elapsed.toFixed(2)}s`,
      averageFps: fps.toFixed(2),
      ...metadata
    });
  }
}

// Export convenience methods
export const logError = (message: string, error?: Error, metadata?: any): void => {
  logger.error(message, {
    error: error?.message,
    stack: error?.stack,
    ...metadata
  });
};

export const logWarn = (message: string, metadata?: any): void => {
  logger.warn(message, metadata);
};

export const logInfo = (message: string, metadata?: any): void => {
  logger.info(message, metadata);
};

export const logDebug = (message: string, metadata?: any): void => {
  logger.debug(message, metadata);
};

export const logTrace = (message: string, metadata?: any): void => {
  logger.trace(message, metadata);
};

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}