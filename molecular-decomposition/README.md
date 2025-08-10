# Molecular Decomposition System

A revolutionary computer vision-based system that decomposes website screenshots into hierarchical element structures without relying on DOM parsing. Part of the Revolutionary Website Cloning System.

## 🚀 Features

- **Computer Vision Element Detection**: Uses state-of-the-art ML models (YOLO/Detectron2) to detect UI elements
- **Hierarchical Structure Building**: Automatically infers parent-child relationships from spatial analysis
- **Visual Property Extraction**: Extracts colors, typography, spacing, borders, and shadows
- **Layout Pattern Recognition**: Detects grids, sibling groups, and alignment patterns
- **Behavioral Hint Inference**: Predicts element interactivity from visual appearance
- **Multi-format Export**: Supports JSON, UWR, and HTML visualization formats
- **GPU Acceleration**: Leverages NVIDIA GPUs for fast inference
- **OCR Integration**: Extracts text content from detected elements

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- Python 3.8+ (for training custom models)
- NVIDIA GPU with CUDA support (recommended)
- 16GB+ RAM for large images
- Pre-trained models (see installation)

## 🔧 Installation

```bash
# Clone the repository
git clone <repository-url>
cd molecular-decomposition

# Install dependencies
npm install

# Download pre-trained models
npm run download-models

# Build the project
npm run build
```

### Model Setup

The system requires pre-trained models for element detection. You can either:

1. **Use pre-trained models** (recommended):
   ```bash
   # Download from model zoo
   npm run download-models
   ```

2. **Train custom models**:
   ```bash
   # Prepare your annotated dataset
   npm run train -- --dataset ./training-data
   ```

## 🎯 Quick Start

### Command Line Usage

```bash
# Basic decomposition
npm run decompose screenshot.png

# With custom options
npm run decompose screenshot.png \
  --output ./results \
  --confidence 0.7 \
  --max-elements 500 \
  --format uwr

# Analyze previous results
npm run decompose analyze results/decomposition.json --format detailed
```

### Programmatic Usage

```typescript
import {
  MolecularDecomposer,
  VisionModel,
  HierarchyBuilder,
  PropertyExtractor
} from 'molecular-decomposition';

// Initialize components
const visionModel = new VisionModel('./models/element-detection');
const hierarchyBuilder = new HierarchyBuilder();
const propertyExtractor = new PropertyExtractor();

const decomposer = new MolecularDecomposer(
  visionModel,
  hierarchyBuilder,
  propertyExtractor
);

// Initialize and decompose
await decomposer.initialize();
const result = await decomposer.decompose(screenshotBuffer);

console.log(`Detected ${result.elements.length} elements`);
console.log(`Hierarchy depth: ${result.structure.hierarchy.maxDepth}`);
```

## 📚 API Reference

### MolecularDecomposer

The main orchestrator for the decomposition process.

```typescript
class MolecularDecomposer {
  constructor(
    visionModel: VisionModel,
    hierarchyBuilder: HierarchyBuilder,
    propertyExtractor: PropertyExtractor,
    config?: MolecularDecompositionConfig
  )
  
  async initialize(): Promise<void>
  async decompose(screenshot: Buffer): Promise<DecompositionResult>
}
```

### VisionModel

Handles ML-based element detection and classification.

```typescript
class VisionModel {
  async loadModel(modelPath: string): Promise<void>
  async detectElements(image: Buffer): Promise<BoundingBox[]>
  async classifyElement(crop: Buffer): Promise<{ type: ElementType; confidence: number }>
  async extractText(crop: Buffer): Promise<string>
  async extractFeatures(crop: Buffer): Promise<VisualFeatures>
}
```

### Configuration Options

```typescript
interface MolecularDecompositionConfig {
  modelPath?: string;              // Path to vision model
  confidenceThreshold?: number;    // Min confidence (0-1)
  maxElements?: number;            // Max elements to detect
  enableOCR?: boolean;             // Enable text extraction
  enableDepthAnalysis?: boolean;   // Enable 3D depth analysis
  enableBehaviorInference?: boolean; // Infer behavioral hints
  gpuAcceleration?: boolean;       // Use GPU acceleration
}
```

## 🔍 CLI Commands

### decompose

Main command for decomposing screenshots.

```bash
molecular-decompose decompose <image> [options]

Options:
  -o, --output <path>           Output directory (default: ./decomposition-results)
  -m, --model <path>            Model path (default: ./models/element-detection)
  -c, --confidence <number>     Confidence threshold (default: 0.5)
  --max-elements <number>       Max elements (default: 1000)
  --no-ocr                      Disable OCR
  --no-depth                    Disable depth analysis
  --no-behavior                 Disable behavior inference
  --format <type>               Export format: json, uwr, html (default: json)
  --verbose                     Enable verbose logging
```

