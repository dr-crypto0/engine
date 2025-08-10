#!/usr/bin/env node

/**
 * Command-line interface for the Interaction Discovery System
 * 
 * Provides a user-friendly way to discover interactions on websites
 * and generate comprehensive state graphs.
 */

import { Command } from 'commander';
import { InteractionDiscoveryEngine } from './core/InteractionDiscoveryEngine';
import { logger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import {
  InteractionDiscoveryConfig,
  DiscoveryResult,
  ExplorationStrategyType
} from './types';

const program = new Command();

program
  .name('interaction-discovery')
  .description('Discover all possible interactions on a website through intelligent exploration')
  .version('1.0.0');

program
  .command('discover <url>')
  .description('Discover interactions on the specified URL')
  .option('-o, --output <path>', 'Output directory for results', './discovery-results')
  .option('-s, --strategy <type>', 'Exploration strategy (breadth-first, depth-first, intelligent)', 'intelligent')
  .option('-t, --timeout <seconds>', 'Maximum discovery time in seconds', '300')
  .option('-d, --max-depth <number>', 'Maximum exploration depth', '10')
  .option('-p, --parallel <number>', 'Number of parallel explorers', '1')
  .option('--headless', 'Run browser in headless mode', false)
  .option('--viewport <width>x<height>', 'Browser viewport size', '1920x1080')
  .option('--save-screenshots', 'Save screenshots for each state', false)
  .option('--save-videos', 'Record videos of interactions', false)
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (url: string, options: any) => {
    try {
      // Parse viewport
      const [width, height] = options.viewport.split('x').map(Number);
      
      // Configure logger
      if (options.verbose) {
        logger.level = 'debug';
      }

      // Create output directory
      const outputDir = path.resolve(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Build configuration
      const config: InteractionDiscoveryConfig = {
        url,
        strategy: options.strategy as ExplorationStrategyType,
        maxDepth: parseInt(options.maxDepth),
        maxDuration: parseInt(options.timeout) * 1000,
        parallelExplorers: parseInt(options.parallel),
        browserOptions: {
          headless: options.headless,
          viewport: { width, height }
        },
        captureOptions: {
          screenshots: options.saveScreenshots,
          videos: options.saveVideos
        }
      };

      logger.info('Starting interaction discovery', { url, config });

      // Initialize engine
      const engine = new InteractionDiscoveryEngine(config);

      // Set up progress reporting
      engine.on('stateDiscovered', (state) => {
        logger.info(`Discovered new state: ${state.id}`, {
          url: state.url,
          interactionsFound: state.possibleInteractions?.length || 0
        });
      });

      engine.on('interactionExecuted', (interaction) => {
        logger.debug(`Executed interaction: ${interaction.type} on ${interaction.selector}`);
      });

      engine.on('explorationProgress', (progress) => {
        logger.info(`Progress: ${progress.explored}/${progress.total} states explored`);
      });

      // Start discovery
      console.log(`\n🔍 Starting interaction discovery on: ${url}\n`);
      const startTime = Date.now();
      
      const result: DiscoveryResult = await engine.discover();
      
      const duration = Date.now() - startTime;

      // Save results
      const resultPath = path.join(outputDir, 'discovery-result.json');
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

      // Save state graph visualization if available
      if (result.stateGraph) {
        const graphPath = path.join(outputDir, 'state-graph.json');
        fs.writeFileSync(graphPath, JSON.stringify(result.stateGraph, null, 2));
      }

      // Print summary
      console.log('\n✅ Discovery completed successfully!\n');
      console.log(`📊 Summary:`);
      console.log(`   - Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log(`   - States discovered: ${result.states.length}`);
      console.log(`   - Unique interactions: ${result.interactions.length}`);
      console.log(`   - Total transitions: ${result.transitions.length}`);
      console.log(`   - Coverage estimate: ${(result.coverage * 100).toFixed(1)}%`);
      console.log(`\n📁 Results saved to: ${outputDir}\n`);

      // Cleanup
      await engine.cleanup();

    } catch (error) {
      logger.error('Discovery failed', error);
      console.error('\n❌ Discovery failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('analyze <resultFile>')
  .description('Analyze a previous discovery result')
  .option('--format <type>', 'Output format (summary, detailed, graph)', 'summary')
  .action(async (resultFile: string, options: any) => {
    try {
      const resultPath = path.resolve(resultFile);
      
      if (!fs.existsSync(resultPath)) {
        throw new Error(`Result file not found: ${resultPath}`);
      }

      const result: DiscoveryResult = JSON.parse(
        fs.readFileSync(resultPath, 'utf-8')
      );

      switch (options.format) {
        case 'summary':
          console.log('\n📊 Discovery Result Summary\n');
          console.log(`URL: ${result.url}`);
          console.log(`Discovery Date: ${new Date(result.timestamp).toLocaleString()}`);
          console.log(`States: ${result.states.length}`);
          console.log(`Interactions: ${result.interactions.length}`);
          console.log(`Transitions: ${result.transitions.length}`);
          console.log(`Coverage: ${(result.coverage * 100).toFixed(1)}%`);
          break;

        case 'detailed':
          console.log('\n📊 Detailed Discovery Analysis\n');
          
          // States breakdown
          console.log('States by Type:');
          const stateTypes = result.states.reduce((acc, state) => {
            const type = state.metadata?.type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          Object.entries(stateTypes).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count}`);
          });

          // Interactions breakdown
          console.log('\nInteractions by Type:');
          const interactionTypes = result.interactions.reduce((acc, interaction) => {
            acc[interaction.type] = (acc[interaction.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          Object.entries(interactionTypes).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count}`);
          });

          // Most connected states
          console.log('\nMost Connected States:');
          const connectionCounts = new Map<string, number>();
          
          result.transitions.forEach(transition => {
            connectionCounts.set(
              transition.fromState,
              (connectionCounts.get(transition.fromState) || 0) + 1
            );
          });

          const topStates = Array.from(connectionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

          topStates.forEach(([stateId, count]) => {
            const state = result.states.find(s => s.id === stateId);
            console.log(`  - ${state?.url || stateId}: ${count} outgoing transitions`);
          });
          break;

        case 'graph':
          console.log('\n📊 State Graph Structure\n');
          
          if (!result.stateGraph) {
            console.log('No state graph available in the result.');
            break;
          }

          console.log(`Nodes: ${result.stateGraph.nodes.length}`);
          console.log(`Edges: ${result.stateGraph.edges.length}`);
          
          // Find entry points
          const entryPoints = result.stateGraph.nodes.filter(node => 
            !result.stateGraph!.edges.some(edge => edge.to === node.id)
          );
          
          console.log(`\nEntry Points: ${entryPoints.length}`);
          entryPoints.forEach(node => {
            console.log(`  - ${node.label || node.id}`);
          });

          // Find dead ends
          const deadEnds = result.stateGraph.nodes.filter(node =>
            !result.stateGraph!.edges.some(edge => edge.from === node.id)
          );
          
          console.log(`\nDead Ends: ${deadEnds.length}`);
          deadEnds.forEach(node => {
            console.log(`  - ${node.label || node.id}`);
          });
          break;

        default:
          console.error(`Unknown format: ${options.format}`);
          process.exit(1);
      }

    } catch (error) {
      console.error('\n❌ Analysis failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('export <resultFile>')
  .description('Export discovery results to different formats')
  .option('-f, --format <type>', 'Export format (uwr, graphviz, cytoscape)', 'uwr')
  .option('-o, --output <path>', 'Output file path')
  .action(async (resultFile: string, options: any) => {
    try {
      const resultPath = path.resolve(resultFile);
      
      if (!fs.existsSync(resultPath)) {
        throw new Error(`Result file not found: ${resultPath}`);
      }

      const result: DiscoveryResult = JSON.parse(
        fs.readFileSync(resultPath, 'utf-8')
      );

      let outputContent: string;
      let defaultExtension: string;

      switch (options.format) {
        case 'uwr':
          // Convert to UWR format (simplified version)
          const uwrDoc = {
            version: '1.0',
            metadata: {
              url: result.url,
              captureDate: result.timestamp,
              generator: 'interaction-discovery-system'
            },
            states: result.states.map(state => ({
              id: state.id,
              url: state.url,
              screenshot: state.screenshot,
              interactions: state.possibleInteractions
            })),
            stateGraph: result.stateGraph
          };
          outputContent = JSON.stringify(uwrDoc, null, 2);
          defaultExtension = '.uwr.json';
          break;

        case 'graphviz':
          // Convert to DOT format for Graphviz
          if (!result.stateGraph) {
            throw new Error('No state graph available for Graphviz export');
          }

          outputContent = 'digraph StateGraph {\n';
          outputContent += '  rankdir=LR;\n';
          outputContent += '  node [shape=box];\n\n';

          // Add nodes
          result.stateGraph.nodes.forEach(node => {
            const label = node.label || node.id;
            outputContent += `  "${node.id}" [label="${label.replace(/"/g, '\\"')}"];\n`;
          });

          outputContent += '\n';

          // Add edges
          result.stateGraph.edges.forEach(edge => {
            const label = edge.label || '';
            outputContent += `  "${edge.from}" -> "${edge.to}"`;
            if (label) {
              outputContent += ` [label="${label.replace(/"/g, '\\"')}"]`;
            }
            outputContent += ';\n';
          });

          outputContent += '}\n';
          defaultExtension = '.dot';
          break;

        case 'cytoscape':
          // Convert to Cytoscape.js format
          if (!result.stateGraph) {
            throw new Error('No state graph available for Cytoscape export');
          }

          const cytoscapeData = {
            elements: {
              nodes: result.stateGraph.nodes.map(node => ({
                data: {
                  id: node.id,
                  label: node.label || node.id,
                  ...node.data
                }
              })),
              edges: result.stateGraph.edges.map((edge, index) => ({
                data: {
                  id: `edge-${index}`,
                  source: edge.from,
                  target: edge.to,
                  label: edge.label || '',
                  ...edge.data
                }
              }))
            }
          };

          outputContent = JSON.stringify(cytoscapeData, null, 2);
          defaultExtension = '.cytoscape.json';
          break;

        default:
          throw new Error(`Unknown export format: ${options.format}`);
      }

      // Determine output path
      const outputPath = options.output || 
        resultFile.replace(/\.[^.]+$/, defaultExtension);

      // Write output
      fs.writeFileSync(outputPath, outputContent);
      console.log(`\n✅ Exported to: ${outputPath}\n`);

    } catch (error) {
      console.error('\n❌ Export failed:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}