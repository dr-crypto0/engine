# Universal Website Representation (UWR) Format Specification v1.0

## Overview

The Universal Website Representation (UWR) format is a revolutionary data structure designed to capture websites with ≥99.9% visual and behavioral fidelity without traditional DOM parsing. It represents websites as multi-dimensional visual and behavioral phenomena rather than code structures.

## Core Principles

1. **Visual-First**: All data originates from visual observation
2. **Behavioral Completeness**: Every possible state and transition is recorded
3. **Zero Assumptions**: No interpolation or guessing of missing data
4. **Platform Agnostic**: Can be compiled to any target technology
5. **Redundant Verification**: Multiple data sources validate each other

## Format Structure

### 1. Root Container

```typescript
interface UWRDocument {
  version: string;                    // Format version (e.g., "1.0")
  metadata: Metadata;                 // Capture metadata
  visualData: VisualData;            // 4D visual tensor and keyframes
  molecules: Molecule[];             // Decomposed visual elements
  stateGraph: StateGraph;            // All possible states and transitions
  executionTrace: ExecutionTrace;    // Runtime behavior capture
  behavioralEquations: BehavioralEquation[]; // Dynamic property functions
  validationChecksums: ValidationChecksums;  // Data integrity verification
}
```

### 2. Metadata

```typescript
interface Metadata {
  captureId: string;                 // Unique capture identifier
  captureTimestamp: string;          // ISO 8601 timestamp
  captureEnvironment: CaptureEnvironment;
  targetUrl: string;                 // Original website URL
  fidelityScore: FidelityScore;      // Accuracy metrics
  viewportConfigurations: ViewportConfig[];
  captureSettings: CaptureSettings;
  edgeCasesDetected: EdgeCase[];
}

interface CaptureEnvironment {
  platform: "windows" | "linux" | "macos";
  browserEngine: string;             // e.g., "chromium-120.0.6099.109"
  gpuInfo: GPUInfo;
  displayInfo: DisplayInfo;
}

interface FidelityScore {
  overall: number;                   // 0.0 to 1.0 (target: ≥0.999)
  visual: number;                    // SSIM score
  behavioral: number;                // State coverage percentage
  timing: number;                    // Timing accuracy score
  color: number;                     // Delta E score
}
```

### 3. Visual Data

```typescript
interface VisualData {
  tensor4D: Tensor4D;                // Main visual capture
  keyframes: Keyframe[];             // Important visual moments
  depthMaps: DepthMap[];            // 3D element depth information
  colorProfiles: ColorProfile[];     // Color space information
}

interface Tensor4D {
  format: "float32" | "uint16" | "compressed";
  dimensions: [number, number, number, number]; // [width, height, depth, time]
  encoding: "raw" | "h265" | "av1" | "custom";
  dataUrl: string;                   // Reference to binary data file
  compressionRatio: number;
  temporalResolution: number;        // fps (60-240)
  spatialResolution: [number, number]; // [width, height]
  bitDepth: number;                  // Color bit depth
}

interface Keyframe {
  timestamp: number;                 // Milliseconds from start
  significance: "major" | "minor" | "transition";
  visualHash: string;                // Perceptual hash of frame
  deltaFromPrevious: number;         // Change magnitude
  associatedEvents: string[];        // Related interaction IDs
}
```

### 4. Molecular Elements

```typescript
interface Molecule {
  id: string;                        // Unique identifier (e.g., "mol_001")
  type: MoleculeType;               // Classification of element
  visualSignature: VisualSignature;  // Visual identification data
  bounds: Bounds;                    // Position and size information
  properties: Properties;            // Visual and behavioral properties
  interactions: Interactions;        // Possible user interactions
  relationships: Relationship[];     // Connections to other molecules
  lifecycle: Lifecycle;              // Creation/destruction timeline
}

type MoleculeType = 
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

interface VisualSignature {
  primaryImage: string;              // Base64 encoded representative image
  alternateStates: {[key: string]: string}; // hover, active, focus, etc.
  colorFingerprint: number[];        // Dominant colors
  shapeDescriptor: number[];         // Mathematical shape description
  texturePattern: string;            // Texture classification
}

interface Bounds {
  static: BoundingBox | null;        // Fixed position (if applicable)
  dynamic: string | null;            // Reference to timeline file
  transformations: Transformation[]; // Applied transformations
  zIndex: number | "dynamic";        // Stacking order
  opacity: number | "dynamic";       // Transparency
}

interface Properties {
  visual: VisualProperties;
  behavioral: BehavioralProperties;
  semantic: SemanticProperties;
  performance: PerformanceProperties;
}
```

### 5. State Graph

