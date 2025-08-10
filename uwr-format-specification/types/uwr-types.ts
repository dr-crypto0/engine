/**
 * Universal Website Representation (UWR) Format Type Definitions
 * Version 1.0
 * 
 * These types define the complete structure of the UWR format for
 * capturing websites with ≥99.9% visual and behavioral fidelity.
 */

// ============================================================================
// Root Document Structure
// ============================================================================

export interface UWRDocument {
  version: string;
  metadata: Metadata;
  visualData: VisualData;
  molecules: Molecule[];
  stateGraph: StateGraph;
  executionTrace: ExecutionTrace;
  behavioralEquations: BehavioralEquation[];
  validationChecksums: ValidationChecksums;
}

// ============================================================================
// Metadata Types
// ============================================================================

export interface Metadata {
  captureId: string;
  captureTimestamp: string; // ISO 8601
  captureEnvironment: CaptureEnvironment;
  targetUrl: string;
  fidelityScore: FidelityScore;
  viewportConfigurations: ViewportConfig[];
  captureSettings: CaptureSettings;
  edgeCasesDetected: EdgeCase[];
}

export interface CaptureEnvironment {
  platform: "windows" | "linux" | "macos";
  browserEngine: string;
  gpuInfo: GPUInfo;
  displayInfo: DisplayInfo;
}

export interface GPUInfo {
  vendor: string;
  model: string;
  driver: string;
  vram: number; // in MB
  features: string[];
}

export interface DisplayInfo {
  resolution: [number, number];
  dpi: number;
  colorDepth: number;
  refreshRate: number;
  hdr: boolean;
}

export interface FidelityScore {
  overall: number; // 0.0 to 1.0
  visual: number;
  behavioral: number;
  timing: number;
  color: number;
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
  hasTouch: boolean;
}

export interface CaptureSettings {
  frameRate: number; // 60-240 fps
  colorSpace: "srgb" | "p3" | "rec2020";
  captureMode: "full" | "incremental" | "adaptive";
  interactionDepth: number;
  scrollStrategy: "exhaustive" | "intelligent" | "sampled";
  networkThrottling: NetworkThrottling | null;
}

export interface NetworkThrottling {
  downloadThroughput: number; // bytes/s
  uploadThroughput: number;
  latency: number; // ms
}

export interface EdgeCase {
  type: EdgeCaseType;
  description: string;
  handlingStrategy: string;
  occurrences: number;
}

export type EdgeCaseType =
  | "infinite_scroll"
  | "real_time_data"
  | "webrtc_stream"
  | "authentication"
  | "ab_testing"
  | "geo_restriction"
  | "rate_limiting"
  | "pwa_offline"
  | "custom";

// ============================================================================
// Visual Data Types
// ============================================================================

export interface VisualData {
  tensor4D: Tensor4D;
  keyframes: Keyframe[];
  depthMaps: DepthMap[];
  colorProfiles: ColorProfile[];
}

export interface Tensor4D {
  format: "float32" | "uint16" | "compressed";
  dimensions: [number, number, number, number]; // [width, height, depth, time]
  encoding: "raw" | "h265" | "av1" | "custom";
  dataUrl: string;
  compressionRatio: number;
  temporalResolution: number;
  spatialResolution: [number, number];
  bitDepth: number;
}

export interface Keyframe {
  timestamp: number; // ms from start
  significance: "major" | "minor" | "transition";
  visualHash: string;
  deltaFromPrevious: number;
  associatedEvents: string[];
}

export interface DepthMap {
  timestamp: number;
  resolution: [number, number];
  encoding: "float32" | "uint16";
  dataUrl: string;
  minDepth: number;
  maxDepth: number;
}

export interface ColorProfile {
  space: "srgb" | "p3" | "rec2020" | "lab";
  gamut: number[][];
  whitePoint: [number, number];
  transferFunction: string;
}

// ============================================================================
// Molecular Element Types
// ============================================================================

export interface Molecule {
  id: string;
  type: MoleculeType;
  visualSignature: VisualSignature;
  bounds: Bounds;
  properties: Properties;
  interactions: Interactions;
  relationships: Relationship[];
  lifecycle: Lifecycle;
}

