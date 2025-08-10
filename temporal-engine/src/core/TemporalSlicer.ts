import { createLogger, logPerformance, logMemoryUsage } from '../utils/logger';
import { ChangeDetector } from './ChangeDetector';
import { EventCorrelator } from './EventCorrelator';
import {
  Frame,
  InteractionEvent,
  TemporalSlice,
  TemporalSlicerConfig,
  ChangeType,
  TemporalAnalysisResult
} from '../types';

const logger = createLogger('TemporalSlicer');

/**
 * Creates temporal slices by analyzing frames and correlating with events
 */
export class TemporalSlicer {
  private config: Required<TemporalSlicerConfig>;
  private changeDetector: ChangeDetector;
  private eventCorrelator: EventCorrelator;
  private frameBuffer: Map<string, Frame> = new Map();

  constructor(
    changeDetector: ChangeDetector,
    eventCorrelator: EventCorrelator,
    config: Partial<TemporalSlicerConfig> = {}
  ) {
    this.changeDetector = changeDetector;
    this.eventCorrelator = eventCorrelator;
    
    this.config = {
      changeThreshold: config.changeThreshold ?? 0.01, // 1% change
      minSliceDuration: config.minSliceDuration ?? 50, // 50ms
      maxSliceDuration: config.maxSliceDuration ?? 5000, // 5 seconds
      mergeAdjacentSlices: config.mergeAdjacentSlices ?? true,
      correlationThreshold: config.correlationThreshold ?? 0.7
    };

    logger.info('TemporalSlicer initialized', { config: this.config });
  }

  /**
   * Create temporal slices from frames and events
   */
  async createSlices(frames: Frame[], events: InteractionEvent[]): Promise<TemporalSlice[]> {
    const startTime = Date.now();
    logger.info('Creating temporal slices', {
      frameCount: frames.length,
      eventCount: events.length
    });

    try {
      // Validate input
      if (frames.length < 2) {
        throw new Error('At least 2 frames required for temporal analysis');
      }

      // Sort frames by timestamp
      const sortedFrames = [...frames].sort((a, b) => a.timestamp - b.timestamp);
      
      // Build frame buffer for quick access
      this.buildFrameBuffer(sortedFrames);

      // Detect keyframes
      const keyframeIndices = await this.detectKeyframes(sortedFrames);
      logger.debug('Keyframes detected', { count: keyframeIndices.length });

      // Create initial slices from keyframes
      let slices = await this.createSlicesFromKeyframes(sortedFrames, keyframeIndices);

      // Correlate with events
      slices = await this.correlateWithEvents(slices, events);

      // Merge adjacent slices if configured
      if (this.config.mergeAdjacentSlices) {
        slices = this.mergeAdjacentSlices(slices);
      }

      // Filter out low-confidence slices
      slices = slices.filter(slice => slice.confidence >= this.config.correlationThreshold);

      logPerformance('createSlices', startTime, {
        inputFrames: frames.length,
        outputSlices: slices.length,
        keyframes: keyframeIndices.length
      });

      logMemoryUsage('After slice creation');

      return slices;
    } catch (error) {
      logger.error('Error creating temporal slices', { error });
      throw error;
    } finally {
      // Clear frame buffer to free memory
      this.frameBuffer.clear();
    }
  }

  /**
   * Analyze frames and events to produce comprehensive results
   */
  async analyze(frames: Frame[], events: InteractionEvent[]): Promise<TemporalAnalysisResult> {
    const startTime = Date.now();
    logger.info('Starting temporal analysis');

    try {
      // Create temporal slices
      const slices = await this.createSlices(frames, events);

      // Build causal chains
      const correlations = slices.flatMap(slice => 
        slice.events.map(event => 
          this.eventCorrelator.correlate(
            {
              changedPixels: 0, // Will be calculated from slice
              changePercentage: slice.changedRegions.length * 10, // Estimate
              regions: slice.changedRegions,
              overallIntensity: slice.confidence,
              metrics: {
                mse: 0,
                psnr: 0,
                ssim: 0,
                histogramDiff: 0,
                edgeDiff: 0,
                colorDiff: 0
              }
            },
            event
          )
        )
      );

      const causalChains = correlations.length > 0 ? 
        [this.eventCorrelator.buildCausalChain(correlations)] : [];

      // Calculate statistics
      const statistics = this.calculateStatistics(frames, events, slices);

      const result: TemporalAnalysisResult = {
        slices,
        causalChains,
        statistics
      };

      logPerformance('analyze', startTime, {
        sliceCount: slices.length,
        chainCount: causalChains.length
      });

      return result;
    } catch (error) {
      logger.error('Error in temporal analysis', { error });
      throw error;
    }
  }

