/**
 * Type definitions for Visual Capture Engine
 */

export interface CaptureConfig {
  targetFps: number;                    // 60, 120, or 240
  viewport: ViewportConfig;
  bufferSize?: number;                  // Frame buffer size
  enableScrollCapture?: boolean;
  scrollStrategy?: ScrollStrategy;
  outputFormat?: OutputFormat;
  compressionLevel?: number;            // 0-9
  enableWebGLCapture?: boolean;
  enableDepthCapture?: boolean;
  captureMode?: CaptureMode;
}

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

export type ScrollStrategy = 
  | 'exhaustive'      // Capture every pixel
  | 'intelligent'     // Smart detection of content
  | 'sampled'         // Sample at intervals
  | 'user-defined';   // Custom scroll pattern

export type OutputFormat = 
  | 'raw'             // Uncompressed frames
  | 'h265'            // H.265/HEVC encoding
  | 'av1'             // AV1 encoding
  | 'png-sequence'    // Individual PNG files
  | 'uwr-tensor';     // Direct UWR 4D tensor format

export type CaptureMode =
  | 'full'            // Capture everything
  | 'incremental'     // Only capture changes
  | 'adaptive';       // Adjust based on content

export interface Frame {
  id: string;
  timestamp: number;
  data: Buffer;
  scrollPosition: ScrollPosition;
  viewport: ViewportDimensions;
  metrics: FrameMetrics;
  depth?: DepthData;
  webglCommands?: WebGLCommand[];
}

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface FrameMetrics {
  renderTime: number;
  paintTime: number;
  scriptTime: number;
  layerCount?: number;
  gpuMemoryUsage?: number;
}

export interface DepthData {
  format: 'float32' | 'uint16';
  data: ArrayBuffer;
  minDepth: number;
  maxDepth: number;
}

export interface WebGLCommand {
  timestamp: number;
  contextId: string;
  command: string;
  args: any[];
}

export interface CaptureMetrics {
  totalFrames: number;
  droppedFrames: number;
  averageFps: number;
  peakFps: number;
  captureStartTime: number;
  captureEndTime: number;
  memoryUsage: MemoryUsage[];
  cpuUsage: CPUUsage[];
}

export interface MemoryUsage {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export interface CPUUsage {
  timestamp: number;
  percentage: number;
  user: number;
  system: number;
}

export interface ScrollPattern {
  type: 'linear' | 'exponential' | 'custom';
  speed: number;                        // pixels per second
  pauseAtIntervals: boolean;
  intervalDistance: number;             // pixels
  pauseDuration: number;                // milliseconds
}

export interface CaptureSession {
  id: string;
  url: string;
  startTime: number;
  endTime?: number;
  config: CaptureConfig;
  metrics?: CaptureMetrics;
  status: CaptureStatus;
}

export type CaptureStatus = 
  | 'initializing'
  | 'capturing'
  | 'paused'
  | 'completed'
  | 'failed';

export interface FrameProcessor {
  process(frame: Frame): Promise<ProcessedFrame>;
}

export interface ProcessedFrame extends Frame {
  visualHash: string;
  deltaFromPrevious?: number;
  significantChanges?: ChangeRegion[];
}

export interface ChangeRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  changeType: 'content' | 'style' | 'animation';
}

export interface CaptureEventMap {
  'captureStarted': { url: string; timestamp: number };
  'frameCaptured': { frameNumber: number; timestamp: number; fps: number };
  'frameDropped': { reason: string; timestamp: number };
  'scrollPositionChanged': { x: number; y: number };
  'captureStopped': CaptureMetrics;
  'error': { error: Error; context: string };
}

export interface HighPrecisionTimer {
  start(): void;
  stop(): void;
  scheduleNext(callback: () => void, interval: number): void;
  getElapsed(): number;
}

export interface FrameBufferStats {
  size: number;
  capacity: number;
  oldestFrame: number;
  newestFrame: number;
  averageFrameSize: number;
}

export interface ScrollOrchestratorConfig {
  strategy: ScrollStrategy;
  pattern: ScrollPattern;
  viewportHeight: number;
  documentHeight: number;
  checkpoints: ScrollCheckpoint[];
}

export interface ScrollCheckpoint {
  position: number;
  waitForStable: boolean;
  captureDelay: number;
  description: string;
}

export interface PerformanceProfile {
  captureOverhead: number;              // ms per frame
  encodingOverhead: number;             // ms per frame
  memoryPressure: number;               // 0-1 scale
  gpuUtilization: number;               // 0-1 scale
  recommendedFps: number;
}

export interface WebGLContextInfo {
  contextId: string;
  type: 'webgl' | 'webgl2' | 'webgpu';
  canvas: {
    width: number;
    height: number;
  };
  attributes: WebGLContextAttributes;
}

export interface DepthBufferConfig {
  enabled: boolean;
  precision: 'float32' | 'uint16';
  nearPlane: number;
  farPlane: number;
  captureFrequency: number;             // Every N frames
}

export interface OutputConfig {
  format: OutputFormat;
  quality: number;                      // 0-100
  compressionLevel: number;             // 0-9
  keyframeInterval: number;             // For video formats
  bitrate?: number;                     // For video formats
  outputPath: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: {
    visualAccuracy: number;
    timingAccuracy: number;
    completeness: number;
  };
}

export interface ValidationError {
  type: 'missing_frame' | 'corrupt_data' | 'timing_violation';
  description: string;
  frameId?: string;
  timestamp?: number;
}

export interface ValidationWarning {
  type: 'performance' | 'quality' | 'compatibility';
  description: string;
  suggestion: string;
}