export type MoleculeType =
  | "text"
  | "image"
  | "video"
  | "canvas"
  | "webgl"
  | "interactive_button"
  | "input_field"
  | "container"
  | "navigation"
  | "animation_particle"
  | "svg_element"
  | "iframe"
  | "custom";

export interface VisualSignature {
  primaryImage: string; // base64
  alternateStates: Record<string, string>;
  colorFingerprint: number[];
  shapeDescriptor: number[];
  texturePattern: string;
}

export interface Bounds {
  static: BoundingBox | null;
  dynamic: string | null; // timeline file reference
  transformations: Transformation[];
  zIndex: number | "dynamic";
  opacity: number | "dynamic";
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transformation {
  type: "translate" | "rotate" | "scale" | "skew" | "matrix";
  values: number[];
  origin: [number, number, number];
  timing: TransformTiming;
}

export interface TransformTiming {
  start: number;
  duration: number;
  easing: string;
}

export interface Properties {
  visual: VisualProperties;
  behavioral: BehavioralProperties;
  semantic: SemanticProperties;
  performance: PerformanceProperties;
}

export interface VisualProperties {
  backgroundColor: ColorValue;
  borderColor: ColorValue;
  textColor: ColorValue;
  fontSize: SizeValue;
  fontFamily: string;
  boxShadow: ShadowValue[];
  filter: FilterValue[];
  clipPath: string | null;
}

export interface BehavioralProperties {
  scrollable: boolean;
  draggable: boolean;
  focusable: boolean;
  hoverable: boolean;
  clickable: boolean;
  inputType: string | null;
  validationRules: ValidationRule[];
}

export interface SemanticProperties {
  role: string | null;
  label: string | null;
  description: string | null;
  language: string | null;
  importance: number; // 0-1
}

export interface PerformanceProperties {
  renderTime: number; // ms
  paintTime: number;
  layoutTime: number;
  gpuAccelerated: boolean;
  layerCount: number;
}

export interface Interactions {
  click: InteractionHandler | null;
  hover: InteractionHandler | null;
  focus: InteractionHandler | null;
  scroll: InteractionHandler | null;
  drag: InteractionHandler | null;
  input: InteractionHandler | null;
  custom: Record<string, InteractionHandler>;
}

export interface InteractionHandler {
  resultingState: string;
  timing: InteractionTiming;
  preventDefault: boolean;
  stopPropagation: boolean;
  conditions: Condition[];
}

export interface InteractionTiming {
  delay: number;
  duration: number;
  debounce: number;
  throttle: number;
}

export interface Condition {
  type: "state" | "variable" | "time" | "viewport";
  operator: "equals" | "greater" | "less" | "contains" | "matches";
  value: any;
}

export interface Relationship {
  type: RelationshipType;
  target: string; // molecule ID
  strength: number; // 0-1
  bidirectional: boolean;
  metadata: Record<string, any>;
}

export type RelationshipType =
  | "parent"
  | "child"
  | "sibling"
  | "reference"
  | "dependency"
  | "visual_group"
  | "semantic_group"
  | "interaction_group";

export interface Lifecycle {
  created: LifecycleEvent;
  modified: LifecycleEvent[];
  destroyed: LifecycleEvent | null;
  visibility: VisibilityTimeline;
}

export interface LifecycleEvent {
  timestamp: number;
  trigger: string;
  fromState: string | null;
  toState: string;
}

export interface VisibilityTimeline {
  visible: TimeRange[];
  hidden: TimeRange[];
  partial: TimeRange[];
}

export interface TimeRange {
  start: number;
  end: number;
}

// ============================================================================
// State Graph Types
// ============================================================================

export interface StateGraph {
  nodes: StateNode[];
  edges: StateTransition[];
  initialState: string;
  terminalStates: string[];
  stateGroups: StateGroup[];
}

export interface StateNode {
  id: string;
  visualHash: string;
  molecules: StateMoleculeSnapshot[];
  timestamp: number;
  frequency: number;
  stability: number;
}

export interface StateMoleculeSnapshot {
  moleculeId: string;
  properties: Record<string, any>;
  bounds: BoundingBox;
  visible: boolean;
}

export interface StateTransition {
  id: string;
  fromState: string;
  toState: string;
  trigger: TransitionTrigger;
  duration: number;
  probability: number;
  reversible: boolean;
  animations: AnimationReference[];
}

export interface TransitionTrigger {
  type: "interaction" | "time" | "scroll" | "network" | "media" | "system";
  details: any;
  conditions: Condition[];
}

export interface AnimationReference {
  moleculeId: string;
  animationType: string;
  duration: number;
  easing: string;
  keyframes: AnimationKeyframe[];
}

export interface AnimationKeyframe {
  offset: number; // 0-1
  properties: Record<string, any>;
}

export interface StateGroup {
  id: string;
  name: string;
  states: string[];
  type: "sequential" | "parallel" | "exclusive";
  metadata: Record<string, any>;
}

// ============================================================================
// Execution Trace Types
// ============================================================================

export interface ExecutionTrace {
  renderingCommands: RenderCommand[];
  networkSequence: NetworkEvent[];
  computedStyles: ComputedStyle[];
  performanceMetrics: PerformanceMetric[];
  consoleOutput: ConsoleEntry[];
  memorySnapshots: MemorySnapshot[];
}

export interface RenderCommand {
  timestamp: number;
  type: "paint" | "composite" | "layout" | "style";
  target: string;
  command: any;
  duration: number;
  gpuAccelerated: boolean;
}

export interface NetworkEvent {
  timestamp: number;
  type: "fetch" | "websocket" | "webrtc" | "other";
  url: string;
  method: string;
  headers: Record<string, string>;
  payload: string | null;
  response: NetworkResponse;
  timing: NetworkTiming;
}

export interface NetworkResponse {
  status: number;
  headers: Record<string, string>;
  body: string | null;
  size: number;
}

export interface NetworkTiming {
  dns: number;
  connect: number;
  ssl: number;
  request: number;
  response: number;
  total: number;
}

export interface ComputedStyle {
  timestamp: number;
  moleculeId: string;
  styles: Record<string, any>;
  inherited: string[]; // parent molecule IDs
  cascadeOrder: number;
}

export interface PerformanceMetric {
  timestamp: number;
  type: "fps" | "memory" | "cpu" | "gpu";
  value: number;
  context: string;
}

export interface ConsoleEntry {
  timestamp: number;
  level: "log" | "warn" | "error" | "info";
  message: string;
  source: string;
  stackTrace: string | null;
}

export interface MemorySnapshot {
  timestamp: number;
  heapSize: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

// ============================================================================
// Behavioral Equation Types
// ============================================================================

export interface BehavioralEquation {
  id: string;
  element: string;
  property: string;
  equation: string;
  variables: Variable[];
  constraints: Constraints;
  domain: Domain;
  accuracy: number;
}

export interface Variable {
  name: string;
  type: VariableType;
  range: [number, number];
  unit: string;
}

export type VariableType =
  | "scrollY"
  | "scrollX"
  | "time"
  | "mouseX"
  | "mouseY"
  | "viewportWidth"
  | "viewportHeight"
  | "custom";

export interface Constraints {
  min?: number;
  max?: number;
  step?: number;
  allowedValues?: any[];
}

export interface Domain {
  states: string[];
  timeRange: TimeRange | null;
  viewports: string[];
  conditions: Condition[];
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationChecksums {
  visualDataChecksum: string;
  moleculeTreeChecksum: string;
  stateGraphChecksum: string;
  crossValidation: CrossValidation[];
}

export interface CrossValidation {
  source: string;
  target: string;
  method: "visual_match" | "behavioral_consistency" | "timing_correlation";
  score: number;
  details: any;
}

// ============================================================================
// Helper Types
// ============================================================================

export type ColorValue = string | { static: string } | { dynamic: string };
export type SizeValue = number | { static: number } | { dynamic: string };

export interface ShadowValue {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
}

export interface FilterValue {
  type: "blur" | "brightness" | "contrast" | "grayscale" | "hue-rotate" | "saturate";
  value: number;
  unit: string;
}

export interface ValidationRule {
  type: "required" | "pattern" | "length" | "range" | "custom";
  value: any;
  message: string;
}