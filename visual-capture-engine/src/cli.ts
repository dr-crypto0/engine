#!/usr/bin/env node

/**
 * Visual Capture Engine CLI
 * Command-line interface for high-performance website capture
 */

import { Command } from 'commander';
import puppeteer from 'puppeteer';
import { VisualCaptureEngine } from './core/VisualCaptureEngine';
import { CaptureConfig } from './types';
import { logger, PerformanceLogger, CaptureLogger } from './utils/logger';
import path from 'path';
import fs from 'fs/promises';

const program = new Command();

program
  .name('visual-capture')
  .description('Revolutionary website visual capture engine')
  .version('1.0.0');

program
  .command('capture <url>')
  .description('Capture a website with high-fidelity visual recording')
  .option('-f, --fps <number>', 'Target frames per second (60, 120, 240)', '60')
  .option('-w, --width <number>', 'Viewport width', '1920')
  .option('-h, --height <number>', 'Viewport height', '1080')
  .option('-s, --scroll <strategy>', 'Scroll strategy (exhaustive, intelligent, sampled)', 'intelligent')
  .option('-o, --output <path>', 'Output directory', './captures')
  .option('--webgl', 'Enable WebGL capture', false)
  .option('--depth', 'Enable depth buffer capture', false)
  .option('--headless', 'Run in headless mode', true)
  .action(async (url, options) => {
    try {
      logger.info('Starting visual capture', { url, options });
      
      // Create output directory
      const outputDir = path.resolve(options.output);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Configure capture settings
      const config: CaptureConfig = {
        targetFps: parseInt(options.fps),
        viewport: {
          width: parseInt(options.width),
          height: parseInt(options.height),
          deviceScaleFactor: 1
        },
        enableScrollCapture: true,
        scrollStrategy: options.scroll,
        enableWebGLCapture: options.webgl,
        enableDepthCapture: options.depth,
        captureMode: 'full'
      };
      
      // Validate FPS
      if (![60, 120, 240].includes(config.targetFps)) {
        logger.error('Invalid FPS. Must be 60, 120, or 240');
        process.exit(1);
      }
      
      // Launch browser
      logger.info('Launching browser...');
      const browser = await puppeteer.launch({
        headless: options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          `--window-size=${config.viewport.width},${config.viewport.height}`
        ]
      });
      
      // Create capture engine
      const engine = new VisualCaptureEngine(config);
      
      // Set up event listeners
      engine.on('captureStarted', ({ url, timestamp }) => {
        logger.info(`Capture started for ${url} at ${new Date(timestamp).toISOString()}`);
        CaptureLogger.startCapture();
      });
      
      engine.on('frameCaptured', ({ frameNumber, timestamp, fps }) => {
        CaptureLogger.logFrame(frameNumber, { fps: fps.toFixed(2) });
      });
      
      engine.on('scrollProgress', ({ current, total, percentage }) => {
        logger.info(`Scroll progress: ${percentage.toFixed(1)}% (${current}/${total}px)`);
      });
      
      engine.on('captureStopped', (metrics) => {
        CaptureLogger.endCapture(metrics);
      });
      
      engine.on('error', (error) => {
        logger.error('Capture error', error);
      });
      
      // Initialize engine
      await engine.initialize(browser);
      
      // Enable WebGL capture if requested
      if (config.enableWebGLCapture) {
        await engine.enableWebGLCapture();
      }
      
      // Start capture
      PerformanceLogger.start('capture');
      await engine.startCapture(url);
      
      // Capture for specified duration or until user interrupts
      const captureDuration = 30000; // 30 seconds default
      logger.info(`Capturing for ${captureDuration / 1000} seconds...`);
      
      // Set up graceful shutdown
      let isShuttingDown = false;
      const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        
        logger.info('Shutting down capture...');
        
        try {
          const metrics = await engine.stopCapture();
          const captureTime = PerformanceLogger.end('capture');
          
          // Save capture metadata
          const metadataPath = path.join(outputDir, 'capture-metadata.json');
          await fs.writeFile(metadataPath, JSON.stringify({
            url,
            config,
            metrics,
            captureTime,
            timestamp: new Date().toISOString()
          }, null, 2));
          
          logger.info(`Metadata saved to ${metadataPath}`);
          
          // Export frames (in a real implementation, this would save to disk)
          const frameBuffer = engine.getFrameBuffer();
          const stats = frameBuffer.getStats();
          
          logger.info('Capture complete', {
            totalFrames: stats.size,
            droppedFrames: metrics.droppedFrames,
            averageFps: metrics.averageFps.toFixed(2),
            peakFps: metrics.peakFps.toFixed(2)
          });
          
          // Clean up
          await engine.cleanup();
          await browser.close();
          
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error);
          process.exit(1);
        }
      };
      
      // Handle interrupts
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      
      // Auto-stop after duration
      setTimeout(shutdown, captureDuration);
      
    } catch (error) {
      logger.error('Fatal error', error);
      process.exit(1);
    }
  });

program
  .command('analyze <capture-dir>')
  .description('Analyze a captured website')
  .action(async (captureDir) => {
    try {
      const metadataPath = path.join(captureDir, 'capture-metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      
      logger.info('Capture Analysis', {
        url: metadata.url,
        captureTime: new Date(metadata.timestamp).toLocaleString(),
        totalFrames: metadata.metrics.totalFrames,
        droppedFrames: metadata.metrics.droppedFrames,
        averageFps: metadata.metrics.averageFps.toFixed(2),
        duration: `${(metadata.captureTime / 1000).toFixed(2)}s`
      });
      
    } catch (error) {
      logger.error('Failed to analyze capture', error);
      process.exit(1);
    }
  });

program
  .command('benchmark')
  .description('Run performance benchmark')
  .option('-f, --fps <number>', 'Target FPS to test', '120')
  .action(async (options) => {
    logger.info('Running performance benchmark...');
    
    const testUrl = 'https://www.example.com';
    const targetFps = parseInt(options.fps);
    
    // Run capture for 10 seconds
    const config: CaptureConfig = {
      targetFps,
      viewport: { width: 1920, height: 1080 },
      enableScrollCapture: false,
      captureMode: 'full'
    };
    
    const browser = await puppeteer.launch({ headless: true });
    const engine = new VisualCaptureEngine(config);
    
    await engine.initialize(browser);
    await engine.startCapture(testUrl);
    
    // Capture for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const metrics = await engine.stopCapture();
    
    logger.info('Benchmark Results', {
      targetFps,
      achievedFps: metrics.averageFps.toFixed(2),
      peakFps: metrics.peakFps.toFixed(2),
      droppedFrames: metrics.droppedFrames,
      efficiency: `${((metrics.averageFps / targetFps) * 100).toFixed(1)}%`
    });
    
    await engine.cleanup();
    await browser.close();
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}