  /**
   * Detect keyframes based on visual changes
   */
  private async detectKeyframes(frames: Frame[]): Promise<number[]> {
    const startTime = Date.now();
    const keyframes: number[] = [0]; // First frame is always a keyframe

    for (let i = 1; i < frames.length; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];

      // Skip if frames are too close in time
      if (currFrame.timestamp - prevFrame.timestamp < this.config.minSliceDuration) {
        continue;
      }

      try {
        // Detect changes between frames
        const changes = await this.changeDetector.detectChanges(
          prevFrame.data,
          currFrame.data
        );

        // Mark as keyframe if significant change detected
        if (changes.changePercentage > this.config.changeThreshold * 100) {
          keyframes.push(i);
          logger.debug('Keyframe detected', {
            frameIndex: i,
            changePercentage: changes.changePercentage,
            timestamp: currFrame.timestamp
          });
        }

        // Force keyframe if too much time has passed
        const lastKeyframeIndex = keyframes[keyframes.length - 1];
        const timeSinceLastKeyframe = currFrame.timestamp - frames[lastKeyframeIndex].timestamp;
        if (timeSinceLastKeyframe > this.config.maxSliceDuration) {
          keyframes.push(i);
          logger.debug('Forced keyframe due to time', {
            frameIndex: i,
            timeSinceLastKeyframe
          });
        }
      } catch (error) {
        logger.warn('Error detecting changes for frame', {
          frameIndex: i,
          error
        });
      }
    }

    // Ensure last frame is included
    if (keyframes[keyframes.length - 1] !== frames.length - 1) {
      keyframes.push(frames.length - 1);
    }

    logPerformance('detectKeyframes', startTime, {
      frameCount: frames.length,
      keyframeCount: keyframes.length
    });

