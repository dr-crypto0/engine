/**
 * Basic example of using the Temporal Analysis Engine
 * 
 * This example demonstrates:
 * - Creating a temporal engine instance
 * - Analyzing frames and events
 * - Processing the results
 */

import { createTemporalEngine, Frame, InteractionEvent } from '../src';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function runBasicAnalysis() {
  console.log('🚀 Temporal Analysis Engine - Basic Example\n');

  // Create sample frames (in real usage, these would come from Visual Capture Engine)
  const frames: Frame[] = [
    {
      id: 'frame_001',
      timestamp: 1000,
      data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
      dimensions: { width: 1920, height: 1080 },
      frameNumber: 1
    },
    {
      id: 'frame_002',
      timestamp: 1050,
      data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'),
      dimensions: { width: 1920, height: 1080 },
      frameNumber: 2
    },
    {
      id: 'frame_003',
      timestamp: 1100,
      data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
      dimensions: { width: 1920, height: 1080 },
      frameNumber: 3
    },
    {
      id: 'frame_004',
      timestamp: 1150,
      data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'),
      dimensions: { width: 1920, height: 1080 },
      frameNumber: 4
    },
    {
      id: 'frame_005',
      timestamp: 1200,
      data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
      dimensions: { width: 1920, height: 1080 },
      frameNumber: 5
    }
  ];

  // Create sample events (in real usage, these would come from Interaction Discovery)
  const events: InteractionEvent[] = [
    {
      id: 'event_001',
      type: 'click',
      timestamp: 1025,
      target: {
        x: 500,
        y: 300,
        width: 100,
        height: 50,
        elementId: 'button-1'
      },
      data: {
        button: 0
      }
    },
    {
      id: 'event_002',
      type: 'hover',
      timestamp: 1075,
      target: {
        x: 600,
        y: 400
      }
    }
  ];

  // Create temporal engine with custom configuration
  const engine = createTemporalEngine({
    changeDetector: {
      pixelThreshold: 30,
      minRegionSize: 100,
      useEdgeDetection: true,
      useColorAnalysis: true
    },
    eventCorrelator: {
      maxCorrelationDelay: 1000,
      spatialThreshold: 150,
      detectAnimations: true
    },
    temporalSlicer: {
      changeThreshold: 0.01,
      minSliceDuration: 40,
      maxSliceDuration: 2000,
      mergeAdjacentSlices: true,
      correlationThreshold: 0.6
    }
  });

  try {
    // Perform temporal analysis
    console.log('⏳ Analyzing temporal data...\n');
    const result = await engine.analyze(frames, events);

    // Display results
    console.log('📊 Analysis Results:\n');
    console.log(`Total Frames: ${result.statistics.totalFrames}`);
    console.log(`Total Events: ${result.statistics.totalEvents}`);
    console.log(`Temporal Slices: ${result.statistics.totalSlices}`);
    console.log(`Average Slice Duration: ${Math.round(result.statistics.averageSliceDuration)}ms`);
    console.log(`Most Common Change Type: ${result.statistics.mostCommonChangeType}`);
    console.log(`Causal Chains: ${result.causalChains.length}\n`);

    // Display detailed slice information
    console.log('📑 Temporal Slices:\n');
    for (const slice of result.slices) {
      console.log(`Slice ${slice.id}:`);
      console.log(`  • Time: ${slice.startTime}ms - ${slice.endTime}ms (${slice.endTime - slice.startTime}ms)`);
      console.log(`  • Frames: ${slice.frames.length}`);
      console.log(`  • Events: ${slice.events.map(e => `${e.type} at ${e.timestamp}ms`).join(', ') || 'none'}`);
      console.log(`  • Change Type: ${slice.changeType}`);
      console.log(`  • Changed Regions: ${slice.changedRegions.length}`);
      console.log(`  • Confidence: ${(slice.confidence * 100).toFixed(1)}%`);
      
      if (slice.changedRegions.length > 0) {
        console.log('  • Region Details:');
        slice.changedRegions.forEach((region, i) => {
          console.log(`    - Region ${i + 1}: ${region.bounds.width}x${region.bounds.height} at (${region.bounds.x},${region.bounds.y})`);
          console.log(`      Type: ${region.changeType}, Intensity: ${region.intensity.toFixed(3)}`);
        });
      }
      console.log('');
    }

    // Display causal chains
    if (result.causalChains.length > 0) {
      console.log('🔗 Causal Chains:\n');
      for (const chain of result.causalChains) {
        console.log(`Chain ${chain.id}:`);
        console.log(`  • Trigger: ${chain.trigger.type} at ${chain.trigger.timestamp}ms`);
        console.log(`  • Duration: ${chain.duration}ms`);
        console.log(`  • Confidence: ${(chain.confidence * 100).toFixed(1)}%`);
        console.log(`  • Timing Profile:`);
        console.log(`    - Initial Delay: ${chain.timing.initialDelay}ms`);
        console.log(`    - Settling Time: ${chain.timing.settlingTime}ms`);
        console.log(`    - Peak Time: ${chain.timing.peakTime}ms`);
        console.log(`    - Is Instantaneous: ${chain.timing.isInstantaneous}`);
        console.log(`    - Has Animation: ${chain.timing.hasAnimation}`);
        if (chain.timing.hasAnimation) {
          console.log(`    - Animation Duration: ${chain.timing.animationDuration}ms`);
          console.log(`    - Easing Function: ${chain.timing.easingFunction}`);
        }
        console.log('');
      }
    }

    // Save results to file
    const outputPath = join(__dirname, 'analysis-results.json');
    const outputData = {
      ...result,
      // Convert buffers to base64 for JSON serialization
      slices: result.slices.map(slice => ({
        ...slice,
        startFrame: { ...slice.startFrame, data: slice.startFrame.data.toString('base64') },
        endFrame: { ...slice.endFrame, data: slice.endFrame.data.toString('base64') },
        frames: slice.frames.map(f => ({ ...f, data: f.data.toString('base64') }))
      }))
    };
    
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);

    // Demonstrate individual component usage
    console.log('\n🔧 Component Demo:\n');

    // Change detection between two frames
    const changes = await engine.changeDetector.detectChanges(frames[0].data, frames[1].data);
    console.log('Change Detection (Frame 1 → 2):');
    console.log(`  • Change: ${changes.changePercentage.toFixed(2)}%`);
    console.log(`  • PSNR: ${changes.metrics.psnr.toFixed(2)} dB`);
    console.log(`  • SSIM: ${changes.metrics.ssim.toFixed(3)}\n`);

    // Event correlation
    if (changes.regions.length > 0) {
      const correlation = engine.eventCorrelator.correlate(changes, events[0]);
      console.log('Event Correlation:');
      console.log(`  • Event: ${correlation.event.type} at (${correlation.event.target.x}, ${correlation.event.target.y})`);
      console.log(`  • Correlation Type: ${correlation.correlationType}`);
      console.log(`  • Confidence: ${(correlation.confidence * 100).toFixed(1)}%`);
      console.log(`  • Delay: ${correlation.delay}ms`);
    }

    // Clean up
    engine.clearBuffers();
    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Run the example
if (require.main === module) {
  runBasicAnalysis().catch(console.error);
}

export { runBasicAnalysis };