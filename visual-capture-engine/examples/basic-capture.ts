/**
 * Basic Visual Capture Example
 * Demonstrates high-performance website capture at 60-120fps
 */

import puppeteer from 'puppeteer';
import { VisualCaptureEngine } from '../src/core/VisualCaptureEngine';
import { CaptureConfig } from '../src/types';
import { logger } from '../src/utils/logger';

async function captureWebsite() {
  // Configuration for 120fps capture
  const config: CaptureConfig = {
    targetFps: 120,
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    },
    bufferSize: 2000, // Store up to 2000 frames
    enableScrollCapture: true,
    scrollStrategy: 'intelligent',
    enableWebGLCapture: true,
    captureMode: 'full'
  };

  logger.info('Starting visual capture example', config);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  try {
    // Create capture engine
    const engine = new VisualCaptureEngine(config);

    // Set up event listeners
    engine.on('captureStarted', ({ url, timestamp }) => {
      console.log(`✅ Capture started for ${url}`);
      console.log(`📅 Timestamp: ${new Date(timestamp).toISOString()}`);
    });

    engine.on('frameCaptured', ({ frameNumber, timestamp, fps }) => {
      if (frameNumber % 100 === 0) {
        console.log(`📸 Frame ${frameNumber} captured @ ${fps.toFixed(2)} FPS`);
      }
    });

    engine.on('scrollProgress', ({ current, total, percentage }) => {
      console.log(`📜 Scroll: ${percentage.toFixed(1)}% (${current}/${total}px)`);
    });

    engine.on('checkpointReached', (checkpoint) => {
      console.log(`🎯 Checkpoint: ${checkpoint.description}`);
    });

    engine.on('captureStopped', (metrics) => {
      console.log('\n📊 Capture Metrics:');
      console.log(`  Total Frames: ${metrics.totalFrames}`);
      console.log(`  Dropped Frames: ${metrics.droppedFrames}`);
      console.log(`  Average FPS: ${metrics.averageFps.toFixed(2)}`);
      console.log(`  Peak FPS: ${metrics.peakFps.toFixed(2)}`);
      console.log(`  Duration: ${((metrics.captureEndTime - metrics.captureStartTime) / 1000).toFixed(2)}s`);
    });

    // Initialize engine
    await engine.initialize(browser);

    // Enable WebGL capture for 3D content
    await engine.enableWebGLCapture();

    // Start capturing
    const targetUrl = 'https://www.apple.com'; // Example site with animations
    await engine.startCapture(targetUrl);

    // Capture for 20 seconds
    console.log('\n🎬 Capturing for 20 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Stop capture
    const metrics = await engine.stopCapture();

    // Get frame buffer for processing
    const frameBuffer = engine.getFrameBuffer();
    const bufferStats = frameBuffer.getStats();

    console.log('\n💾 Frame Buffer Stats:');
    console.log(`  Frames in buffer: ${bufferStats.size}`);
    console.log(`  Average frame size: ${(bufferStats.averageFrameSize / 1024).toFixed(2)} KB`);
    console.log(`  Memory usage: ${(frameBuffer.getMemoryUsage() / 1024 / 1024).toFixed(2)} MB`);

    // Example: Export last 10 frames
    const recentFrames = frameBuffer.getRecent(10);
    console.log(`\n📦 Exported ${recentFrames.length} recent frames`);

    // Example: Get frames from specific time range
    const startTime = metrics.captureStartTime + 5000; // 5 seconds after start
    const endTime = startTime + 2000; // 2 second window
    const timeRangeFrames = frameBuffer.getRange(startTime, endTime);
    console.log(`📦 Found ${timeRangeFrames.length} frames in 2-second window`);

    // Clean up
    await engine.cleanup();

  } catch (error) {
    logger.error('Capture failed', error);
  } finally {
    await browser.close();
  }
}

// Run the example
captureWebsite().catch(console.error);