/**
 * Type definitions for the Temporal Analysis Engine
 * This module handles keyframe detection and event correlation
 */

/**
 * Represents a single frame captured from the visual capture engine
 */
export interface Frame {
  /** Unique identifier for the frame */
  id: string;
  /** Timestamp when the frame was captured (milliseconds) */
  timestamp: number;
  /** Frame data as a buffer (PNG format) */
  data: Buffer;
  /** Frame dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Frame number in the sequence */
  frameNumber: number;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Represents an interaction event from the interaction discovery system
 */
export interface InteractionEvent {
  /** Unique identifier for the event */
  id: string;
  /** Type of interaction */
  type: 'click' | 'hover' | 'scroll' | 'keypress' | 'drag' | 'focus' | 'blur' | 'custom';
  /** Timestamp when the interaction occurred (milliseconds) */
  timestamp: number;
  /** Target element information */
  target: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    elementId?: string;
  };
  /** Additional event data */
  data?: {
    key?: string;
    button?: number;
    deltaX?: number;
    deltaY?: number;
    scrollTop?: number;
    scrollLeft?: number;
    [key: string]: any;
  };
}

/**
 * Represents a temporal slice - a significant moment in time
 */
export interface TemporalSlice {
  /** Unique identifier for the slice */
  id: string;
  /** Start timestamp of the slice */
  startTime: number;
  /** End timestamp of the slice */
  endTime: number;
  /** Keyframe at the start of the slice */
  startFrame: Frame;
  /** Keyframe at the end of the slice */
  endFrame: Frame;
  /** All frames within this slice */
  frames: Frame[];
  /** Associated interaction events */
  events: InteractionEvent[];
  /** Type of change detected */
  changeType: ChangeType;
  /** Regions that changed */
  changedRegions: Region[];
  /** Confidence score for this slice (0-1) */
  confidence: number;
}

/**
 * Types of changes that can be detected
 */
export enum ChangeType {
  /** No significant change */
  NONE = 'none',
  /** Content appeared */
  APPEARANCE = 'appearance',
  /** Content disappeared */
  DISAPPEARANCE = 'disappearance',
  /** Content moved */
  MOVEMENT = 'movement',
  /** Content transformed (size, rotation, etc.) */
  TRANSFORMATION = 'transformation',
  /** Color or style change */
  STYLE_CHANGE = 'style_change',
  /** Text content change */
  TEXT_CHANGE = 'text_change',
  /** Animation or transition */
  ANIMATION = 'animation',
  /** Complex multi-type change */
  COMPLEX = 'complex'
}

/**
 * Represents a region of change in the frame
 */
export interface Region {
  /** Bounding box of the region */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Type of change in this region */
  changeType: ChangeType;
  /** Confidence score for this detection (0-1) */
  confidence: number;
  /** Pixel-level change intensity (0-1) */
  intensity: number;
  /** Additional properties */
  properties?: {
    previousColor?: string;
    newColor?: string;
    movementVector?: { x: number; y: number };
    transformationMatrix?: number[];
    [key: string]: any;
  };
}

/**
 * Map of changes detected between frames
 */
export interface ChangeMap {
  /** Total number of changed pixels */
  changedPixels: number;
  /** Percentage of frame that changed (0-100) */
  changePercentage: number;
  /** Detected regions of change */
  regions: Region[];
  /** Overall change intensity (0-1) */
  overallIntensity: number;
  /** Difference metrics */
  metrics: DifferenceMetrics;
}

/**
 * Metrics for measuring differences between frames
 */
export interface DifferenceMetrics {
  /** Mean Squared Error */
  mse: number;
  /** Peak Signal-to-Noise Ratio */
  psnr: number;
  /** Structural Similarity Index */
  ssim: number;
  /** Histogram difference */
  histogramDiff: number;
  /** Edge difference */
  edgeDiff: number;
  /** Color distribution difference */
  colorDiff: number;
}

