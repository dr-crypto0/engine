import { createLogger, logPerformance } from '../utils/logger';
import {
  ChangeMap,
  InteractionEvent,
  Correlation,
  CorrelationType,
  CausalChain,
  TimingProfile,
  EventCorrelatorConfig,
  Region
} from '../types';

const logger = createLogger('EventCorrelator');

/**
 * Correlates interaction events with visual changes to establish causality
 */
export class EventCorrelator {
  private config: Required<EventCorrelatorConfig>;
  private correlationHistory: Map<string, Correlation[]> = new Map();

  constructor(config: Partial<EventCorrelatorConfig> = {}) {
    this.config = {
      maxCorrelationDelay: config.maxCorrelationDelay ?? 2000, // 2 seconds
      spatialThreshold: config.spatialThreshold ?? 100, // 100 pixels
      detectAnimations: config.detectAnimations ?? true,
      buildCausalChains: config.buildCausalChains ?? true
    };

    logger.info('EventCorrelator initialized', { config: this.config });
  }

  /**
   * Correlate visual changes with an interaction event
   */
  correlate(visualChanges: ChangeMap, interaction: InteractionEvent): Correlation {
    const startTime = Date.now();
    logger.debug('Correlating visual changes with interaction', {
      eventType: interaction.type,
      changePercentage: visualChanges.changePercentage
    });

    try {
      // Calculate temporal delay
      const delay = this.calculateDelay(visualChanges, interaction);

      // Determine correlation type
      const correlationType = this.determineCorrelationType(
        visualChanges,
        interaction,
        delay
      );

      // Calculate spatial proximity
      const spatialProximity = this.calculateSpatialProximity(
        visualChanges.regions,
        interaction
      );

      // Calculate confidence score
      const confidence = this.calculateConfidence(
        visualChanges,
        interaction,
        delay,
        spatialProximity,
        correlationType
      );

      const correlation: Correlation = {
        event: interaction,
        changes: visualChanges,
        delay,
        confidence,
        correlationType
      };

      // Store in history for chain building
      this.addToHistory(interaction.id, correlation);

      logPerformance('correlate', startTime, {
        correlationType,
        confidence,
        delay
      });

      return correlation;
    } catch (error) {
      logger.error('Error correlating changes with event', { error });
      throw error;
    }
  }

  /**
   * Build a causal chain from a sequence of correlations
   */
  buildCausalChain(correlations: Correlation[]): CausalChain {
    const startTime = Date.now();
    logger.debug('Building causal chain', { correlationCount: correlations.length });

    if (correlations.length === 0) {
      throw new Error('Cannot build causal chain from empty correlations');
    }

    try {
      // Sort correlations by time
      const sortedCorrelations = [...correlations].sort(
        (a, b) => a.event.timestamp - b.event.timestamp
      );

      // Identify the trigger event
      const trigger = sortedCorrelations[0].event;

      // Calculate total duration
      const lastEvent = sortedCorrelations[sortedCorrelations.length - 1].event;
      const duration = lastEvent.timestamp - trigger.timestamp;

      // Extract timing profile
      const timing = this.extractTiming(sortedCorrelations);

      // Calculate overall confidence
      const confidence = this.calculateChainConfidence(sortedCorrelations);

      const chain: CausalChain = {
        id: this.generateChainId(trigger),
        trigger,
        correlations: sortedCorrelations,
        duration,
        confidence,
        timing
      };

      logPerformance('buildCausalChain', startTime, {
        chainId: chain.id,
        duration,
        correlationCount: correlations.length
      });

      return chain;
    } catch (error) {
      logger.error('Error building causal chain', { error });
      throw error;
    }
  }

