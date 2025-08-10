/**
 * Example: Discover all interactions on a website
 * Demonstrates automated state exploration and interaction discovery
 */

import puppeteer from 'puppeteer';
import { InteractionDiscoveryEngine } from '../src/core/InteractionDiscoveryEngine';
import { DiscoveryConfig } from '../src/types';
import { logger } from '../src/utils/logger';

async function discoverWebsiteInteractions() {
  const config: DiscoveryConfig = {
    maxDepth: 5,                      // Explore up to 5 levels deep
    maxStates: 100,                   // Discover up to 100 unique states
    timeoutPerInteraction: 3000,      // 3 seconds per interaction
    strategy: 'breadth-first',        // Explore all options at each level
    enableVisualDiff: true,           // Use visual comparison
    captureScreenshots: true,         // Capture screenshots of each state
    detectHiddenElements: false,      // Focus on visible elements
    simulateUserBehavior: true        // Add realistic delays
  };

  logger.info('Starting interaction discovery example', config);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: false,  // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Create discovery engine
    const engine = new InteractionDiscoveryEngine(config);
    
    // Set up event listeners
    engine.on('stateDiscovered', ({ state, isNew }) => {
      console.log(`🔍 State discovered: ${state.title || 'Untitled'}`);
      console.log(`   URL: ${state.url}`);
      console.log(`   New: ${isNew ? 'Yes' : 'No'}`);
      console.log(`   Interactive elements: ${state.interactableElements.length}`);
    });

    engine.on('transitionFound', ({ transition }) => {
      console.log(`🔗 Transition found:`);
      console.log(`   Type: ${transition.interaction.type}`);
      console.log(`   Element: ${transition.interaction.elementSelector}`);
      console.log(`   From: ${transition.fromStateId}`);
      console.log(`   To: ${transition.toStateId}`);
    });

    engine.on('explorationProgress', ({ statesDiscovered, currentDepth, queueSize }) => {
      console.log(`📊 Progress: ${statesDiscovered} states, depth ${currentDepth}, queue ${queueSize}`);
    });

    engine.on('interactionFailed', ({ interaction, error }) => {
      console.warn(`❌ Interaction failed: ${interaction.elementSelector}`, error.message);
    });

    // Initialize engine
    await engine.initialize(browser);

    // Start discovery on example website
    const targetUrl = 'https://example.com';  // Replace with target website
    console.log(`\n🚀 Starting discovery on ${targetUrl}\n`);
    
    const session = await engine.startDiscovery(targetUrl);

    // Display results
    console.log('\n📈 Discovery Complete!\n');
    console.log('Summary:');
    console.log(`  Total states discovered: ${session.metrics.statesDiscovered}`);
    console.log(`  Total transitions found: ${session.metrics.transitionsFound}`);
    console.log(`  Total interactions performed: ${session.metrics.interactionsPerformed}`);
    console.log(`  Failed interactions: ${session.metrics.failedInteractions}`);
    console.log(`  Exploration time: ${(session.metrics.explorationTime / 1000).toFixed(2)}s`);
    
    // Display graph statistics
    const stats = session.graph.statistics;
    console.log('\nGraph Statistics:');
    console.log(`  Maximum depth: ${stats.maxDepth}`);
    console.log(`  Average branching factor: ${stats.averageBranchingFactor.toFixed(2)}`);
    console.log(`  Terminal states: ${stats.terminalStates}`);
    console.log(`  Error states: ${stats.errorStates}`);
    console.log(`  Cycles detected: ${stats.cycleCount}`);

    // Example: Find specific interactions
    console.log('\n🔎 Analyzing discovered interactions:\n');
    
    // Find all button clicks
    const buttonClicks = session.graph.edges.size;
    console.log(`  Button clicks: ${buttonClicks}`);
    
    // Find all form inputs
    const formInputs = Array.from(session.graph.nodes.values())
      .flatMap(node => node.state.interactableElements)
      .filter(el => el.type === 'input' || el.type === 'textarea')
      .length;
    console.log(`  Form inputs: ${formInputs}`);

    // Clean up
    await engine.cleanup();

  } catch (error) {
    logger.error('Discovery failed', error);
  } finally {
    await browser.close();
  }
}

// Advanced example: Custom exploration strategy
async function discoverWithCustomStrategy() {
  const config: DiscoveryConfig = {
    maxDepth: 3,
    maxStates: 50,
    strategy: 'priority-based',  // Focus on high-value interactions
    enableVisualDiff: true,
    captureScreenshots: true
  };

  const browser = await puppeteer.launch({ headless: true });
  
  try {
    const engine = new InteractionDiscoveryEngine(config);
    await engine.initialize(browser);
    
    // Discover interactions on a complex web app
    const session = await engine.startDiscovery('https://complex-app.example.com');
    
    // Export state graph for visualization
    const stateManager = (engine as any).stateManager;  // Access internal state manager
    const dotGraph = stateManager.exportToDOT();
    
    console.log('\n📊 State Graph (DOT format for visualization):\n');
    console.log(dotGraph);
    console.log('\nPaste this into a GraphViz viewer to visualize the state graph');
    
    await engine.cleanup();
  } finally {
    await browser.close();
  }
}

// Run the example
if (require.main === module) {
  discoverWebsiteInteractions()
    .then(() => console.log('\n✅ Example completed successfully'))
    .catch(error => console.error('\n❌ Example failed:', error));
}

export { discoverWebsiteInteractions, discoverWithCustomStrategy };