/**
 * Represents a difference map between two frames
 */
export interface DifferenceMap {
  /** Width of the difference map */
  width: number;
  /** Height of the difference map */
  height: number;
  /** Pixel data showing differences */
  data: Uint8Array;
  /** Maximum difference value found */
  maxDifference: number;
  /** Average difference value */
  avgDifference: number;
}

/**
 * Correlation between visual changes and interaction events
 */
export interface Correlation {
  /** The interaction event */
  event: InteractionEvent;
  /** The visual changes detected */
  changes: ChangeMap;
  /** Time delay between event and visual change (ms) */
  delay: number;
  /** Confidence score for this correlation (0-1) */
  confidence: number;
  /** Type of correlation */
  correlationType: CorrelationType;
}

/**
 * Types of correlations between events and changes
 */
export enum CorrelationType {
  /** Direct cause and effect */
  DIRECT = 'direct',
  /** Delayed response */
  DELAYED = 'delayed',
  /** Part of a sequence */
  SEQUENTIAL = 'sequential',
  /** Triggered animation */
  ANIMATED = 'animated',
  /** No clear correlation */
  UNCLEAR = 'unclear'
}

/**
 * Represents a causal chain of events and changes
 */
export interface CausalChain {
  /** Unique identifier for the chain */
  id: string;
  /** Starting event */
  trigger: InteractionEvent;
  /** Sequence of correlations */
  correlations: Correlation[];
  /** Total duration of the chain (ms) */
  duration: number;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Timing profile */
  timing: TimingProfile;
}

/**
 * Timing characteristics of a causal chain
 */
export interface TimingProfile {
  /** Initial response time (ms) */
  initialDelay: number;
  /** Time to reach stable state (ms) */
  settlingTime: number;
  /** Peak change time (ms) */
  peakTime: number;
  /** Whether the change is instantaneous */
  isInstantaneous: boolean;
  /** Whether the change involves animation */
  hasAnimation: boolean;
  /** Animation duration if applicable (ms) */
  animationDuration?: number;
  /** Easing function detected */
  easingFunction?: string;
}

/**
 * Configuration for the temporal slicer
 */
export interface TemporalSlicerConfig {
  /** Minimum change threshold to create a slice (0-1) */
  changeThreshold: number;
  /** Minimum time between slices (ms) */
  minSliceDuration: number;
  /** Maximum time for a single slice (ms) */
  maxSliceDuration: number;
  /** Whether to merge adjacent similar slices */
  mergeAdjacentSlices: boolean;
  /** Confidence threshold for correlations (0-1) */
  correlationThreshold: number;
}

/**
 * Configuration for change detection
 */
export interface ChangeDetectorConfig {
  /** Sensitivity for pixel differences (0-255) */
  pixelThreshold: number;
  /** Minimum region size to consider (pixels) */
  minRegionSize: number;
  /** Whether to use edge detection */
  useEdgeDetection: boolean;
  /** Whether to use color histogram analysis */
  useColorAnalysis: boolean;
  /** Whether to detect text changes */
  detectTextChanges: boolean;
}

/**
 * Configuration for event correlation
 */
export interface EventCorrelatorConfig {
  /** Maximum delay to consider for correlation (ms) */
  maxCorrelationDelay: number;
  /** Spatial proximity threshold (pixels) */
  spatialThreshold: number;
  /** Whether to detect animation patterns */
  detectAnimations: boolean;
  /** Whether to build causal chains */
  buildCausalChains: boolean;
}

/**
 * Result of temporal analysis
 */
export interface TemporalAnalysisResult {
  /** All detected temporal slices */
  slices: TemporalSlice[];
  /** All causal chains identified */
  causalChains: CausalChain[];
  /** Summary statistics */
  statistics: {
    totalFrames: number;
    totalEvents: number;
    totalSlices: number;
    averageSliceDuration: number;
    mostCommonChangeType: ChangeType;
    totalProcessingTime: number;
  };
}