  /**
   * Extract timing characteristics from a causal chain
   */
  extractTiming(correlations: Correlation[]): TimingProfile {
    const startTime = Date.now();
    logger.debug('Extracting timing profile');

    try {
      // Find initial response
      const initialDelay = correlations[0].delay;

      // Find when changes settle
      const settlingTime = this.findSettlingTime(correlations);

      // Find peak change
      const peakTime = this.findPeakChangeTime(correlations);

      // Detect if instantaneous
      const isInstantaneous = initialDelay < 50; // Less than 50ms

      // Detect animation
      const animationInfo = this.detectAnimationPattern(correlations);

      const timing: TimingProfile = {
        initialDelay,
        settlingTime,
        peakTime,
        isInstantaneous,
        hasAnimation: animationInfo.hasAnimation,
        animationDuration: animationInfo.duration,
        easingFunction: animationInfo.easingFunction
      };

      logPerformance('extractTiming', startTime);
      return timing;
    } catch (error) {
      logger.error('Error extracting timing profile', { error });
      throw error;
    }
  }

  /**
   * Calculate delay between event and visual change
   */
  private calculateDelay(changes: ChangeMap, event: InteractionEvent): number {
    // In a real implementation, this would use frame timestamps
    // For now, we'll estimate based on change characteristics
    if (changes.overallIntensity > 0.8) {
      return 0; // Immediate change
    } else if (changes.overallIntensity > 0.5) {
      return 100; // Quick response
    } else {
      return 300; // Delayed response
    }
  }

  /**
   * Determine the type of correlation
   */
  private determineCorrelationType(
    changes: ChangeMap,
    event: InteractionEvent,
    delay: number
  ): CorrelationType {
    // Immediate response
    if (delay < 50) {
      return CorrelationType.DIRECT;
    }

    // Check for animation patterns
    if (this.config.detectAnimations && this.hasAnimationCharacteristics(changes)) {
      return CorrelationType.ANIMATED;
    }

    // Delayed response
    if (delay > 500) {
      return CorrelationType.DELAYED;
    }

    // Check if part of a sequence
    const eventHistory = this.correlationHistory.get(event.id);
    if (eventHistory && eventHistory.length > 1) {
      return CorrelationType.SEQUENTIAL;
    }

    // Default to unclear if no clear pattern
    if (changes.changePercentage < 1) {
      return CorrelationType.UNCLEAR;
    }

    return CorrelationType.DIRECT;
  }

  /**
   * Calculate spatial proximity between changes and event
   */
  private calculateSpatialProximity(
    regions: Region[],
    event: InteractionEvent
  ): number {
    if (regions.length === 0) return 0;

    let minDistance = Infinity;

    for (const region of regions) {
      const regionCenterX = region.bounds.x + region.bounds.width / 2;
      const regionCenterY = region.bounds.y + region.bounds.height / 2;

      const distance = Math.sqrt(
        Math.pow(regionCenterX - event.target.x, 2) +
        Math.pow(regionCenterY - event.target.y, 2)
      );

      minDistance = Math.min(minDistance, distance);
    }

    // Normalize to 0-1 (1 being very close)
    return Math.max(0, 1 - (minDistance / this.config.spatialThreshold));
  }

  /**
   * Calculate confidence score for correlation
   */
  private calculateConfidence(
    changes: ChangeMap,
    event: InteractionEvent,
    delay: number,
    spatialProximity: number,
    correlationType: CorrelationType
  ): number {
    let confidence = 0;

    // Temporal factor (closer in time = higher confidence)
    const temporalScore = Math.max(0, 1 - (delay / this.config.maxCorrelationDelay));
    confidence += temporalScore * 0.3;

    // Spatial factor
    confidence += spatialProximity * 0.3;

    // Change magnitude factor
    const magnitudeScore = Math.min(changes.changePercentage / 10, 1);
    confidence += magnitudeScore * 0.2;

    // Correlation type factor
    const typeScore = this.getCorrelationTypeScore(correlationType);
    confidence += typeScore * 0.2;

    return Math.min(confidence, 1);
  }

