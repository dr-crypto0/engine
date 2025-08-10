/**
 * Advanced example of using the Interaction Discovery System
 * 
 * This example demonstrates:
 * - Custom exploration strategies
 * - Parallel exploration
 * - State filtering
 * - Custom interaction patterns
 */

import { 
  InteractionDiscoveryEngine,
  InteractionDiscoveryConfig,
  WebsiteState,
  InteractableElement,
  StateGraph
} from '../src';

/**
 * Custom exploration strategy that prioritizes form elements
 */
class FormFocusedStrategy {
  selectNextInteraction(
    currentState: WebsiteState,
    graph: StateGraph,
    availableInteractions: InteractableElement[]
  ): InteractableElement | null {
    // Prioritize form-related elements
    const formElements = availableInteractions.filter(el => 
      ['input', 'select', 'textarea', 'button'].includes(el.type)
    );
    
    if (formElements.length > 0) {
      // Return the first unexplored form element
      return formElements[0];
    }
    
    // Fall back to any available interaction
    return availableInteractions[0] || null;
  }
}

async function advancedDiscovery() {
  // Advanced configuration
  const config: InteractionDiscoveryConfig = {
    url: 'https://example.com/form',
    strategy: 'priority-based', // Will use custom strategy
    maxDepth: 10,
    maxStates: 500,
    timeoutPerInteraction: 5000,
    parallelExplorers: 3, // Use 3 parallel browsers
    enableVisualDiff: true,
    captureScreenshots: true,
    detectHiddenElements: true, // Try to find hidden elements
    simulateUserBehavior: true, // Add realistic delays
    browserOptions: {
      headless: true,
      viewport: { width: 1920, height: 1080 }
    }
  };

  const engine = new InteractionDiscoveryEngine(config);

  // Track specific metrics
  const metrics = {
    formsFound: 0,
    inputsInteracted: 0,
    errorsEncountered: 0,
    duplicateStates: 0
  };

  // Custom event handlers
  engine.on('stateDiscovered', ({ state, isNew }) => {
    if (!isNew) {
      metrics.duplicateStates++;
      return;
    }

    // Check for form elements
    const formElements = state.interactableElements.filter(el =>
      ['input', 'select', 'textarea'].includes(el.type)
    );
    
    if (formElements.length > 0) {
      metrics.formsFound++;
      console.log(`[FORM] Found form with ${formElements.length} inputs at ${state.url}`);
    }

    // Check for error messages
    if (state.title?.toLowerCase().includes('error') || 
        state.url.includes('error')) {
      metrics.errorsEncountered++;
      console.log(`[ERROR STATE] ${state.url}`);
    }
  });

  engine.on('interactionCompleted', ({ interaction }) => {
    if (['input', 'select', 'textarea'].includes(interaction.type)) {
      metrics.inputsInteracted++;
    }
  });

  engine.on('explorationProgress', ({ explored, total }) => {
    const percentage = ((explored / total) * 100).toFixed(1);
    console.log(`[PROGRESS] ${percentage}% complete (${explored}/${total} states)`);
  });

  try {
    console.log('Starting advanced interaction discovery...\n');
    
    const startTime = Date.now();
    const result = await engine.discover();
    const duration = Date.now() - startTime;

    // Analyze results
    console.log('\n=== Discovery Complete ===');
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`States discovered: ${result.states.length}`);
    console.log(`Coverage: ${(result.coverage * 100).toFixed(1)}%`);
    
    console.log('\n=== Custom Metrics ===');
    console.log(`Forms found: ${metrics.formsFound}`);
    console.log(`Inputs interacted: ${metrics.inputsInteracted}`);
    console.log(`Error states: ${metrics.errorsEncountered}`);
    console.log(`Duplicate states: ${metrics.duplicateStates}`);

    // Find interesting patterns
    analyzePatterns(result);

    // Export for further analysis
    await exportForVisualization(result);

  } catch (error) {
    console.error('Advanced discovery failed:', error);
  } finally {
    await engine.cleanup();
  }
}

/**
 * Analyze discovered patterns
 */
function analyzePatterns(result: any) {
  console.log('\n=== Pattern Analysis ===');
  
  // Find loops in state transitions
  const loops = findLoops(result.transitions);
  console.log(`Loops found: ${loops.length}`);
  
  // Find dead ends
  const deadEnds = findDeadEnds(result);
  console.log(`Dead end states: ${deadEnds.length}`);
  
  // Find most connected states
  const hubs = findHubStates(result);
  console.log(`Hub states (>5 connections): ${hubs.length}`);
  
  // Interaction type distribution
  const interactionTypes = new Map<string, number>();
  result.interactions.forEach(interaction => {
    interactionTypes.set(
      interaction.type,
      (interactionTypes.get(interaction.type) || 0) + 1
    );
  });
  
  console.log('\nInteraction Types:');
  interactionTypes.forEach((count, type) => {
    console.log(`  ${type}: ${count}`);
  });
}

/**
 * Find loops in state transitions
 */
function findLoops(transitions: any[]): any[] {
  const loops: any[] = [];
  const visited = new Set<string>();
  
  transitions.forEach(transition => {
    const key = `${transition.fromState}-${transition.toState}`;
    const reverseKey = `${transition.toState}-${transition.fromState}`;
    
    if (visited.has(reverseKey)) {
      loops.push({
        states: [transition.fromState, transition.toState],
        type: 'bidirectional'
      });
    }
    
    visited.add(key);
  });
  
  return loops;
}

/**
 * Find states with no outgoing transitions
 */
function findDeadEnds(result: any): any[] {
  const statesWithOutgoing = new Set(
    result.transitions.map(t => t.fromState)
  );
  
  return result.states.filter(state => 
    !statesWithOutgoing.has(state.id)
  );
}

/**
 * Find highly connected states
 */
function findHubStates(result: any): any[] {
  const connectionCount = new Map<string, number>();
  
  result.transitions.forEach(transition => {
    connectionCount.set(
      transition.fromState,
      (connectionCount.get(transition.fromState) || 0) + 1
    );
    connectionCount.set(
      transition.toState,
      (connectionCount.get(transition.toState) || 0) + 1
    );
  });
  
  return result.states.filter(state =>
    (connectionCount.get(state.id) || 0) > 5
  );
}

/**
 * Export results for visualization tools
 */
async function exportForVisualization(result: any) {
  // Create Gephi-compatible format
  const gephiNodes = result.states.map((state, index) => ({
    id: state.id,
    label: state.title || state.url,
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    size: state.possibleInteractions?.length || 1
  }));
  
  const gephiEdges = result.transitions.map((transition, index) => ({
    id: `e${index}`,
    source: transition.fromState,
    target: transition.toState,
    weight: transition.count,
    type: 'directed'
  }));
  
  const gephiData = {
    nodes: gephiNodes,
    edges: gephiEdges
  };
  
  console.log('\nVisualization data prepared (Gephi format)');
  console.log(`Nodes: ${gephiNodes.length}, Edges: ${gephiEdges.length}`);
  
  // In a real implementation, save this to a file
  // fs.writeFileSync('discovery-gephi.json', JSON.stringify(gephiData, null, 2));
}

// Run the example
if (require.main === module) {
  advancedDiscovery().catch(console.error);
}

export { advancedDiscovery };