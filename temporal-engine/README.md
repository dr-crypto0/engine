# Temporal Analysis Engine

Advanced temporal analysis engine for the Revolutionary Website Cloning System. This component detects keyframes, correlates visual changes with interaction events, and creates temporal slices for perfect website reconstruction.

## 🚀 Features

- **High-Performance Change Detection**: Pixel-level change detection using advanced computer vision
- **Intelligent Keyframe Detection**: Automatically identifies significant visual changes
- **Event Correlation**: Links interaction events with visual changes using causal analysis
- **Temporal Slicing**: Creates time-based segments for efficient data representation
- **Animation Detection**: Identifies and characterizes animation patterns
- **Multi-Region Analysis**: Tracks multiple simultaneous changes across the viewport

## 📦 Installation

```bash
npm install @revolutionary-web-cloning/temporal-engine
```

## 🔧 Usage

### Basic Usage

```typescript
import { createTemporalEngine } from '@revolutionary-web-cloning/temporal-engine';

// Create engine instance
const engine = createTemporalEngine({
  temporalSlicer: {
    changeThreshold: 0.01,      // 1% change threshold
    minSliceDuration: 50,       // 50ms minimum
    maxSliceDuration: 5000,     // 5s maximum
    mergeAdjacentSlices: true,
    correlationThreshold: 0.7
  }
});

// Analyze frames and events
const result = await engine.analyze(frames, events);

console.log(`Created ${result.slices.length} temporal slices`);
console.log(`Identified ${result.causalChains.length} causal chains`);
```

### Advanced Configuration

```typescript
const engine = createTemporalEngine({
  changeDetector: {
    pixelThreshold: 30,         // Sensitivity (0-255)
    minRegionSize: 100,         // Minimum pixels
    useEdgeDetection: true,
    useColorAnalysis: true,
    detectTextChanges: true
  },
  eventCorrelator: {
    maxCorrelationDelay: 2000,  // 2 seconds
    spatialThreshold: 100,      // 100 pixels
    detectAnimations: true,
    buildCausalChains: true
  },
  temporalSlicer: {
    changeThreshold: 0.01,
    minSliceDuration: 50,
    maxSliceDuration: 5000,
    mergeAdjacentSlices: true,
    correlationThreshold: 0.7
  }
});
```

### Component APIs

#### Change Detector

```typescript
const changeMap = await engine.changeDetector.detectChanges(frame1, frame2);

console.log(`Change: ${changeMap.changePercentage}%`);
console.log(`Regions: ${changeMap.regions.length}`);
console.log(`PSNR: ${changeMap.metrics.psnr} dB`);
```

#### Event Correlator

```typescript
const correlation = engine.eventCorrelator.correlate(changeMap, event);

console.log(`Type: ${correlation.correlationType}`);
console.log(`Confidence: ${correlation.confidence}`);
console.log(`Delay: ${correlation.delay}ms`);
```

#### Temporal Slicer

```typescript
const slices = await engine.temporalSlicer.createSlices(frames, events);

for (const slice of slices) {
  console.log(`Slice ${slice.id}:`);
  console.log(`  Duration: ${slice.endTime - slice.startTime}ms`);
  console.log(`  Change type: ${slice.changeType}`);
  console.log(`  Events: ${slice.events.length}`);
  console.log(`  Confidence: ${slice.confidence}`);
}
```

## 🖥️ CLI Usage

### Installation

```bash
npm install -g @revolutionary-web-cloning/temporal-engine
```

### Commands

#### Analyze Frames and Events

```bash
temporal-engine analyze \
  --frames frames.json \
  --events events.json \
  --output analysis.json \
  --change-threshold 0.01 \
  --correlation-threshold 0.7
```

#### Detect Changes Between Frames

```bash
temporal-engine detect-changes \
  --frame1 before.png \
  --frame2 after.png \
  --output changes.json \
  --pixel-threshold 30
```

#### Correlate Events with Changes

```bash
temporal-engine correlate \
  --changes changes.json \
  --event event.json \
  --output correlation.json \
  --max-delay 2000
```

#### Generate Example Data

```bash
temporal-engine example --output-dir ./examples
```

## 📊 Data Formats

### Frame Format

```typescript
interface Frame {
  id: string;
  timestamp: number;        // Milliseconds
  data: Buffer;            // PNG image data
  dimensions: {
    width: number;
    height: number;
  };
  frameNumber: number;
  metadata?: Record<string, any>;
}
```

### Event Format

