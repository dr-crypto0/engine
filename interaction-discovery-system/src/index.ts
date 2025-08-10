/**
 * Interaction Discovery System
 * 
 * A revolutionary system that discovers all possible interactions on a website
 * through intelligent exploration and state management, without relying on
 * traditional DOM parsing methods.
 */

// Core components
export { InteractionDiscoveryEngine } from './core/InteractionDiscoveryEngine';
export { ElementDetector } from './core/ElementDetector';
export { StateManager } from './core/StateManager';
export { InteractionExecutor } from './core/InteractionExecutor';
export { StateComparator } from './core/StateComparator';
export { ExplorationStrategist } from './core/ExplorationStrategist';

// Types
export * from './types';

// Utils
export { logger } from './utils/logger';

// Main entry point for programmatic usage
export { InteractionDiscoveryEngine as default } from './core/InteractionDiscoveryEngine';