    return keyframes;
  }

  /**
   * Create temporal slices from keyframe indices
   */
  private async createSlicesFromKeyframes(
    frames: Frame[],
    keyframeIndices: number[]
  ): Promise<TemporalSlice[]> {
    const slices: TemporalSlice[] = [];

    for (let i = 0; i < keyframeIndices.length - 1; i++) {
      const startIdx = keyframeIndices[i];
      const endIdx = keyframeIndices[i + 1];

      const startFrame = frames[startIdx];
      const endFrame = frames[endIdx];
      const sliceFrames = frames.slice(startIdx, endIdx + 1);

      try {
        // Detect changes for this slice
        const changes = await this.changeDetector.detectChanges(
          startFrame.data,
          endFrame.data
        );

        // Determine primary change type
        const changeType = this.determinePrimaryChangeType(changes.regions);

        const slice: TemporalSlice = {
          id: `slice_${startFrame.timestamp}_${endFrame.timestamp}`,
          startTime: startFrame.timestamp,
          endTime: endFrame.timestamp,
          startFrame,
          endFrame,
          frames: sliceFrames,
          events: [], // Will be populated during correlation
          changeType,
          changedRegions: changes.regions,
          confidence: this.calculateSliceConfidence(changes, sliceFrames.length)
        };

        slices.push(slice);
      } catch (error) {
        logger.warn('Error creating slice', {
          startIdx,
          endIdx,
          error
        });
      }
    }

    return slices;
  }

  /**
   * Correlate temporal slices with interaction events
   */
  private async correlateWithEvents(
    slices: TemporalSlice[],
    events: InteractionEvent[]
  ): Promise<TemporalSlice[]> {
    const correlatedSlices = [...slices];

    for (const event of events) {
      // Find slices that could be affected by this event
      const affectedSlices = correlatedSlices.filter(slice => {
        // Event should occur before or during the slice
        return event.timestamp >= slice.startTime - this.config.maxSliceDuration &&
               event.timestamp <= slice.endTime;
      });

      for (const slice of affectedSlices) {
        // Calculate correlation
        const changeMap = {
          changedPixels: slice.changedRegions.reduce((sum, r) => 
            sum + r.bounds.width * r.bounds.height, 0),
          changePercentage: slice.changedRegions.length * 10, // Estimate
          regions: slice.changedRegions,
          overallIntensity: slice.confidence,
          metrics: {
            mse: 0,
            psnr: 0,
            ssim: 0,
            histogramDiff: 0,
            edgeDiff: 0,
            colorDiff: 0
          }
        };

        const correlation = this.eventCorrelator.correlate(changeMap, event);

        // Add event to slice if correlation is strong enough
        if (correlation.confidence >= this.config.correlationThreshold) {
          slice.events.push(event);
          // Update slice confidence based on correlation
          slice.confidence = Math.max(slice.confidence, correlation.confidence);
        }
      }
    }

    return correlatedSlices;
  }

  /**
   * Merge adjacent slices with similar characteristics
   */
  private mergeAdjacentSlices(slices: TemporalSlice[]): TemporalSlice[] {
    if (slices.length < 2) return slices;

    const merged: TemporalSlice[] = [];
    let currentMergeGroup: TemporalSlice[] = [slices[0]];

    for (let i = 1; i < slices.length; i++) {
      const prevSlice = currentMergeGroup[currentMergeGroup.length - 1];
      const currSlice = slices[i];

      // Check if slices should be merged
      if (this.shouldMergeSlices(prevSlice, currSlice)) {
        currentMergeGroup.push(currSlice);
      } else {
        // Merge current group and start new one
        merged.push(this.mergeSliceGroup(currentMergeGroup));
        currentMergeGroup = [currSlice];
      }
    }

    // Don't forget the last group
    if (currentMergeGroup.length > 0) {
      merged.push(this.mergeSliceGroup(currentMergeGroup));
    }

    logger.debug('Merged slices', {
      originalCount: slices.length,
      mergedCount: merged.length
    });

    return merged;
  }

  /**
   * Determine if two slices should be merged
   */
  private shouldMergeSlices(slice1: TemporalSlice, slice2: TemporalSlice): boolean {
    // Check temporal proximity
    const timeGap = slice2.startTime - slice1.endTime;
    if (timeGap > this.config.minSliceDuration * 2) {
      return false;
    }

    // Check change type similarity
    if (slice1.changeType !== slice2.changeType && 
        slice1.changeType !== ChangeType.COMPLEX &&
        slice2.changeType !== ChangeType.COMPLEX) {
      return false;
    }

    // Check confidence similarity
    const confidenceDiff = Math.abs(slice1.confidence - slice2.confidence);
    if (confidenceDiff > 0.3) {
      return false;
    }

    // Check if they share events
    const sharedEvents = slice1.events.filter(e1 => 
      slice2.events.some(e2 => e2.id === e1.id)
    );
    if (sharedEvents.length > 0) {
      return true;
    }

    // Check spatial overlap of changed regions
    const hasOverlap = slice1.changedRegions.some(r1 =>
      slice2.changedRegions.some(r2 => this.regionsOverlap(r1.bounds, r2.bounds))
    );

    return hasOverlap;
  }

  /**
   * Check if two regions overlap
   */
  private regionsOverlap(
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(r1.x + r1.width < r2.x ||
             r2.x + r2.width < r1.x ||
             r1.y + r1.height < r2.y ||
             r2.y + r2.height < r1.y);
  }

  /**
   * Merge a group of slices into one
   */
  private mergeSliceGroup(group: TemporalSlice[]): TemporalSlice {
    if (group.length === 1) return group[0];

    const firstSlice = group[0];
    const lastSlice = group[group.length - 1];

    // Combine all frames
    const allFrames: Frame[] = [];
    const seenFrameIds = new Set<string>();
    
    for (const slice of group) {
      for (const frame of slice.frames) {
        if (!seenFrameIds.has(frame.id)) {
          allFrames.push(frame);
          seenFrameIds.add(frame.id);
        }
      }
    }

    // Combine all events
    const allEvents: InteractionEvent[] = [];
    const seenEventIds = new Set<string>();
    
    for (const slice of group) {
      for (const event of slice.events) {
        if (!seenEventIds.has(event.id)) {
          allEvents.push(event);
          seenEventIds.add(event.id);
        }
      }
    }

    // Combine all changed regions
    const allRegions = group.flatMap(s => s.changedRegions);

    // Determine merged change type
    const changeTypes = group.map(s => s.changeType);
    const uniqueTypes = [...new Set(changeTypes)];
    const mergedChangeType = uniqueTypes.length === 1 ? uniqueTypes[0] : ChangeType.COMPLEX;

    // Calculate merged confidence
    const avgConfidence = group.reduce((sum, s) => sum + s.confidence, 0) / group.length;

    return {
      id: `merged_${firstSlice.startTime}_${lastSlice.endTime}`,
      startTime: firstSlice.startTime,
      endTime: lastSlice.endTime,
      startFrame: firstSlice.startFrame,
      endFrame: lastSlice.endFrame,
      frames: allFrames,
      events: allEvents,
      changeType: mergedChangeType,
      changedRegions: allRegions,
      confidence: avgConfidence
    };
  }

  /**
   * Build frame buffer for quick access
   */
  private buildFrameBuffer(frames: Frame[]): void {
    this.frameBuffer.clear();
    for (const frame of frames) {
      this.frameBuffer.set(frame.id, frame);
    }
  }

  /**
   * Determine primary change type from regions
   */
  private determinePrimaryChangeType(regions: TemporalSlice['changedRegions']): ChangeType {
    if (regions.length === 0) return ChangeType.NONE;

    // Count occurrences of each change type
    const typeCounts = new Map<ChangeType, number>();
    
    for (const region of regions) {
      const count = typeCounts.get(region.changeType) || 0;
      typeCounts.set(region.changeType, count + 1);
    }

    // Find most common type
    let maxCount = 0;
    let primaryType = ChangeType.COMPLEX;
    
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryType = type;
      }
    }

    // If multiple types are equally common, it's complex
    const equallyCommon = Array.from(typeCounts.values()).filter(c => c === maxCount).length;
    if (equallyCommon > 1) {
      return ChangeType.COMPLEX;
    }

    return primaryType;
  }

  /**
   * Calculate confidence score for a slice
   */
  private calculateSliceConfidence(changes: any, frameCount: number): number {
    // Base confidence on change magnitude
    let confidence = Math.min(changes.changePercentage / 10, 1) * 0.5;

    // Factor in number of frames (more frames = more confidence)
    confidence += Math.min(frameCount / 30, 1) * 0.3;

    // Factor in region count (multiple regions = higher confidence)
    confidence += Math.min(changes.regions.length / 5, 1) * 0.2;

    return Math.min(confidence, 1);
  }

  /**
   * Calculate statistics for the analysis
   */
  private calculateStatistics(
    frames: Frame[],
    events: InteractionEvent[],
    slices: TemporalSlice[]
  ): TemporalAnalysisResult['statistics'] {
    const changeTypeCounts = new Map<ChangeType, number>();
    
    for (const slice of slices) {
      const count = changeTypeCounts.get(slice.changeType) || 0;
      changeTypeCounts.set(slice.changeType, count + 1);
    }

    const mostCommonChangeType = Array.from(changeTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || ChangeType.NONE;

    const totalDuration = slices.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    const averageSliceDuration = slices.length > 0 ? totalDuration / slices.length : 0;

    return {
      totalFrames: frames.length,
      totalEvents: events.length,
      totalSlices: slices.length,
      averageSliceDuration,
      mostCommonChangeType,
      totalProcessingTime: Date.now() - frames[0].timestamp
    };
  }

  /**
   * Get frame by ID from buffer
   */
  private getFrame(frameId: string): Frame | undefined {
    return this.frameBuffer.get(frameId);
  }

  /**
   * Clear internal buffers
   */
  clearBuffers(): void {
    this.frameBuffer.clear();
    this.eventCorrelator.clearHistory();
    logger.info('Internal buffers cleared');
  }
}