```typescript
interface StateGraph {
  nodes: StateNode[];                // All possible states
  edges: StateTransition[];          // Transitions between states
  initialState: string;              // Starting state ID
  terminalStates: string[];          // End states (if any)
  stateGroups: StateGroup[];         // Logical groupings
}

interface StateNode {
  id: string;                        // Unique state identifier
  visualHash: string;                // Visual fingerprint of state
  molecules: StateMoleculeSnapshot[]; // Molecule states in this state
  timestamp: number;                 // When first observed
  frequency: number;                 // How often visited
  stability: number;                 // How long typically maintained
}

interface StateTransition {
  id: string;
  fromState: string;
  toState: string;
  trigger: TransitionTrigger;
  duration: number;                  // Transition time in ms
  probability: number;               // Likelihood of transition
  reversible: boolean;
  animations: AnimationReference[];
}

interface TransitionTrigger {
  type: "interaction" | "time" | "scroll" | "network" | "media" | "system";
  details: any;                      // Type-specific trigger data
  conditions: Condition[];           // Required conditions
}
```

### 6. Execution Trace

```typescript
interface ExecutionTrace {
  renderingCommands: RenderCommand[];
  networkSequence: NetworkEvent[];
  computedStyles: ComputedStyle[];
  performanceMetrics: PerformanceMetric[];
  consoleOutput: ConsoleEntry[];
  memorySnapshots: MemorySnapshot[];
}

interface RenderCommand {
  timestamp: number;
  type: "paint" | "composite" | "layout" | "style";
  target: string;                    // Molecule ID or "global"
  command: any;                      // Command-specific data
  duration: number;                  // Execution time
  gpuAccelerated: boolean;
}

interface NetworkEvent {
  timestamp: number;
  type: "fetch" | "websocket" | "webrtc" | "other";
  url: string;
  method: string;
  headers: {[key: string]: string};
  payload: string | null;
  response: NetworkResponse;
  timing: NetworkTiming;
}
```

### 7. Behavioral Equations

```typescript
interface BehavioralEquation {
  id: string;
  element: string;                   // Molecule ID or "global"
  property: string;                  // Property being described
  equation: string;                  // Mathematical expression
  variables: Variable[];             // Input variables
  constraints: Constraints;          // Value boundaries
  domain: Domain;                    // When equation applies
  accuracy: number;                  // Equation fit score
}

interface Variable {
  name: string;
  type: "scrollY" | "scrollX" | "time" | "mouseX" | "mouseY" | "custom";
  range: [number, number];
  unit: string;
}

interface Constraints {
  min?: number;
  max?: number;
  step?: number;
  allowedValues?: any[];
}
```

### 8. Validation Checksums

```typescript
interface ValidationChecksums {
  visualDataChecksum: string;        // SHA-256 of visual tensor
  moleculeTreeChecksum: string;      // SHA-256 of molecule hierarchy
  stateGraphChecksum: string;        // SHA-256 of state graph
  crossValidation: CrossValidation[];
}

interface CrossValidation {
  source: string;                    // Data source being validated
  target: string;                    // Validation target
  method: "visual_match" | "behavioral_consistency" | "timing_correlation";
  score: number;                     // Validation score (0-1)
  details: any;                      // Method-specific validation data
}
```

## Binary Data Files

The UWR format references several binary data files:

### 1. Visual Tensor File (.uwr-tensor)
- Header: Dimension info, compression settings
- Data: 4D tensor data in specified format
- Index: Frame offset table for random access

### 2. Timeline Files (.uwr-timeline)
- Header: Property info, interpolation method
- Data: Time-series data for dynamic properties
- Index: Keyframe locations

### 3. Depth Map Files (.uwr-depth)
- Header: Resolution, encoding format
- Data: Z-buffer information per frame
- Index: Frame mapping

## Implementation Requirements

### 1. Precision Standards
- Timestamps: Microsecond precision (1μs)
- Positions: Sub-pixel accuracy (0.1px)
- Colors: 16-bit per channel minimum
- Timing: <1ms deviation tolerance

### 2. Completeness Requirements
- All possible states must be discovered
- All transitions must be recorded
- All edge cases must be handled
- No placeholder or default values

### 3. Validation Requirements
- Visual checksum verification
- Cross-source validation
- Behavioral consistency checks
- Timing correlation analysis

## Usage Example

```typescript
// Loading a UWR document
const uwr = await UWRLoader.load('website-capture.uwr');

// Accessing visual data
const frame = await uwr.visualData.getFrame(timestamp);

// Querying molecules
const buttons = uwr.molecules.filter(m => m.type === 'interactive_button');

// Traversing state graph
const path = uwr.stateGraph.findPath(currentState, targetState);

// Applying behavioral equations
const opacity = uwr.evaluateEquation('mol_001', 'opacity', {scrollY: 500});
```

## Version History

- **1.0** (2024-01): Initial specification
  - Complete visual-behavioral capture system
  - Multi-modal data fusion
  - Platform-agnostic representation

---

This specification is designed to enable perfect website reconstruction without any traditional web technology knowledge, treating websites as pure visual-behavioral phenomena.