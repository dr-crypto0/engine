# Interaction Discovery System

A revolutionary system that automatically discovers all possible interactions and states on websites through intelligent exploration, without relying on traditional DOM parsing methods. Part of the Revolutionary Website Cloning System.

## 🚀 Features

- **Automatic Interaction Discovery**: Finds all clickable, hoverable, and interactive elements
- **State Graph Generation**: Builds a complete state graph of the website
- **Visual State Comparison**: Uses visual similarity to detect unique states
- **Parallel Exploration**: Supports multiple parallel browsers for faster discovery
- **Multiple Exploration Strategies**: Breadth-first, depth-first, and intelligent strategies
- **Event-Driven Architecture**: Real-time progress tracking and event notifications
- **Comprehensive Logging**: Detailed logs for debugging and analysis
- **Export Capabilities**: Export results to UWR, Graphviz, and Cytoscape formats

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- Chrome/Chromium browser
- 8GB+ RAM recommended for large websites
- GPU acceleration supported for visual comparison

## 🔧 Installation

```bash
# Clone the repository
git clone <repository-url>
cd interaction-discovery-system

# Install dependencies
npm install

# Build the project
npm run build
```

## 🎯 Quick Start

### Command Line Usage

```bash
# Basic discovery
npm run discover https://example.com

# Advanced options
npm run discover https://example.com \
  --output ./results \
  --strategy breadth-first \
  --max-depth 10 \
  --timeout 600 \
  --save-screenshots \
  --verbose
```

### Programmatic Usage

```typescript
import { InteractionDiscoveryEngine } from 'interaction-discovery-system';

const config = {
  url: 'https://example.com',
  strategy: 'breadth-first',
  maxDepth: 5,
  captureScreenshots: true
};

const engine = new InteractionDiscoveryEngine(config);

// Listen to events
engine.on('stateDiscovered', ({ state }) => {
  console.log(`New state: ${state.url}`);
});

// Start discovery
const result = await engine.discover();
console.log(`Found ${result.states.length} states`);

// Clean up
await engine.cleanup();
```

## 📚 API Reference

### InteractionDiscoveryEngine

The main class for discovering interactions.

#### Constructor

```typescript
new InteractionDiscoveryEngine(config: InteractionDiscoveryConfig)
```

#### Methods

- `discover(): Promise<DiscoveryResult>` - Start the discovery process
- `startDiscovery(url: string): Promise<ExplorationSession>` - Start discovery with specific URL
- `stopDiscovery(): Promise<void>` - Stop the current discovery
- `cleanup(): Promise<void>` - Clean up resources
- `getSession(): ExplorationSession | null` - Get current session

#### Events

- `stateDiscovered` - Fired when a new state is discovered
- `interactionCompleted` - Fired after each interaction
- `explorationProgress` - Fired periodically with progress updates
- `error` - Fired when an error occurs

### Configuration Options

```typescript
interface InteractionDiscoveryConfig {
  url: string;                          // Target URL
  strategy?: ExplorationStrategyType;   // Exploration strategy
  maxDepth?: number;                    // Maximum exploration depth
  maxStates?: number;                   // Maximum states to discover
  maxDuration?: number;                 // Maximum time in milliseconds
  timeoutPerInteraction?: number;       // Timeout for each interaction
  parallelExplorers?: number;           // Number of parallel browsers
  enableVisualDiff?: boolean;           // Use visual comparison
  captureScreenshots?: boolean;         // Capture screenshots
  detectHiddenElements?: boolean;       // Try to find hidden elements
  simulateUserBehavior?: boolean;       // Add realistic delays
  browserOptions?: {
    headless?: boolean;
    viewport?: { width: number; height: number };
  };
  captureOptions?: {
    screenshots?: boolean;
    videos?: boolean;
  };
}
```

### Exploration Strategies

- **breadth-first**: Explores all interactions at current depth before going deeper
- **depth-first**: Follows each path to its end before backtracking
- **intelligent**: Prioritizes unexplored and promising interactions
- **priority-based**: Uses custom priority function
- **random-walk**: Random exploration for testing
- **guided**: Follows predefined patterns

## 🔍 CLI Commands

### discover

Discover interactions on a website.

```bash
interaction-discovery discover <url> [options]

Options:
  -o, --output <path>              Output directory (default: ./discovery-results)
  -s, --strategy <type>            Exploration strategy (default: intelligent)
  -t, --timeout <seconds>          Maximum time in seconds (default: 300)
  -d, --max-depth <number>         Maximum depth (default: 10)
  -p, --parallel <number>          Parallel explorers (default: 1)
  --headless                       Run in headless mode
  --viewport <width>x<height>      Browser viewport (default: 1920x1080)
  --save-screenshots               Save screenshots
  --save-videos                    Record videos
  --verbose                        Enable verbose logging
```

### analyze

Analyze previous discovery results.

```bash
interaction-discovery analyze <resultFile> [options]

Options:
  --format <type>    Output format: summary, detailed, graph (default: summary)
```

### export

Export results to different formats.

```bash
interaction-discovery export <resultFile> [options]

Options:
  -f, --format <type>    Export format: uwr, graphviz, cytoscape (default: uwr)
  -o, --output <path>    Output file path
```

## 📊 Output Format

The discovery result includes:

```typescript
interface DiscoveryResult {
  url: string;                    // Target URL
  timestamp: number;              // Discovery timestamp
  states: DiscoveredState[];      // All discovered states
  interactions: DiscoveredInteraction[];  // All interactions
  transitions: DiscoveredTransition[];    // State transitions
  stateGraph: SerializedStateGraph;       // Graph structure
  coverage: number;               // Coverage estimate (0-1)
  metrics?: ExplorationMetrics;   // Performance metrics
}
```

## 🧪 Examples

See the `examples/` directory for:

- `basic-discovery.ts` - Simple discovery example
- `advanced-discovery.ts` - Advanced features and custom strategies
- More examples coming soon...

## 🏗️ Architecture

The system consists of several core components:

1. **InteractionDiscoveryEngine** - Main orchestrator
2. **ElementDetector** - Finds interactive elements using visual cues
3. **StateManager** - Manages discovered states and deduplication
4. **InteractionExecutor** - Executes interactions safely
5. **StateComparator** - Compares states for uniqueness
6. **ExplorationStrategist** - Implements exploration strategies

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

## 📈 Performance Considerations

- **Memory Usage**: Each state stores a screenshot, so memory usage can grow quickly
- **Parallel Exploration**: More parallel browsers = faster discovery but higher resource usage
- **Visual Comparison**: GPU acceleration significantly improves performance
- **State Deduplication**: Critical for avoiding infinite loops

## 🐛 Troubleshooting

### Common Issues

1. **Out of Memory**: Reduce `maxStates` or disable screenshot capture
2. **Slow Discovery**: Try parallel exploration or reduce `maxDepth`
3. **Missing Interactions**: Enable `detectHiddenElements` option
4. **False Positives**: Adjust visual similarity threshold

### Debug Mode

Enable verbose logging for detailed debug information:

```bash
npm run discover https://example.com --verbose
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

- [Visual Capture Engine](../visual-capture-engine) - High-performance visual capture
- [UWR Format Specification](../uwr-format-specification) - Universal Website Representation
- [Molecular Decomposition](../molecular-decomposition) - Computer vision element detection

## 📞 Support

For issues and questions:
- Check the [troubleshooting guide](#-troubleshooting)
- Review [examples](./examples)
- Open an issue in the repository

---

Built with ❤️ as part of the Revolutionary Website Cloning System