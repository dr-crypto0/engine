/**
 * Logger utility for Molecular Decomposition System
 */

import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'molecular-decomposition.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logDir, 'molecular-decomposition-error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Create a child logger for specific modules
export function createModuleLogger(moduleName: string): winston.Logger {
  return logger.child({ module: moduleName });
}

// Performance logging helper
export function logPerformance(operation: string, startTime: number): void {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation} completed`, { 
    duration: `${duration}ms`,
    operation 
  });
}

// Model metrics logging
export function logModelMetrics(
  modelName: string, 
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    inferenceTime?: number;
  }
): void {
  logger.info(`Model metrics: ${modelName}`, {
    model: modelName,
    metrics: {
      ...metrics,
      accuracy: metrics.accuracy ? `${(metrics.accuracy * 100).toFixed(2)}%` : undefined,
      precision: metrics.precision ? `${(metrics.precision * 100).toFixed(2)}%` : undefined,
      recall: metrics.recall ? `${(metrics.recall * 100).toFixed(2)}%` : undefined,
      f1Score: metrics.f1Score ? `${(metrics.f1Score * 100).toFixed(2)}%` : undefined,
      inferenceTime: metrics.inferenceTime ? `${metrics.inferenceTime}ms` : undefined
    }
  });
}

// Element detection logging
export function logElementDetection(
  elementCount: number,
  processingTime: number,
  imageSize: { width: number; height: number }
): void {
  logger.info('Element detection completed', {
    elementsDetected: elementCount,
    processingTime: `${processingTime}ms`,
    imageSize: `${imageSize.width}x${imageSize.height}`,
    elementsPerSecond: Math.round((elementCount / processingTime) * 1000)
  });
}

// Memory usage logging
export function logMemoryUsage(operation: string): void {
  const usage = process.memoryUsage();
  logger.debug(`Memory usage: ${operation}`, {
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}

// GPU usage logging (if available)
export async function logGPUUsage(): Promise<void> {
  try {
    // This would require nvidia-smi or similar GPU monitoring tool
    // Placeholder for GPU monitoring implementation
    logger.debug('GPU usage logging not yet implemented');
  } catch (error) {
    logger.debug('GPU usage monitoring not available');
  }
}

// Batch processing progress
export function createProgressLogger(totalItems: number, operation: string) {
  let processed = 0;
  const startTime = Date.now();
  
  return {
    increment: (count: number = 1) => {
      processed += count;
      const progress = (processed / totalItems) * 100;
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      const eta = (totalItems - processed) / rate;
      
      logger.info(`${operation} progress`, {
        processed,
        total: totalItems,
        progress: `${progress.toFixed(1)}%`,
        rate: `${rate.toFixed(1)} items/s`,
        eta: `${Math.round(eta)}s`
      });
    },
    
    complete: () => {
      const totalTime = Date.now() - startTime;
      logger.info(`${operation} completed`, {
        totalItems,
        totalTime: `${(totalTime / 1000).toFixed(2)}s`,
        averageTime: `${(totalTime / totalItems).toFixed(2)}ms/item`
      });
    }
  };
}

// Error logging with context
export function logError(error: Error, context: Record<string, any> = {}): void {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context
  });
}

// Warning for performance issues
export function logPerformanceWarning(
  operation: string,
  actualTime: number,
  expectedTime: number
): void {
  if (actualTime > expectedTime * 1.5) {
    logger.warn(`Performance warning: ${operation} slower than expected`, {
      operation,
      actualTime: `${actualTime}ms`,
      expectedTime: `${expectedTime}ms`,
      ratio: (actualTime / expectedTime).toFixed(2)
    });
  }
}

export default logger;