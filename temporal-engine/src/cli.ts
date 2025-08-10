#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createTemporalEngine, Frame, InteractionEvent } from './index';
import { createLogger } from './utils/logger';

const logger = createLogger('CLI');
const program = new Command();

program
  .name('temporal-engine')
  .description('Temporal analysis engine for detecting keyframes and correlating visual changes')
  .version('1.0.0');

/**
 * Analyze command - main temporal analysis functionality
 */
program
  .command('analyze')
  .description('Analyze frames and events to create temporal slices')
  .requiredOption('-f, --frames <path>', 'Path to frames data file (JSON)')
  .requiredOption('-e, --events <path>', 'Path to events data file (JSON)')
  .option('-o, --output <path>', 'Output path for results', 'temporal-analysis.json')
  .option('--change-threshold <number>', 'Minimum change threshold (0-1)', '0.01')
  .option('--min-slice-duration <ms>', 'Minimum slice duration in ms', '50')
  .option('--max-slice-duration <ms>', 'Maximum slice duration in ms', '5000')
  .option('--merge-slices', 'Merge adjacent similar slices', true)
  .option('--correlation-threshold <number>', 'Correlation confidence threshold (0-1)', '0.7')
  .option('--pretty', 'Pretty print JSON output', false)
  .action(async (options) => {
    try {
      logger.info('Starting temporal analysis', { options });

      // Validate input files
      if (!existsSync(options.frames)) {
        throw new Error(`Frames file not found: ${options.frames}`);
      }
      if (!existsSync(options.events)) {
        throw new Error(`Events file not found: ${options.events}`);
      }

      // Load data
      const framesData = JSON.parse(readFileSync(options.frames, 'utf-8'));
      const eventsData = JSON.parse(readFileSync(options.events, 'utf-8'));

      // Validate data format
      if (!Array.isArray(framesData)) {
        throw new Error('Frames data must be an array');
      }
      if (!Array.isArray(eventsData)) {
        throw new Error('Events data must be an array');
      }

      // Convert base64 frame data to buffers if needed
      const frames: Frame[] = framesData.map(frame => ({
        ...frame,
        data: typeof frame.data === 'string' ? 
          Buffer.from(frame.data, 'base64') : 
          Buffer.from(frame.data)
      }));

      const events: InteractionEvent[] = eventsData;

      // Create temporal engine with configuration
      const engine = createTemporalEngine({
        temporalSlicer: {
          changeThreshold: parseFloat(options.changeThreshold),
          minSliceDuration: parseInt(options.minSliceDuration),
          maxSliceDuration: parseInt(options.maxSliceDuration),
          mergeAdjacentSlices: options.mergeSlices,
          correlationThreshold: parseFloat(options.correlationThreshold)
        }
      });

      // Perform analysis
      logger.info('Analyzing temporal data...', {
        frameCount: frames.length,
        eventCount: events.length
      });

      const result = await engine.analyze(frames, events);

      // Prepare output (convert buffers back to base64 for JSON)
      const output = {
        ...result,
        slices: result.slices.map(slice => ({
          ...slice,
          startFrame: {
            ...slice.startFrame,
            data: slice.startFrame.data.toString('base64')
          },
          endFrame: {
            ...slice.endFrame,
            data: slice.endFrame.data.toString('base64')
          },
          frames: slice.frames.map(frame => ({
            ...frame,
            data: frame.data.toString('base64')
          }))
        }))
      };

      // Write results
      const outputPath = resolve(options.output);
      writeFileSync(
        outputPath,
        JSON.stringify(output, null, options.pretty ? 2 : 0)
      );

      logger.info('Analysis complete', {
        outputPath,
        sliceCount: result.slices.length,
        chainCount: result.causalChains.length
      });

      // Print summary
      console.log('\n📊 Temporal Analysis Summary:');
      console.log(`  • Total frames analyzed: ${result.statistics.totalFrames}`);
      console.log(`  • Total events processed: ${result.statistics.totalEvents}`);
      console.log(`  • Temporal slices created: ${result.statistics.totalSlices}`);
      console.log(`  • Average slice duration: ${Math.round(result.statistics.averageSliceDuration)}ms`);
      console.log(`  • Most common change type: ${result.statistics.mostCommonChangeType}`);
      console.log(`  • Causal chains identified: ${result.causalChains.length}`);
      console.log(`\n✅ Results saved to: ${outputPath}`);

    } catch (error) {
      logger.error('Analysis failed', { error });
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Detect changes command - compare two frames
 */
program
  .command('detect-changes')
  .description('Detect changes between two frames')
  .requiredOption('-f1, --frame1 <path>', 'Path to first frame (PNG)')
  .requiredOption('-f2, --frame2 <path>', 'Path to second frame (PNG)')
  .option('-o, --output <path>', 'Output path for change map', 'change-map.json')
  .option('--pixel-threshold <number>', 'Pixel difference threshold (0-255)', '30')
  .option('--min-region-size <pixels>', 'Minimum region size', '100')
  .option('--pretty', 'Pretty print JSON output', false)
  .action(async (options) => {
    try {
      logger.info('Detecting changes between frames', { options });

      // Validate input files
      if (!existsSync(options.frame1)) {
        throw new Error(`Frame 1 not found: ${options.frame1}`);
      }
      if (!existsSync(options.frame2)) {
        throw new Error(`Frame 2 not found: ${options.frame2}`);
      }

      // Load frames
      const frame1Data = readFileSync(options.frame1);
      const frame2Data = readFileSync(options.frame2);

      // Create change detector
      const engine = createTemporalEngine({
        changeDetector: {
          pixelThreshold: parseInt(options.pixelThreshold),
          minRegionSize: parseInt(options.minRegionSize)
        }
      });

      // Detect changes
      logger.info('Analyzing frame differences...');
      const changeMap = await engine.changeDetector.detectChanges(frame1Data, frame2Data);

      // Write results
      const outputPath = resolve(options.output);
      writeFileSync(
        outputPath,
        JSON.stringify(changeMap, null, options.pretty ? 2 : 0)
      );

      logger.info('Change detection complete', {
        outputPath,
        changePercentage: changeMap.changePercentage,
        regionCount: changeMap.regions.length
      });

      // Print summary
      console.log('\n🔍 Change Detection Summary:');
      console.log(`  • Changed pixels: ${changeMap.changedPixels}`);
      console.log(`  • Change percentage: ${changeMap.changePercentage.toFixed(2)}%`);
      console.log(`  • Regions detected: ${changeMap.regions.length}`);
      console.log(`  • Overall intensity: ${changeMap.overallIntensity.toFixed(3)}`);
      console.log('\n📊 Metrics:');
      console.log(`  • MSE: ${changeMap.metrics.mse.toFixed(2)}`);
      console.log(`  • PSNR: ${changeMap.metrics.psnr.toFixed(2)} dB`);
      console.log(`  • SSIM: ${changeMap.metrics.ssim.toFixed(3)}`);
      console.log(`\n✅ Results saved to: ${outputPath}`);

    } catch (error) {
      logger.error('Change detection failed', { error });
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Correlate command - correlate events with changes
 */
program
  .command('correlate')
  .description('Correlate interaction events with visual changes')
  .requiredOption('-c, --changes <path>', 'Path to change map file (JSON)')
  .requiredOption('-e, --event <path>', 'Path to event file (JSON)')
  .option('-o, --output <path>', 'Output path for correlation', 'correlation.json')
  .option('--max-delay <ms>', 'Maximum correlation delay in ms', '2000')
  .option('--spatial-threshold <pixels>', 'Spatial proximity threshold', '100')
  .option('--pretty', 'Pretty print JSON output', false)
  .action(async (options) => {
    try {
      logger.info('Correlating events with changes', { options });

      // Load data
      const changeMap = JSON.parse(readFileSync(options.changes, 'utf-8'));
      const event = JSON.parse(readFileSync(options.event, 'utf-8'));

      // Create event correlator
      const engine = createTemporalEngine({
        eventCorrelator: {
          maxCorrelationDelay: parseInt(options.maxDelay),
          spatialThreshold: parseInt(options.spatialThreshold)
        }
      });

      // Perform correlation
      const correlation = engine.eventCorrelator.correlate(changeMap, event);

      // Write results
      const outputPath = resolve(options.output);
      writeFileSync(
        outputPath,
        JSON.stringify(correlation, null, options.pretty ? 2 : 0)
      );

      logger.info('Correlation complete', {
        outputPath,
        correlationType: correlation.correlationType,
        confidence: correlation.confidence
      });

      // Print summary
      console.log('\n🔗 Correlation Summary:');
      console.log(`  • Event type: ${correlation.event.type}`);
      console.log(`  • Correlation type: ${correlation.correlationType}`);
      console.log(`  • Confidence: ${(correlation.confidence * 100).toFixed(1)}%`);
      console.log(`  • Delay: ${correlation.delay}ms`);
      console.log(`\n✅ Results saved to: ${outputPath}`);

    } catch (error) {
      logger.error('Correlation failed', { error });
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Example command - generate example data files
 */
program
  .command('example')
  .description('Generate example frame and event data files')
  .option('-o, --output-dir <path>', 'Output directory', './examples')
  .action((options) => {
    try {
      const outputDir = resolve(options.outputDir);
      
      // Create example frames
      const exampleFrames: Frame[] = [
        {
          id: 'frame_001',
          timestamp: 1000,
          data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
          dimensions: { width: 1920, height: 1080 },
          frameNumber: 1
        },
        {
          id: 'frame_002',
          timestamp: 1100,
          data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
          dimensions: { width: 1920, height: 1080 },
          frameNumber: 2
        }
      ];

      // Create example events
      const exampleEvents: InteractionEvent[] = [
        {
          id: 'event_001',
          type: 'click',
          timestamp: 1050,
          target: {
            x: 500,
            y: 300,
            width: 100,
            height: 50
          },
          data: {
            button: 0
          }
        }
      ];

      // Save example files
      const framesPath = join(outputDir, 'example-frames.json');
      const eventsPath = join(outputDir, 'example-events.json');

      writeFileSync(framesPath, JSON.stringify(exampleFrames, null, 2));
      writeFileSync(eventsPath, JSON.stringify(exampleEvents, null, 2));

      console.log('\n📝 Example files created:');
      console.log(`  • Frames: ${framesPath}`);
      console.log(`  • Events: ${eventsPath}`);
      console.log('\nRun analysis with:');
      console.log(`  temporal-engine analyze -f "${framesPath}" -e "${eventsPath}"`);

    } catch (error) {
      logger.error('Failed to create examples', { error });
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}