```typescript
interface InteractionEvent {
  id: string;
  type: 'click' | 'hover' | 'scroll' | 'keypress' | 'drag' | 'focus' | 'blur' | 'custom';
  timestamp: number;        // Milliseconds
  target: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    elementId?: string;
  };
  data?: Record<string, any>;
}
```

### Temporal Slice Format

```typescript
interface TemporalSlice {
  id: string;
  startTime: number;
  endTime: number;
  startFrame: Frame;
  endFrame: Frame;
  frames: Frame[];
  events: InteractionEvent[];
  changeType: ChangeType;
  changedRegions: Region[];
  confidence: number;       // 0-1
}
```

## 🔍 Change Types

- `none`: No significant change
- `appearance`: Content appeared
- `disappearance`: Content disappeared
- `movement`: Content moved
- `transformation`: Size/rotation change
- `style_change`: Color/style change
- `text_change`: Text content change
- `animation`: Animated transition
- `complex`: Multiple change types

## 📈 Performance Considerations

### Memory Usage

- Frame buffers are cleared after processing
- Use streaming for large datasets
- Configure buffer sizes based on available RAM

### Processing Speed

- GPU acceleration available via Sharp
- Parallel processing for multiple regions
- Configurable quality/speed tradeoffs

### Optimization Tips

```typescript
// For real-time processing
const engine = createTemporalEngine({
  changeDetector: {
    pixelThreshold: 50,      // Less sensitive
    minRegionSize: 200,      // Larger regions only
    useEdgeDetection: false, // Faster
    useColorAnalysis: false  // Faster
  },
  temporalSlicer: {
    changeThreshold: 0.05,   // Higher threshold
    minSliceDuration: 100    // Longer slices
  }
});

// For high accuracy
const engine = createTemporalEngine({
  changeDetector: {
    pixelThreshold: 20,      // More sensitive
    minRegionSize: 50,       // Smaller regions
    useEdgeDetection: true,
    useColorAnalysis: true,
    detectTextChanges: true
  },
  temporalSlicer: {
    changeThreshold: 0.001,  // Lower threshold
    minSliceDuration: 16     // 60fps precision
  }
});
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🏗️ Architecture

```
temporal-engine/
├── src/
│   ├── core/
│   │   ├── TemporalSlicer.ts      # Main orchestrator
│   │   ├── ChangeDetector.ts      # Visual change detection
│   │   └── EventCorrelator.ts     # Event-change correlation
│   ├── types/
│   │   └── index.ts               # TypeScript definitions
│   ├── utils/
│   │   └── logger.ts              # Logging utilities
│   ├── index.ts                   # Main exports
│   └── cli.ts                     # CLI interface
├── tests/
│   ├── unit/                      # Unit tests
│   └── integration/               # Integration tests
└── examples/                      # Usage examples
```

## 🔗 Integration with Other Components

### With Visual Capture Engine

```typescript
import { VisualCaptureEngine } from '@revolutionary-web-cloning/visual-capture-engine';
import { createTemporalEngine } from '@revolutionary-web-cloning/temporal-engine';

const captureEngine = new VisualCaptureEngine();
const temporalEngine = createTemporalEngine();

// Capture frames
const frames = await captureEngine.captureSequence(url, {
  duration: 10000,
  fps: 60
});

// Analyze temporal patterns
const analysis = await temporalEngine.analyze(frames, events);
```

### With Interaction Discovery

```typescript
import { InteractionDiscoveryEngine } from '@revolutionary-web-cloning/interaction-discovery';
import { createTemporalEngine } from '@revolutionary-web-cloning/temporal-engine';

const discoveryEngine = new InteractionDiscoveryEngine();
const temporalEngine = createTemporalEngine();

// Discover interactions
const { states, events } = await discoveryEngine.discover(url);

// Correlate with visual changes
const analysis = await temporalEngine.analyze(frames, events);
```

## 📝 License

MIT

## 🤝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## 🐛 Troubleshooting

### Common Issues

1. **Out of Memory**: Reduce frame buffer size or process in chunks
2. **Slow Processing**: Disable edge detection and color analysis
3. **Missing Changes**: Lower the pixel threshold
4. **Too Many False Positives**: Increase minimum region size

### Debug Mode

```bash
LOG_LEVEL=debug temporal-engine analyze -f frames.json -e events.json
```

## 📚 References

- [Change Detection Algorithms](https://en.wikipedia.org/wiki/Change_detection)
- [Temporal Analysis](https://en.wikipedia.org/wiki/Time_series)
- [Event Correlation](https://en.wikipedia.org/wiki/Event_correlation)