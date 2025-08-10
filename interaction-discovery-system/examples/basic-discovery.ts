/**
 * Basic example of using the Interaction Discovery System
 * 
 * This example demonstrates how to discover all interactions
 * on a simple website and export the results.
 */

import { InteractionDiscoveryEngine } from '../src';
import { InteractionDiscoveryConfig } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

async function discoverWebsiteInteractions() {
  // Configuration for the discovery process
  const config: InteractionDiscoveryConfig = {
    url: 'https://example.com', // Replace with your target URL
    strategy: 'breadth-first',
    maxDepth: 5,
    maxStates: 100,
    timeoutPerInteraction: 3000,
    enableVisualDiff: true,
    captureScreenshots: true,
    browserOptions: {
      headless: false, // Set to true for production
      viewport: { width: 1920, height: 1080 }
    }
  };

  // Create the discovery engine
  const engine = new InteractionDiscoveryEngine(config);

  // Set up event listeners for progress tracking
  engine.on('stateDiscovered', ({ state, isNew }) => {
    console.log(`[STATE] ${isNew ? 'New' : 'Revisited'} state: ${state.url}`);
    console.log(`  - Interactive elements: ${state.interactableElements.length}`);
  });

  engine.on('interactionCompleted', ({ interaction }) => {
    console.log(`[INTERACTION] ${interaction.type} on ${interaction.elementSelector}`);
  });

  engine.on('explorationProgress', ({ explored, total }) => {
    console.log(`[PROGRESS] Explored ${explored}/${total} states`);
  });

  engine.on('error', ({ error, context }) => {
    console.error(`[ERROR] ${context}: ${error.message}`);
  });

  try {
    console.log('Starting interaction discovery...\n');
    
    // Start the discovery process
    const result = await engine.discover();
    
    console.log('\nDiscovery completed!');
    console.log(`Total states discovered: ${result.states.length}`);
    console.log(`Total interactions found: ${result.interactions.length}`);
    console.log(`Total transitions: ${result.transitions.length}`);
    console.log(`Coverage estimate: ${(result.coverage * 100).toFixed(1)}%`);

    // Save results
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save full results
    const resultPath = path.join(outputDir, 'discovery-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`\nResults saved to: ${resultPath}`);

    // Generate a simple HTML report
    generateHTMLReport(result, outputDir);

  } catch (error) {
    console.error('Discovery failed:', error);
  } finally {
    // Clean up resources
    await engine.cleanup();
  }
}

/**
 * Generate a simple HTML report of the discovery results
 */
function generateHTMLReport(result: any, outputDir: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Interaction Discovery Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 15px; border-radius: 5px; }
    .state { border: 1px solid #ddd; margin: 10px 0; padding: 10px; }
    .interaction { background: #e8f4f8; margin: 5px 0; padding: 5px; }
    .transition { background: #f8e8e8; margin: 5px 0; padding: 5px; }
  </style>
</head>
<body>
  <h1>Interaction Discovery Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>URL:</strong> ${result.url}</p>
    <p><strong>Discovery Date:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
    <p><strong>States Discovered:</strong> ${result.states.length}</p>
    <p><strong>Interactions Found:</strong> ${result.interactions.length}</p>
    <p><strong>Transitions:</strong> ${result.transitions.length}</p>
    <p><strong>Coverage Estimate:</strong> ${(result.coverage * 100).toFixed(1)}%</p>
  </div>

  <h2>Discovered States</h2>
  ${result.states.slice(0, 10).map(state => `
    <div class="state">
      <h3>${state.title || state.url}</h3>
      <p><strong>URL:</strong> ${state.url}</p>
      <p><strong>Possible Interactions:</strong> ${state.possibleInteractions?.length || 0}</p>
    </div>
  `).join('')}
  ${result.states.length > 10 ? `<p>... and ${result.states.length - 10} more states</p>` : ''}

  <h2>Top Interactions</h2>
  ${result.interactions.slice(0, 20).map(interaction => `
    <div class="interaction">
      <strong>${interaction.type}</strong> on ${interaction.selector}
      ${interaction.successful ? '✓' : '✗'}
    </div>
  `).join('')}
  ${result.interactions.length > 20 ? `<p>... and ${result.interactions.length - 20} more interactions</p>` : ''}

  <h2>State Transitions</h2>
  ${result.transitions.slice(0, 10).map(transition => `
    <div class="transition">
      ${transition.fromState} → ${transition.toState} 
      (${transition.interaction}, ${transition.count} times)
    </div>
  `).join('')}
  ${result.transitions.length > 10 ? `<p>... and ${result.transitions.length - 10} more transitions</p>` : ''}
</body>
</html>
  `;

  const reportPath = path.join(outputDir, 'discovery-report.html');
  fs.writeFileSync(reportPath, html);
  console.log(`HTML report saved to: ${reportPath}`);
}

// Run the example
if (require.main === module) {
  discoverWebsiteInteractions().catch(console.error);
}

export { discoverWebsiteInteractions };