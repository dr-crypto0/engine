/**
 * Basic example of using the Molecular Decomposition System
 * 
 * This example demonstrates how to decompose a website screenshot
 * into a hierarchical structure of detected elements with extracted
 * visual properties.
 */

import {
  MolecularDecomposer,
  VisionModel,
  HierarchyBuilder,
  PropertyExtractor,
  MolecularDecompositionConfig
} from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function decomposeScreenshot() {
  // Configuration
  const config: MolecularDecompositionConfig = {
    modelPath: './models/element-detection',
    confidenceThreshold: 0.5,
    maxElements: 100,
    enableOCR: true,
    enableDepthAnalysis: true,
    enableBehaviorInference: true,
    gpuAcceleration: true
  };

  // Initialize components
  console.log('Initializing Molecular Decomposition System...');
  
  const visionModel = new VisionModel(config.modelPath);
  const hierarchyBuilder = new HierarchyBuilder();
  const propertyExtractor = new PropertyExtractor();
  
  const decomposer = new MolecularDecomposer(
    visionModel,
    hierarchyBuilder,
    propertyExtractor,
    config
  );

  try {
    // Initialize the system
    await decomposer.initialize();
    console.log('System initialized successfully');

    // Load screenshot
    const screenshotPath = path.join(__dirname, 'sample-website.png');
    console.log(`Loading screenshot: ${screenshotPath}`);
    
    const screenshot = await fs.promises.readFile(screenshotPath);

    // Perform decomposition
    console.log('Starting molecular decomposition...');
    const startTime = Date.now();
    
    const result = await decomposer.decompose(screenshot);
    
    const duration = Date.now() - startTime;
    console.log(`Decomposition completed in ${duration}ms`);

    // Display results
    console.log('\n=== Decomposition Results ===');
    console.log(`Total elements detected: ${result.elements.length}`);
    console.log(`Hierarchy depth: ${result.structure.hierarchy.maxDepth + 1}`);
    console.log(`Overall confidence: ${(result.confidence * 100).toFixed(1)}%`);

    // Show element type distribution
    console.log('\nElement Types:');
    const typeCounts = new Map<string, number>();
    result.elements.forEach(element => {
      typeCounts.set(element.type, (typeCounts.get(element.type) || 0) + 1);
    });
    
    typeCounts.forEach((count, type) => {
      console.log(`  ${type}: ${count}`);
    });

    // Show hierarchy structure
    console.log('\nHierarchy Structure:');
    result.structure.hierarchy.levels.forEach((elements, depth) => {
      console.log(`  Level ${depth}: ${elements.length} elements`);
    });

    // Show detected layout patterns
    if (result.structure.layoutGrid) {
      console.log(`\nGrid Layout Detected:`);
      console.log(`  Columns: ${result.structure.layoutGrid.columns}`);
      console.log(`  Rows: ${result.structure.layoutGrid.rows}`);
      console.log(`  Gutter: ${result.structure.layoutGrid.gutterWidth}px x ${result.structure.layoutGrid.gutterHeight}px`);
    }

    // Show sibling groups
    if (result.structure.hierarchy.siblingGroups.length > 0) {
      console.log(`\nSibling Groups: ${result.structure.hierarchy.siblingGroups.length}`);
      result.structure.hierarchy.siblingGroups.forEach((group, i) => {
        console.log(`  Group ${i + 1}: ${group.elements.length} ${group.layout} elements`);
      });
    }

    // Show behavioral hints
    if (result.structure.behavioralHints.length > 0) {
      console.log(`\nBehavioral Hints: ${result.structure.behavioralHints.length}`);
      const hintTypes = new Map<string, number>();
      result.structure.behavioralHints.forEach(hint => {
        hintTypes.set(hint.type, (hintTypes.get(hint.type) || 0) + 1);
      });
      hintTypes.forEach((count, type) => {
        console.log(`  ${type}: ${count} elements`);
      });
    }

    // Example: Access specific element properties
    console.log('\nSample Element Details:');
    const sampleElement = result.elements[0];
    if (sampleElement) {
      console.log(`  ID: ${sampleElement.id}`);
      console.log(`  Type: ${sampleElement.type}`);
      console.log(`  Position: (${sampleElement.boundingBox.x}, ${sampleElement.boundingBox.y})`);
      console.log(`  Size: ${sampleElement.boundingBox.width}x${sampleElement.boundingBox.height}`);
      console.log(`  Confidence: ${(sampleElement.confidence * 100).toFixed(1)}%`);
      
      if (sampleElement.visualFeatures) {
        console.log(`  Primary Color: ${sampleElement.visualFeatures.colors.primary.hex}`);
        console.log(`  Background Color: ${sampleElement.visualFeatures.colors.background.hex}`);
      }
    }

    // Save results
    const outputPath = path.join(__dirname, 'decomposition-result.json');
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(result, null, 2)
    );
    console.log(`\nResults saved to: ${outputPath}`);

    // Cleanup
    await visionModel.cleanup();

  } catch (error) {
    console.error('Decomposition failed:', error);
  }
}

// Helper function to visualize hierarchy
function printHierarchy(
  elements: any[],
  parentChildMap: Map<string, string[]>,
  elementId: string | null = null,
  depth: number = 0
): void {
  const indent = '  '.repeat(depth);
  
  if (elementId === null) {
    // Find root elements
    const roots = elements.filter(el => !el.parent);
    roots.forEach(root => {
      console.log(`${indent}${root.type} (${(root.confidence * 100).toFixed(0)}%)`);
      printHierarchy(elements, parentChildMap, root.id, depth + 1);
    });
  } else {
    // Print children
    const children = parentChildMap.get(elementId) || [];
    children.forEach(childId => {
      const child = elements.find(el => el.id === childId);
      if (child) {
        console.log(`${indent}${child.type} (${(child.confidence * 100).toFixed(0)}%)`);
        printHierarchy(elements, parentChildMap, childId, depth + 1);
      }
    });
  }
}

// Run the example
if (require.main === module) {
  decomposeScreenshot().catch(console.error);
}

export { decomposeScreenshot };