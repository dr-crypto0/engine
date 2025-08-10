/**
 * ScrollOrchestrator - Intelligent scroll management for complete page capture
 * Implements various scrolling strategies to ensure every pixel is captured
 */

import { Page } from 'puppeteer';
import { ScrollStrategy, ScrollPattern, ScrollCheckpoint, ScrollOrchestratorConfig } from '../types';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export class ScrollOrchestrator extends EventEmitter {
  private page: Page | null = null;
  private isScrolling: boolean = false;
  private currentPosition: { x: number; y: number } = { x: 0, y: 0 };
  private documentDimensions: { width: number; height: number } = { width: 0, height: 0 };
  private viewportHeight: number = 0;
  private checkpoints: ScrollCheckpoint[] = [];
  private scrollInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
  }

  /**
   * Start the scroll orchestration
   */
  async start(page: Page, strategy: ScrollStrategy = 'intelligent'): Promise<void> {
    this.page = page;
    this.isScrolling = true;

    try {
      // Get document dimensions
      await this.updateDocumentDimensions();
      
      // Get viewport height
      const viewport = page.viewport();
      this.viewportHeight = viewport?.height || 1080;

      logger.info('ScrollOrchestrator started', {
        strategy,
        documentHeight: this.documentDimensions.height,
        viewportHeight: this.viewportHeight
      });

      // Execute scrolling based on strategy
      switch (strategy) {
        case 'exhaustive':
          await this.exhaustiveScroll();
          break;
        case 'intelligent':
          await this.intelligentScroll();
          break;
        case 'sampled':
          await this.sampledScroll();
          break;
        default:
          await this.intelligentScroll();
      }
    } catch (error) {
      logger.error('ScrollOrchestrator error', error);
      this.emit('error', error);
    }
  }

  /**
   * Stop scrolling
   */
  stop(): void {
    this.isScrolling = false;
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
    logger.info('ScrollOrchestrator stopped');
  }

  /**
   * Update document dimensions
   */
  private async updateDocumentDimensions(): Promise<void> {
    if (!this.page) return;

    const dimensions = await this.page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight
    }));

    this.documentDimensions = dimensions;
  }

  /**
   * Exhaustive scroll - captures every pixel
   */
  private async exhaustiveScroll(): Promise<void> {
    const scrollStep = Math.floor(this.viewportHeight * 0.8); // 80% overlap
    let currentY = 0;

    while (this.isScrolling && currentY < this.documentDimensions.height) {
      await this.scrollToPosition(0, currentY);
      await this.waitForStableContent();
      
      this.emit('scrollProgress', {
        current: currentY,
        total: this.documentDimensions.height,
        percentage: (currentY / this.documentDimensions.height) * 100
      });

      currentY += scrollStep;
    }

    // Ensure we capture the bottom
    if (currentY !== this.documentDimensions.height) {
      await this.scrollToPosition(0, this.documentDimensions.height - this.viewportHeight);
      await this.waitForStableContent();
    }
  }

  /**
   * Intelligent scroll - detects important content areas
   */
  private async intelligentScroll(): Promise<void> {
    // First, detect important content areas
    const contentAreas = await this.detectContentAreas();
    
    // Create checkpoints based on content
    this.checkpoints = this.createCheckpoints(contentAreas);

    // Scroll through checkpoints
    for (const checkpoint of this.checkpoints) {
      if (!this.isScrolling) break;

      await this.scrollToPosition(0, checkpoint.position);
      
      if (checkpoint.waitForStable) {
        await this.waitForStableContent(checkpoint.captureDelay);
      }

      this.emit('checkpointReached', checkpoint);
    }
  }

  /**
   * Sampled scroll - captures at regular intervals
   */
  private async sampledScroll(): Promise<void> {
    const sampleInterval = this.viewportHeight; // Sample every viewport height
    let currentY = 0;

    while (this.isScrolling && currentY < this.documentDimensions.height) {
      await this.scrollToPosition(0, currentY);
      await this.waitForStableContent(100); // Quick wait
      
      currentY += sampleInterval;
    }
  }

  /**
   * Detect important content areas on the page
   */
  private async detectContentAreas(): Promise<ContentArea[]> {
    if (!this.page) return [];

    const areas = await this.page.evaluate(() => {
      const contentAreas: any[] = [];
      
      // Find all major content sections
      const selectors = [
        'header', 'nav', 'main', 'section', 'article', 
        'footer', '.hero', '.banner', '[data-section]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const rect = element.getBoundingClientRect();
          const scrollY = window.scrollY;
          
          contentAreas.push({
            selector,
            top: rect.top + scrollY,
            bottom: rect.bottom + scrollY,
            height: rect.height,
            importance: this.calculateImportance(element)
          });
        });
      });

      // Detect lazy-loaded images
      const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
      images.forEach(img => {
        const rect = img.getBoundingClientRect();
        const scrollY = window.scrollY;
        
        contentAreas.push({
          selector: 'lazy-image',
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
          height: rect.height,
          importance: 0.8
        });
      });

      // Detect infinite scroll containers
      const infiniteScrollSelectors = [
        '[data-infinite-scroll]',
        '.infinite-scroll',
        '[data-pagination="infinite"]'
      ];

      infiniteScrollSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const scrollY = window.scrollY;
          
          contentAreas.push({
            selector: 'infinite-scroll',
            top: rect.top + scrollY,
            bottom: rect.bottom + scrollY,
            height: rect.height,
            importance: 1.0,
            requiresSpecialHandling: true
          });
        }
      });

      return contentAreas;
    });

    return areas;
  }

  /**
   * Calculate importance of an element (injected into page context)
   */
  private calculateImportance(element: Element): number {
    // This would be injected into the page evaluate context
    let importance = 0.5;
    
    if (element.tagName === 'HEADER') importance = 0.9;
    if (element.tagName === 'MAIN') importance = 1.0;
    if (element.classList.contains('hero')) importance = 0.95;
    if (element.querySelector('video, canvas')) importance = 1.0;
    
    return importance;
  }

  /**
   * Create scroll checkpoints based on content areas
   */
  private createCheckpoints(contentAreas: ContentArea[]): ScrollCheckpoint[] {
    const checkpoints: ScrollCheckpoint[] = [];
    
    // Always start at top
    checkpoints.push({
      position: 0,
      waitForStable: true,
      captureDelay: 500,
      description: 'Page top'
    });

    // Add checkpoints for important content
    contentAreas
      .filter(area => area.importance > 0.7)
      .sort((a, b) => a.top - b.top)
      .forEach(area => {
        checkpoints.push({
          position: Math.max(0, area.top - 100), // 100px before content
          waitForStable: area.requiresSpecialHandling || false,
          captureDelay: area.requiresSpecialHandling ? 2000 : 300,
          description: `Content area: ${area.selector}`
        });
      });

    // Add checkpoint at bottom
    checkpoints.push({
      position: Math.max(0, this.documentDimensions.height - this.viewportHeight),
      waitForStable: true,
      captureDelay: 500,
      description: 'Page bottom'
    });

    return checkpoints;
  }

  /**
   * Scroll to a specific position with smooth animation
   */
  private async scrollToPosition(x: number, y: number): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate((scrollX, scrollY) => {
      window.scrollTo({
        left: scrollX,
        top: scrollY,
        behavior: 'smooth'
      });
    }, x, y);

    this.currentPosition = { x, y };
    
    this.emit('scrollPositionChanged', this.currentPosition);
  }

  /**
   * Wait for content to stabilize after scrolling
   */
  private async waitForStableContent(additionalDelay: number = 300): Promise<void> {
    if (!this.page) return;

    // Wait for network idle
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Wait for animations to complete
    await this.page.evaluate(() => {
      return new Promise<void>(resolve => {
        if (document.getAnimations) {
          const animations = document.getAnimations();
          Promise.all(animations.map(animation => animation.finished))
            .then(() => resolve())
            .catch(() => resolve());
        } else {
          resolve();
        }
      });
    });

    // Additional delay for any remaining transitions
    await new Promise(resolve => setTimeout(resolve, additionalDelay));
  }

  /**
   * Handle infinite scroll
   */
  async handleInfiniteScroll(maxScrolls: number = 10): Promise<void> {
    if (!this.page) return;

    let scrollCount = 0;
    let previousHeight = this.documentDimensions.height;

    while (this.isScrolling && scrollCount < maxScrolls) {
      // Scroll to bottom
      await this.scrollToPosition(0, this.documentDimensions.height - this.viewportHeight);
      await this.waitForStableContent(2000); // Wait longer for content to load

      // Update dimensions
      await this.updateDocumentDimensions();

      // Check if new content was loaded
      if (this.documentDimensions.height === previousHeight) {
        logger.info('No new content loaded, stopping infinite scroll');
        break;
      }

      previousHeight = this.documentDimensions.height;
      scrollCount++;

      this.emit('infiniteScrollProgress', {
        scrollCount,
        currentHeight: this.documentDimensions.height
      });
    }
  }

  /**
   * Get current scroll position
   */
  getCurrentPosition(): { x: number; y: number } {
    return { ...this.currentPosition };
  }

  /**
   * Get scroll progress percentage
   */
  getProgress(): number {
    if (this.documentDimensions.height === 0) return 0;
    return (this.currentPosition.y / this.documentDimensions.height) * 100;
  }
}

interface ContentArea {
  selector: string;
  top: number;
  bottom: number;
  height: number;
  importance: number;
  requiresSpecialHandling?: boolean;
}