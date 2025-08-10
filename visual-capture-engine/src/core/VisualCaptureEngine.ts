/**
 * Visual Capture Engine
 * Core engine for high-performance website visual capture at 60-120fps
 */

import { Browser, Page } from 'puppeteer';
import CDP from 'chrome-remote-interface';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { CaptureConfig, Frame, CaptureMetrics } from '../types';
import { FrameBuffer } from './FrameBuffer';
import { ScrollOrchestrator } from './ScrollOrchestrator';
import { logger } from '../utils/logger';

export class VisualCaptureEngine extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cdpClient: CDP.Client | null = null;
  private frameBuffer: FrameBuffer;
  private scrollOrchestrator: ScrollOrchestrator;
  private captureInterval: NodeJS.Timer | null = null;
  private metrics: CaptureMetrics;
  private isCapturing: boolean = false;
  private frameCount: number = 0;
  private startTime: number = 0;

  constructor(private config: CaptureConfig) {
    super();
    this.frameBuffer = new FrameBuffer(config.bufferSize || 1000);
    this.scrollOrchestrator = new ScrollOrchestrator();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize capture metrics
   */
  private initializeMetrics(): CaptureMetrics {
    return {
      totalFrames: 0,
      droppedFrames: 0,
      averageFps: 0,
      peakFps: 0,
      captureStartTime: 0,
      captureEndTime: 0,
      memoryUsage: [],
      cpuUsage: []
    };
  }

  /**
   * Initialize the browser and CDP connection
   */
  async initialize(browser: Browser): Promise<void> {
    try {
      this.browser = browser;
      this.page = await browser.newPage();
      
      // Set viewport for consistent capture
      await this.page.setViewport({
        width: this.config.viewport.width,
        height: this.config.viewport.height,
        deviceScaleFactor: this.config.viewport.deviceScaleFactor || 1
      });

      // Connect to Chrome DevTools Protocol
      const target = await this.page.target();
      const wsEndpoint = target._targetInfo.webSocketDebuggerUrl;
      
      if (wsEndpoint) {
        this.cdpClient = await CDP({
          target: wsEndpoint
        });

        // Enable necessary CDP domains
        await this.cdpClient.Page.enable();
        await this.cdpClient.Runtime.enable();
        await this.cdpClient.DOM.enable();
        
        // Enable high-precision timestamps
        await this.cdpClient.Performance.enable();
        
        // Set up screenshot parameters for maximum quality
        await this.cdpClient.Page.setDefaultBackgroundColorOverride({
          color: { r: 255, g: 255, b: 255, a: 0 }
        });
      }

      logger.info('Visual Capture Engine initialized', {
        viewport: this.config.viewport,
        targetFps: this.config.targetFps
      });
    } catch (error) {
      logger.error('Failed to initialize Visual Capture Engine', error);
      throw error;
    }
  }

  /**
   * Start capturing frames at the specified FPS
   */
  async startCapture(url: string): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Capture already in progress');
    }

    try {
      this.isCapturing = true;
      this.frameCount = 0;
      this.startTime = performance.now();
      this.metrics.captureStartTime = Date.now();

      // Navigate to the target URL
      await this.page!.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Calculate frame interval based on target FPS
      const frameInterval = 1000 / this.config.targetFps;
      
      logger.info(`Starting capture at ${this.config.targetFps} FPS`, {
        url,
        frameInterval: `${frameInterval.toFixed(2)}ms`
      });

      // Start the high-precision capture loop
      this.captureLoop(frameInterval);

      // Start scroll orchestration if enabled
      if (this.config.enableScrollCapture) {
        this.scrollOrchestrator.start(this.page!, this.config.scrollStrategy);
      }

      this.emit('captureStarted', { url, timestamp: Date.now() });
    } catch (error) {
      this.isCapturing = false;
      logger.error('Failed to start capture', error);
      throw error;
    }
  }

  /**
   * High-precision capture loop using CDP
   */
  private async captureLoop(frameInterval: number): Promise<void> {
    let lastFrameTime = performance.now();
    let nextFrameTime = lastFrameTime + frameInterval;

    const captureFrame = async () => {
      if (!this.isCapturing) return;

      const currentTime = performance.now();
      
      // Check if we're behind schedule
      if (currentTime > nextFrameTime + frameInterval) {
        this.metrics.droppedFrames++;
        logger.warn('Frame dropped', {
          delay: currentTime - nextFrameTime,
          frameNumber: this.frameCount
        });
      }

      try {
        // Capture frame using CDP for maximum performance
        const frame = await this.captureFrameCDP();
        
        if (frame) {
          this.frameBuffer.add(frame);
          this.frameCount++;
          this.metrics.totalFrames++;
          
          // Calculate real-time FPS
          const elapsed = currentTime - lastFrameTime;
          const currentFps = 1000 / elapsed;
          
          if (currentFps > this.metrics.peakFps) {
            this.metrics.peakFps = currentFps;
          }

          this.emit('frameCaptured', {
            frameNumber: this.frameCount,
            timestamp: frame.timestamp,
            fps: currentFps
          });
        }

        lastFrameTime = currentTime;
        nextFrameTime += frameInterval;

        // Schedule next frame with high precision
        const delay = Math.max(0, nextFrameTime - performance.now());
        
        if (delay < 1) {
          // Use setImmediate for minimal delay
          setImmediate(captureFrame);
        } else {
          // Use setTimeout for precise timing
          setTimeout(captureFrame, delay);
        }
      } catch (error) {
        logger.error('Error capturing frame', error);
        this.metrics.droppedFrames++;
        
        // Continue capturing despite errors
        setTimeout(captureFrame, frameInterval);
      }
    };

    // Start the capture loop
    captureFrame();
  }

  /**
   * Capture a single frame using Chrome DevTools Protocol
   */
  private async captureFrameCDP(): Promise<Frame | null> {
    if (!this.cdpClient || !this.page) return null;

    try {
      const timestamp = Date.now();
      
      // Get current scroll position
      const scrollPosition = await this.page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY
      }));

      // Capture screenshot with CDP for maximum speed
      const { data } = await this.cdpClient.Page.captureScreenshot({
        format: 'png',
        quality: 100,
        captureBeyondViewport: false,
        fromSurface: true // Use GPU for faster capture
      });

      // Get page metrics
      const metrics = await this.cdpClient.Performance.getMetrics();
      
      // Create frame object
      const frame: Frame = {
        id: `frame_${this.frameCount}`,
        timestamp,
        data: Buffer.from(data, 'base64'),
        scrollPosition,
        viewport: {
          width: this.config.viewport.width,
          height: this.config.viewport.height
        },
        metrics: {
          renderTime: this.extractMetric(metrics, 'TaskDuration'),
          paintTime: this.extractMetric(metrics, 'PaintDuration'),
          scriptTime: this.extractMetric(metrics, 'ScriptDuration')
        }
      };

      return frame;
    } catch (error) {
      logger.error('Failed to capture frame via CDP', error);
      return null;
    }
  }

  /**
   * Extract specific metric from CDP metrics
   */
  private extractMetric(metrics: any, name: string): number {
    const metric = metrics.metrics.find((m: any) => m.name === name);
    return metric ? metric.value : 0;
  }

  /**
   * Stop the capture process
   */
  async stopCapture(): Promise<CaptureMetrics> {
    if (!this.isCapturing) {
      throw new Error('No capture in progress');
    }

    this.isCapturing = false;
    this.metrics.captureEndTime = Date.now();
    
    // Stop scroll orchestration
    this.scrollOrchestrator.stop();

    // Calculate final metrics
    const totalTime = (this.metrics.captureEndTime - this.metrics.captureStartTime) / 1000;
    this.metrics.averageFps = this.metrics.totalFrames / totalTime;

    logger.info('Capture stopped', {
      totalFrames: this.metrics.totalFrames,
      droppedFrames: this.metrics.droppedFrames,
      averageFps: this.metrics.averageFps.toFixed(2),
      peakFps: this.metrics.peakFps.toFixed(2),
      duration: `${totalTime.toFixed(2)}s`
    });

    this.emit('captureStopped', this.metrics);

    return this.metrics;
  }

  /**
   * Get the frame buffer for processing
   */
  getFrameBuffer(): FrameBuffer {
    return this.frameBuffer;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.isCapturing = false;
    
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }

    if (this.cdpClient) {
      await this.cdpClient.close();
    }

    if (this.page) {
      await this.page.close();
    }

    this.frameBuffer.clear();
    this.removeAllListeners();
    
    logger.info('Visual Capture Engine cleaned up');
  }

  /**
   * Enable WebGL/Canvas capture
   */
  async enableWebGLCapture(): Promise<void> {
    if (!this.cdpClient) return;

    try {
      // Enable WebGL command interception
      await this.cdpClient.send('Canvas.enable');
      
      // Set up WebGL context capture
      this.cdpClient.on('Canvas.contextCreated', async (params) => {
        logger.info('WebGL context detected', params);
        
        // Enable frame-by-frame WebGL capture
        await this.cdpClient.send('Canvas.startCapturing', {
          contextId: params.contextId,
          format: 'png'
        });
      });

      logger.info('WebGL capture enabled');
    } catch (error) {
      logger.error('Failed to enable WebGL capture', error);
    }
  }

  /**
   * Get current capture statistics
   */
  getStats(): any {
    const currentTime = performance.now();
    const elapsed = (currentTime - this.startTime) / 1000;
    const currentFps = this.frameCount / elapsed;

    return {
      framesCaptured: this.frameCount,
      framesDropped: this.metrics.droppedFrames,
      currentFps: currentFps.toFixed(2),
      averageFps: this.metrics.averageFps.toFixed(2),
      peakFps: this.metrics.peakFps.toFixed(2),
      bufferSize: this.frameBuffer.size(),
      isCapturing: this.isCapturing
    };
  }
}