### analyze

Analyze decomposition results.

```bash
molecular-decompose analyze <resultFile> [options]

Options:
  --format <type>    Analysis format: summary, detailed, visual
```

### train

Train custom element detection models.

```bash
molecular-decompose train [options]

Options:
  -d, --dataset <path>          Training dataset path
  -o, --output <path>           Output model path
  -e, --epochs <number>         Training epochs (default: 100)
  -b, --batch <number>          Batch size (default: 32)
  --validation-split <number>   Validation split (default: 0.2)
```

## 📊 Output Format

### DecompositionResult

```typescript
interface DecompositionResult {
  structure: MolecularStructure;      // Hierarchical structure
  elements: DetectedElement[];        // All detected elements
  properties: Map<string, PropertyExtractionResult>; // Visual properties
  confidence: number;                 // Overall confidence
  processingTime: number;             // Time in milliseconds
  warnings?: string[];                // Any warnings
}
```

### DetectedElement

```typescript
interface DetectedElement {
  id: string;
  boundingBox: BoundingBox;
  type: ElementType;
  confidence: number;
  visualFeatures: VisualFeatures;
  children?: DetectedElement[];
  parent?: string;
  depth: number;
}
```

## 🧪 Examples

See the `examples/` directory for:

- `basic-decomposition.ts` - Simple decomposition example
- `advanced-analysis.ts` - Advanced feature usage
- `custom-model-training.ts` - Training custom models
- `batch-processing.ts` - Processing multiple screenshots

## 🏗️ Architecture

The system consists of four main components:

1. **VisionModel**: ML-based element detection using YOLO/Detectron2
2. **HierarchyBuilder**: Spatial analysis to build element hierarchy
3. **PropertyExtractor**: Visual feature extraction using computer vision
4. **MolecularDecomposer**: Main orchestrator coordinating all components

### Processing Pipeline

```
Screenshot → Element Detection → Hierarchy Building → Property Extraction → Result
     ↓              ↓                    ↓                    ↓
   Image      Bounding Boxes      Parent-Child         Colors, Spacing
   Buffer      + Types            Relationships         Borders, etc.
```

## 🔧 Development

```bash
# Run tests
npm test

# Run in development mode
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## 📈 Performance Optimization

### GPU Acceleration

Enable GPU acceleration for faster processing:

```typescript
const config = {
  gpuAcceleration: true
};
```

### Batch Processing

Process multiple images efficiently:

```typescript
const results = await Promise.all(
  screenshots.map(screenshot => decomposer.decompose(screenshot))
);
```

### Memory Management

For large images, consider:
- Reducing `maxElements` to limit detection
- Processing in chunks
- Using lower resolution for initial detection

## 🐛 Troubleshooting

### Common Issues

1. **Out of Memory**: Reduce image size or `maxElements`
2. **Low Accuracy**: Increase `confidenceThreshold` or use better models
3. **Missing Elements**: Lower `confidenceThreshold` or train custom model
4. **Slow Performance**: Enable GPU acceleration or reduce image resolution

### Debug Mode

Enable verbose logging:

```bash
npm run decompose screenshot.png --verbose
```

## 🤖 Training Custom Models

### Preparing Dataset

1. Annotate screenshots with bounding boxes and element types
2. Use standard formats (COCO, YOLO)
3. Split into train/validation sets

### Training Process

```bash
# Basic training
npm run train -- --dataset ./annotated-screenshots

# Advanced options
npm run train -- \
  --dataset ./data \
  --model-type yolov5 \
  --epochs 200 \
  --batch-size 16 \
  --learning-rate 0.001
```

### Model Evaluation

```bash
# Evaluate model performance
npm run evaluate -- --model ./models/custom --test-data ./test-set
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is part of the Revolutionary Website Cloning System and is proprietary software.

## 🔗 Related Projects

- [Interaction Discovery System](../interaction-discovery-system) - Automated interaction discovery
- [Visual Capture Engine](../visual-capture-engine) - High-performance visual capture
- [UWR Format Specification](../uwr-format-specification) - Universal Website Representation

## 📞 Support

For issues and questions:
- Check the [troubleshooting guide](#-troubleshooting)
- Review [examples](./examples)
- Open an issue in the repository

---

Built with ❤️ as part of the Revolutionary Website Cloning System