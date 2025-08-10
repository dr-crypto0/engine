#!/usr/bin/env node

/**
 * Command-line interface for the Molecular Decomposition System
 * 
 * Provides commands for:
 * - Decomposing website screenshots into element hierarchies
 * - Training custom element detection models
 * - Analyzing visual properties
 * - Exporting results in various formats
 */

import { Command } from 'commander';
import { MolecularDecomposer } from './core/MolecularDecomposer';
import { VisionModel } from './core/VisionModel';
import { HierarchyBuilder } from './core/HierarchyBuilder';
import { PropertyExtractor } from './core/PropertyExtractor';
import { MolecularDecompositionConfig, ExportOptions } from './types';
import { logger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

const program = new Command();

program
  .name('molecular-decompose')
  .description('Decompose website screenshots into hierarchical element structures using computer vision')
  .version('1.0.0');

program
  .command('decompose <image>')
  .description('Decompose a screenshot into molecular structure')
  .option('-o, --output <path>', 'Output directory for results', './decomposition-results')
  .option('-m, --model <path>', 'Path to vision model', './models/element-detection')
  .option('-c, --confidence <number>', 'Confidence threshold (0-1)', '0.5')
  .option('--max-elements <number>', 'Maximum elements to detect', '1000')
  .option('--no-ocr', 'Disable OCR text extraction')
  .option('--no-depth', 'Disable depth analysis')
  .option('--no-behavior', 'Disable behavior inference')
  .option('--gpu', 'Enable GPU acceleration', true)
  .option('--format <type>', 'Export format (json, uwr, html)', 'json')
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (imagePath: string, options: any) => {
    try {
      // Configure logger
      if (options.verbose) {
        logger.level = 'debug';
      }

      // Validate input
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Create output directory
      const outputDir = path.resolve(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Build configuration
      const config: MolecularDecompositionConfig = {
        modelPath: options.model,
        confidenceThreshold: parseFloat(options.confidence),
        maxElements: parseInt(options.maxElements),
        enableOCR: options.ocr,
        enableDepthAnalysis: options.depth,
        enableBehaviorInference: options.behavior,
        gpuAcceleration: options.gpu
      };

      logger.info('Starting molecular decomposition', { 
        image: imagePath, 
        config 
      });

      // Initialize components
      const visionModel = new VisionModel(config.modelPath);
      const hierarchyBuilder = new HierarchyBuilder();
      const propertyExtractor = new PropertyExtractor();
      
      const decomposer = new MolecularDecomposer(
        visionModel,
        hierarchyBuilder,
        propertyExtractor,
        config
      );

      // Initialize the system
      console.log('\n🔬 Initializing Molecular Decomposition System...\n');
      await decomposer.initialize();

      // Load image
      console.log(`📸 Loading image: ${imagePath}`);
      const imageBuffer = await fs.promises.readFile(imagePath);
      
      // Get image info
      const metadata = await sharp(imageBuffer).metadata();
      console.log(`   Resolution: ${metadata.width}x${metadata.height}`);
      console.log(`   Format: ${metadata.format}\n`);

      // Perform decomposition
      console.log('🧬 Decomposing molecular structure...');
      const startTime = Date.now();
      
      const result = await decomposer.decompose(imageBuffer);
      
      const duration = Date.now() - startTime;

      // Print summary
      console.log('\n✅ Decomposition completed!\n');
      console.log('📊 Summary:');
      console.log(`   - Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log(`   - Elements detected: ${result.elements.length}`);
      console.log(`   - Hierarchy depth: ${result.structure.hierarchy.maxDepth + 1}`);
      console.log(`   - Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      
      if (result.structure.layoutGrid) {
        console.log(`   - Grid detected: ${result.structure.layoutGrid.columns}x${result.structure.layoutGrid.rows}`);
      }
      
      if (result.warnings && result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`   - ${warning}`));
      }

      // Element type breakdown
      console.log('\n📦 Element Types:');
      const typeCounts = new Map<string, number>();
      result.elements.forEach(el => {
        typeCounts.set(el.type, (typeCounts.get(el.type) || 0) + 1);
      });
      
      Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`   - ${type}: ${count}`);
        });

      // Export results
      console.log(`\n💾 Exporting results as ${options.format}...`);
      
      switch (options.format) {
        case 'json':
          await exportAsJSON(result, outputDir, path.basename(imagePath));
          break;
        case 'uwr':
          await exportAsUWR(result, outputDir, path.basename(imagePath), imagePath);
          break;
        case 'html':
          await exportAsHTML(result, outputDir, path.basename(imagePath), imageBuffer);
          break;
        default:
          throw new Error(`Unknown export format: ${options.format}`);
      }

      console.log(`\n📁 Results saved to: ${outputDir}\n`);

      // Cleanup
      await visionModel.cleanup();

    } catch (error) {
      logger.error('Decomposition failed', error);
      console.error('\n❌ Decomposition failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('analyze <resultFile>')
  .description('Analyze a previous decomposition result')
  .option('--format <type>', 'Analysis format (summary, detailed, visual)', 'summary')
  .action(async (resultFile: string, options: any) => {
    try {
      const resultPath = path.resolve(resultFile);
      
      if (!fs.existsSync(resultPath)) {
        throw new Error(`Result file not found: ${resultPath}`);
      }

      const result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));

      switch (options.format) {
        case 'summary':
          printSummaryAnalysis(result);
          break;
        case 'detailed':
          printDetailedAnalysis(result);
          break;
        case 'visual':
          printVisualAnalysis(result);
          break;
        default:
          console.error(`Unknown analysis format: ${options.format}`);
      }

    } catch (error) {
      console.error('\n❌ Analysis failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('train')
  .description('Train a custom element detection model')
  .option('-d, --dataset <path>', 'Path to training dataset', './training-data')
  .option('-o, --output <path>', 'Output path for trained model', './models/custom')
  .option('-e, --epochs <number>', 'Number of training epochs', '100')
  .option('-b, --batch <number>', 'Batch size', '32')
  .option('--validation-split <number>', 'Validation split ratio', '0.2')
  .action(async (options: any) => {
    console.log('\n🎓 Model training not yet implemented');
    console.log('This feature will allow training custom element detection models');
    console.log('using annotated screenshot datasets.\n');
  });

// Export functions

async function exportAsJSON(result: any, outputDir: string, imageName: string): Promise<void> {
  const outputPath = path.join(outputDir, `${path.parse(imageName).name}-decomposition.json`);
  
  const exportData = {
    metadata: {
      version: '1.0',
      timestamp: new Date().toISOString(),
      sourceImage: imageName,
      confidence: result.confidence,
      processingTime: result.processingTime
    },
    structure: result.structure,
    elements: result.elements,
    properties: Array.from(result.properties.entries()),
    warnings: result.warnings
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log(`   Exported to: ${outputPath}`);
}

async function exportAsUWR(result: any, outputDir: string, imageName: string, imagePath: string): Promise<void> {
  const outputPath = path.join(outputDir, `${path.parse(imageName).name}.uwr.json`);
  
  // Convert to UWR format
  const uwrDoc = {
    version: '1.0',
    metadata: {
      url: 'unknown',
      captureDate: new Date().toISOString(),
      viewport: { width: 0, height: 0 }, // Would need from image metadata
      generator: 'molecular-decomposition'
    },
    visualData: {
      format: 'molecular',
      molecules: result.structure
    },
    stateGraph: {
      nodes: [{
        id: 'initial',
        state: {
          molecules: result.structure,
          properties: Object.fromEntries(result.properties)
        }
      }],
      edges: []
    },
    behavioralEquations: result.structure.behavioralHints.map(hint => ({
      trigger: { type: hint.type, target: hint.elementId },
      effect: { type: 'unknown' },
      confidence: hint.confidence
    }))
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(uwrDoc, null, 2));
  console.log(`   Exported to: ${outputPath}`);
}

async function exportAsHTML(result: any, outputDir: string, imageName: string, imageBuffer: Buffer): Promise<void> {
  const outputPath = path.join(outputDir, `${path.parse(imageName).name}-visualization.html`);
  
  // Create base64 image
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/png;base64,${base64Image}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Molecular Decomposition - ${imageName}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #333; }
    .summary {
      background: #e8f4f8;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .visualization {
      position: relative;
      display: inline-block;
      margin: 20px 0;
    }
    .element-overlay {
      position: absolute;
      border: 2px solid rgba(0, 123, 255, 0.5);
      background: rgba(0, 123, 255, 0.1);
      cursor: pointer;
      transition: all 0.2s;
    }
    .element-overlay:hover {
      border-color: rgba(0, 123, 255, 0.8);
      background: rgba(0, 123, 255, 0.2);
    }
    .element-info {
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      display: none;
      z-index: 1000;
      font-size: 12px;
      min-width: 200px;
    }
    .element-overlay:hover .element-info {
      display: block;
    }
    .hierarchy {
      margin: 20px 0;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .tree-node {
      margin-left: 20px;
      padding: 5px 0;
      border-left: 1px solid #ddd;
      position: relative;
    }
    .tree-node::before {
      content: '';
      position: absolute;
      left: -1px;
      top: 15px;
      width: 20px;
      height: 1px;
      background: #ddd;
    }
    .element-type {
      display: inline-block;
      padding: 2px 8px;
      background: #007bff;
      color: white;
      border-radius: 3px;
      font-size: 11px;
      margin-right: 5px;
    }
    .confidence {
      color: #666;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧬 Molecular Decomposition Results</h1>
    
    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Image:</strong> ${imageName}</p>
      <p><strong>Elements Detected:</strong> ${result.elements.length}</p>
      <p><strong>Hierarchy Depth:</strong> ${result.structure.hierarchy.maxDepth + 1}</p>
      <p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(1)}%</p>
      <p><strong>Processing Time:</strong> ${result.processingTime}ms</p>
    </div>

    <h2>Visual Decomposition</h2>
    <div class="visualization">
      <img src="${imageDataUrl}" alt="Original image">
      ${result.elements.map(element => `
        <div class="element-overlay" style="
          left: ${element.boundingBox.x}px;
          top: ${element.boundingBox.y}px;
          width: ${element.boundingBox.width}px;
          height: ${element.boundingBox.height}px;
        ">
          <div class="element-info">
            <strong>Type:</strong> ${element.type}<br>
            <strong>ID:</strong> ${element.id.substring(0, 8)}...<br>
            <strong>Confidence:</strong> ${(element.confidence * 100).toFixed(1)}%<br>
            <strong>Depth:</strong> ${element.depth}<br>
            <strong>Size:</strong> ${element.boundingBox.width}×${element.boundingBox.height}<br>
            ${element.visualFeatures?.colors?.primary ? 
              `<strong>Primary Color:</strong> ${element.visualFeatures.colors.primary.hex}<br>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="hierarchy">
      <h2>Element Hierarchy</h2>
      ${renderHierarchy(result.structure.hierarchy, result.elements)}
    </div>

    <h2>Element Types Distribution</h2>
    <canvas id="typeChart" width="400" height="200"></canvas>

    <script>
      // Simple bar chart for element types
      const canvas = document.getElementById('typeChart');
      const ctx = canvas.getContext('2d');
      const types = ${JSON.stringify(getTypeDistribution(result.elements))};
      
      const maxCount = Math.max(...Object.values(types));
      const barWidth = 30;
      const barSpacing = 10;
      let x = 20;
      
      ctx.font = '12px Arial';
      ctx.fillStyle = '#333';
      
      Object.entries(types).forEach(([type, count]) => {
        const barHeight = (count / maxCount) * 150;
        
        // Draw bar
        ctx.fillStyle = '#007bff';
        ctx.fillRect(x, 170 - barHeight, barWidth, barHeight);
        
        // Draw label
        ctx.fillStyle = '#333';
        ctx.save();
        ctx.translate(x + barWidth/2, 180);
        ctx.rotate(-Math.PI/4);
        ctx.fillText(type, 0, 0);
        ctx.restore();
        
        // Draw count
        ctx.fillText(count, x + barWidth/2 - 5, 165 - barHeight);
        
        x += barWidth + barSpacing;
      });
    </script>
  </div>
</body>
</html>
  `;
  
  fs.writeFileSync(outputPath, html);
  console.log(`   Exported to: ${outputPath}`);
}

function renderHierarchy(hierarchy: any, elements: any[]): string {
  const elementMap = new Map(elements.map(el => [el.id, el]));
  
  function renderNode(elementId: string, depth: number = 0): string {
    const element = elementMap.get(elementId);
    if (!element) return '';
    
    const children = hierarchy.parentChildMap.get(elementId) || [];
    const indent = '  '.repeat(depth);
    
    return `
      <div class="tree-node" style="margin-left: ${depth * 20}px">
        <span class="element-type">${element.type}</span>
        <span class="confidence">${(element.confidence * 100).toFixed(0)}%</span>
        ${element.boundingBox.width}×${element.boundingBox.height}
        ${children.map(childId => renderNode(childId, depth + 1)).join('')}
      </div>
    `;
  }
  
  // Find root elements
  const roots = elements.filter(el => !el.parent);
  return roots.map(root => renderNode(root.id)).join('');
}

function getTypeDistribution(elements: any[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  elements.forEach(el => {
    distribution[el.type] = (distribution[el.type] || 0) + 1;
  });
  return distribution;
}

function printSummaryAnalysis(result: any): void {
  console.log('\n📊 Decomposition Summary\n');
  console.log(`Elements: ${result.elements.length}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`Processing Time: ${result.processingTime}ms`);
  console.log(`Hierarchy Depth: ${result.structure.hierarchy.maxDepth + 1}`);
  
  if (result.structure.layoutGrid) {
    console.log(`Grid Layout: ${result.structure.layoutGrid.columns}×${result.structure.layoutGrid.rows}`);
  }
  
  console.log('\nElement Types:');
  const types = getTypeDistribution(result.elements);
  Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
}

function printDetailedAnalysis(result: any): void {
  printSummaryAnalysis(result);
  
  console.log('\n🔍 Detailed Analysis\n');
  
  // Hierarchy analysis
  console.log('Hierarchy Structure:');
  const levels = result.structure.hierarchy.levels;
  Object.entries(levels).forEach(([depth, elements]) => {
    console.log(`  Level ${depth}: ${(elements as any[]).length} elements`);
  });
  
  // Sibling groups
  console.log('\nSibling Groups:');
  result.structure.siblingGroups.forEach((group: any, i: number) => {
    console.log(`  Group ${i + 1}: ${group.elements.length} ${group.layout} elements`);
  });
  
  // Behavioral hints
  if (result.structure.behavioralHints.length > 0) {
    console.log('\nBehavioral Hints:');
    const hintTypes = new Map<string, number>();
    result.structure.behavioralHints.forEach((hint: any) => {
      hintTypes.set(hint.type, (hintTypes.get(hint.type) || 0) + 1);
    });
    hintTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count} elements`);
    });
  }
}

function printVisualAnalysis(result: any): void {
  console.log('\n🎨 Visual Analysis\n');
  
  // Color analysis
  const colors = new Set<string>();
  result.elements.forEach((el: any) => {
    if (el.visualFeatures?.colors?.primary) {
      colors.add(el.visualFeatures.colors.primary.hex);
    }
  });
  
  console.log(`Unique Primary Colors: ${colors.size}`);
  if (colors.size <= 10) {
    console.log('Colors:');
    colors.forEach(color => console.log(`  ${color}`));
  }
  
  // Size analysis
  const sizes = result.elements.map((el: any) => ({
    width: el.boundingBox.width,
    height: el.boundingBox.height,
    area: el.boundingBox.width * el.boundingBox.height
  }));
  
  sizes.sort((a, b) => b.area - a.area);
  
  console.log('\nLargest Elements:');
  sizes.slice(0, 5).forEach((size, i) => {
    console.log(`  ${i + 1}. ${size.width}×${size.height} (${size.area}px²)`);
  });
  
  // Spacing patterns
  console.log('\nSpacing Patterns:');
  const paddings = new Map<string, number>();
  result.elements.forEach((el: any) => {
    if (el.visualFeatures?.spacing?.padding) {
      const p = el.visualFeatures.spacing.padding;
      const key = `${p.top}-${p.right}-${p.bottom}-${p.left}`;
      paddings.set(key, (paddings.get(key) || 0) + 1);
    }
  });
  
  Array.from(paddings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([padding, count]) => {
      console.log(`  ${padding}: ${count} elements`);
    });
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}