  /**
   * Get confidence score for correlation type
   */
  private getCorrelationTypeScore(type: CorrelationType): number {
    switch (type) {
      case CorrelationType.DIRECT:
        return 1.0;
      case CorrelationType.ANIMATED:
        return 0.9;
      case CorrelationType.SEQUENTIAL:
        return 0.8;
      case CorrelationType.DELAYED:
        return 0.6;
      case CorrelationType.UNCLEAR:
        return 0.3;
      default:
        return 0.5;
    }
  }

  /**
   * Check if changes have animation characteristics
   */
  private hasAnimationCharacteristics(changes: ChangeMap): boolean {
    // Look for smooth transitions and gradual changes
    const hasGradualChange = changes.overallIntensity > 0.3 && changes.overallIntensity < 0.7;
    const hasMultipleRegions = changes.regions.length > 2;
    const hasMovement = changes.regions.some(r => r.changeType === 'movement');

    return hasGradualChange || (hasMultipleRegions && hasMovement);
  }

  /**
   * Add correlation to history
   */
  private addToHistory(eventId: string, correlation: Correlation): void {
    if (!this.correlationHistory.has(eventId)) {
      this.correlationHistory.set(eventId, []);
    }
    this.correlationHistory.get(eventId)!.push(correlation);

    // Limit history size
    if (this.correlationHistory.size > 1000) {
      const firstKey = this.correlationHistory.keys().next().value;
      if (firstKey !== undefined) {
        this.correlationHistory.delete(firstKey);
      }
    }
  }

  /**
   * Generate unique ID for causal chain
   */
  private generateChainId(trigger: InteractionEvent): string {
    return `chain_${trigger.id}_${Date.now()}`;
  }

  /**
   * Calculate confidence for entire chain
   */
  private calculateChainConfidence(correlations: Correlation[]): number {
    if (correlations.length === 0) return 0;

    const avgConfidence = correlations.reduce((sum, c) => sum + c.confidence, 0) / correlations.length;
    
    // Penalize very long chains
    const lengthPenalty = Math.max(0, 1 - (correlations.length - 5) * 0.1);
    
    return avgConfidence * lengthPenalty;
  }

  /**
   * Find when visual changes settle to stable state
   */
  private findSettlingTime(correlations: Correlation[]): number {
    if (correlations.length === 0) return 0;

    const trigger = correlations[0].event;
    let settlingTime = 0;

    // Find last significant change
    for (let i = correlations.length - 1; i >= 0; i--) {
      if (correlations[i].changes.changePercentage > 1) {
        settlingTime = correlations[i].event.timestamp - trigger.timestamp;
        break;
      }
    }

    return settlingTime;
  }

  /**
   * Find time of peak visual change
   */
  private findPeakChangeTime(correlations: Correlation[]): number {
    if (correlations.length === 0) return 0;

    const trigger = correlations[0].event;
    let peakTime = 0;
    let maxChange = 0;

    for (const correlation of correlations) {
      if (correlation.changes.changePercentage > maxChange) {
        maxChange = correlation.changes.changePercentage;
        peakTime = correlation.event.timestamp - trigger.timestamp;
      }
    }

    return peakTime;
  }

  /**
   * Detect animation patterns in correlations
   */
  private detectAnimationPattern(correlations: Correlation[]): {
    hasAnimation: boolean;
    duration?: number;
    easingFunction?: string;
  } {
    if (!this.config.detectAnimations || correlations.length < 3) {
      return { hasAnimation: false };
    }

    // Look for smooth progression of changes
    const changeProgression = correlations.map(c => c.changes.changePercentage);
    const isSmooth = this.isProgressionSmooth(changeProgression);

    if (!isSmooth) {
      return { hasAnimation: false };
    }

    // Calculate animation duration
    const firstChange = correlations.find(c => c.changes.changePercentage > 1);
    const lastChange = [...correlations].reverse().find(c => c.changes.changePercentage > 1);

    if (!firstChange || !lastChange) {
      return { hasAnimation: false };
    }

    const duration = lastChange.event.timestamp - firstChange.event.timestamp;

    // Detect easing function
    const easingFunction = this.detectEasingFunction(changeProgression);

    return {
      hasAnimation: true,
      duration,
      easingFunction
    };
  }

