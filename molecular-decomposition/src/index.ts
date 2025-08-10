/**
 * Molecular Decomposition System
 * 
 * A computer vision-based system for decomposing website screenshots
 * into hierarchical element structures with extracted visual properties.
 */

// Core components
export { MolecularDecomposer } from './core/MolecularDecomposer';
export { VisionModel } from './core/VisionModel';
export { HierarchyBuilder } from './core/HierarchyBuilder';
export { PropertyExtractor } from './core/PropertyExtractor';

// Types
export * from './types';

// Utils
export { logger } from './utils/logger';

// Main entry point for programmatic usage
export { MolecularDecomposer as default } from './core/MolecularDecomposer';