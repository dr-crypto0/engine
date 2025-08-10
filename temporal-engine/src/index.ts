/**
 * Temporal Analysis Engine
 * 
 * This module provides advanced temporal analysis capabilities for detecting
 * keyframes, correlating visual changes with interaction events, and creating
 * temporal slices for the Revolutionary Website Cloning System.
 */

// Core components
import { TemporalSlicer } from './core/TemporalSlicer';
import { ChangeDetector } from './core/ChangeDetector';
import { EventCorrelator } from './core/EventCorrelator';

export { TemporalSlicer, ChangeDetector, EventCorrelator };

// Types
export * from './types';

// Utilities
export { createLogger, logPerformance, logMemoryUsage } from './utils/logger';

// Version
export const VERSION = '1.0.0';

/**
 * Create a complete temporal analysis system with default configuration
 */
export function createTemporalEngine(config?: {
  changeDetector?: Partial<import('./types').ChangeDetectorConfig>;
  eventCorrelator?: Partial<import('./types').EventCorrelatorConfig>;
  temporalSlicer?: Partial<import('./types').TemporalSlicerConfig>;
}) {
  const changeDetector = new ChangeDetector(config?.changeDetector);
  const eventCorrelator = new EventCorrelator(config?.eventCorrelator);
  const temporalSlicer = new TemporalSlicer(
    changeDetector,
    eventCorrelator,
    config?.temporalSlicer
  );

  return {
    changeDetector,
    eventCorrelator,
    temporalSlicer,
    
    /**
     * Analyze frames and events to produce temporal slices
     */
    async analyze(
      frames: import('./types').Frame[],
      events: import('./types').InteractionEvent[]
    ): Promise<import('./types').TemporalAnalysisResult> {
      return temporalSlicer.analyze(frames, events);
    },

    /**
     * Clear all internal buffers and history
     */
    clearBuffers(): void {
      temporalSlicer.clearBuffers();
    }
  };
}

// Default export for convenience
export default {
  createTemporalEngine,
  TemporalSlicer,
  ChangeDetector,
  EventCorrelator,
  VERSION
};