  /**
   * Check if change progression is smooth (animation-like)
   */
  private isProgressionSmooth(progression: number[]): boolean {
    if (progression.length < 3) return false;

    let smoothTransitions = 0;
    for (let i = 1; i < progression.length - 1; i++) {
      const prev = progression[i - 1];
      const curr = progression[i];
      const next = progression[i + 1];

      // Check if current value is between neighbors (smooth transition)
      if ((prev <= curr && curr <= next) || (prev >= curr && curr >= next)) {
        smoothTransitions++;
      }
    }

    return smoothTransitions / (progression.length - 2) > 0.7;
  }

  /**
   * Detect easing function from change progression
   */
  private detectEasingFunction(progression: number[]): string {
    if (progression.length < 5) return 'linear';

    // Normalize progression to 0-1
    const max = Math.max(...progression);
    const normalized = progression.map(p => p / max);

    // Calculate acceleration patterns
    const accelerations: number[] = [];
    for (let i = 1; i < normalized.length - 1; i++) {
      const accel = normalized[i + 1] - 2 * normalized[i] + normalized[i - 1];
      accelerations.push(accel);
    }

    const avgAccel = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;

    // Classify based on acceleration pattern
    if (Math.abs(avgAccel) < 0.05) {
      return 'linear';
    } else if (avgAccel > 0.1) {
      return 'ease-in';
    } else if (avgAccel < -0.1) {
      return 'ease-out';
    } else {
      // Check for ease-in-out pattern
      const firstHalfAccel = accelerations.slice(0, Math.floor(accelerations.length / 2));
      const secondHalfAccel = accelerations.slice(Math.floor(accelerations.length / 2));
      
      const firstAvg = firstHalfAccel.reduce((a, b) => a + b, 0) / firstHalfAccel.length;
      const secondAvg = secondHalfAccel.reduce((a, b) => a + b, 0) / secondHalfAccel.length;
      
      if (firstAvg > 0 && secondAvg < 0) {
        return 'ease-in-out';
      }
    }

    return 'custom';
  }

  /**
   * Clear correlation history
   */
  clearHistory(): void {
    this.correlationHistory.clear();
    logger.info('Correlation history cleared');
  }

  /**
   * Get correlation history for an event
   */
  getEventHistory(eventId: string): Correlation[] {
    return this.correlationHistory.get(eventId) || [];
  }

  /**
   * Analyze correlation patterns across multiple events
   */
  analyzePatterns(): {
    commonDelays: number[];
    commonTypes: CorrelationType[];
    averageConfidence: number;
  } {
    const allCorrelations: Correlation[] = [];
    for (const correlations of this.correlationHistory.values()) {
      allCorrelations.push(...correlations);
    }

    if (allCorrelations.length === 0) {
      return {
        commonDelays: [],
        commonTypes: [],
        averageConfidence: 0
      };
    }

    // Find common delays
    const delays = allCorrelations.map(c => c.delay);
    const commonDelays = this.findCommonValues(delays, 50); // 50ms buckets

    // Find common correlation types
    const types = allCorrelations.map(c => c.correlationType);
    const typeFrequency = new Map<CorrelationType, number>();
    for (const type of types) {
      typeFrequency.set(type, (typeFrequency.get(type) || 0) + 1);
    }
    const commonTypes = Array.from(typeFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    // Calculate average confidence
    const averageConfidence = allCorrelations.reduce((sum, c) => sum + c.confidence, 0) / allCorrelations.length;

    return {
      commonDelays,
      commonTypes,
      averageConfidence
    };
  }

  /**
   * Find common values in an array (with bucketing)
   */
  private findCommonValues(values: number[], bucketSize: number): number[] {
    const buckets = new Map<number, number>();

    for (const value of values) {
      const bucket = Math.floor(value / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    return Array.from(buckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([bucket]) => bucket);
  }
}