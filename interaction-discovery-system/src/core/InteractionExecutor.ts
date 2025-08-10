/**
 * Interaction Executor
 * Executes interactions on web elements and captures results
 */

import { Page } from 'puppeteer';
import { 
  InteractableElement, 
  Interaction, 
  InteractionType,
  InteractionMetadata,
  DiscoveryConfig 
} from '../types';
import { logger } from '../utils/logger';

export class InteractionExecutor {
  private config: DiscoveryConfig;
  
  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  /**
   * Execute an interaction on an element
   */
  async execute(
    page: Page,
    element: InteractableElement,
    type: InteractionType,
    metadata?: InteractionMetadata
  ): Promise<Interaction> {
    const startTime = Date.now();
    const interaction: Interaction = {
      id: `interaction_${startTime}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      elementId: element.id,
      elementSelector: element.selector,
      timestamp: startTime,
      duration: 0,
      successful: false,
      metadata
    };

    try {
      // Add realistic delays if simulating user behavior
      if (this.config.simulateUserBehavior) {
        await this.simulateHumanDelay();
      }

      // Execute based on interaction type
      switch (type) {
        case 'click':
          await this.executeClick(page, element);
          break;
          
        case 'hover':
          await this.executeHover(page, element);
          break;
          
        case 'type':
          await this.executeType(page, element, metadata?.text || 'test input');
          break;
          
        case 'select':
          await this.executeSelect(page, element, metadata?.text || '');
          break;
          
        case 'scroll':
          await this.executeScroll(page, metadata?.scrollPosition);
          break;
          
        case 'double-click':
          await this.executeDoubleClick(page, element);
          break;
          
        case 'right-click':
          await this.executeRightClick(page, element);
          break;
          
        case 'focus':
          await this.executeFocus(page, element);
          break;
          
        case 'blur':
          await this.executeBlur(page, element);
          break;
          
        case 'key-press':
          await this.executeKeyPress(page, metadata?.key || 'Enter');
          break;
          
        case 'drag':
          await this.executeDrag(page, element, metadata?.dragPath);
          break;
          
        case 'wait':
          await this.executeWait(metadata?.text ? parseInt(metadata.text) : 1000);
          break;
          
        default:
          throw new Error(`Unsupported interaction type: ${type}`);
      }

      interaction.successful = true;
      interaction.duration = Date.now() - startTime;
      
      logger.debug('Interaction executed successfully', {
        type,
        element: element.selector,
        duration: interaction.duration
      });

    } catch (error) {
      interaction.successful = false;
      interaction.duration = Date.now() - startTime;
      interaction.error = error.message;
      
      logger.warn('Interaction failed', {
        type,
        element: element.selector,
        error: error.message
      });
    }

    return interaction;
  }

  /**
   * Execute a click interaction
   */
  private async executeClick(page: Page, element: InteractableElement): Promise<void> {
    const elementHandle = await page.$(element.selector);
    if (!elementHandle) {
      throw new Error(`Element not found: ${element.selector}`);
    }

    // Scroll element into view if needed
    await elementHandle.scrollIntoViewIfNeeded();
    
    // Click at the center of the element
    await elementHandle.click({
      delay: this.config.simulateUserBehavior ? this.randomDelay(50, 150) : undefined
    });
  }

  /**
   * Execute a hover interaction
   */
  private async executeHover(page: Page, element: InteractableElement): Promise<void> {
    const elementHandle = await page.$(element.selector);
    if (!elementHandle) {
      throw new Error(`Element not found: ${element.selector}`);
    }

    await elementHandle.hover();
    
    // Hold hover for a moment
    if (this.config.simulateUserBehavior) {
      await page.waitForTimeout(this.randomDelay(500, 1000));
    }
  }

  /**
   * Execute a type interaction
   */
  private async executeType(page: Page, element: InteractableElement, text: string): Promise<void> {
    const elementHandle = await page.$(element.selector);
    if (!elementHandle) {
      throw new Error(`Element not found: ${element.selector}`);
    }

    // Clear existing content
    await elementHandle.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    
    // Type new content
    await elementHandle.type(text, {
      delay: this.config.simulateUserBehavior ? this.randomDelay(50, 150) : undefined
    });
  }

  /**
   * Execute a select interaction
   */
  private async executeSelect(page: Page, element: InteractableElement, value: string): Promise<void> {
    const elementHandle = await page.$(element.selector);
    if (!elementHandle) {
      throw new Error(`Element not found: ${element.selector}`);
    }

    // Try to select by value or by index
    try {
      await page.select(element.selector, value);
    } catch {
      // If value selection fails, try selecting first option
      const options = await page.$$eval(
        `${element.selector} option`,
        opts => opts.map(opt => opt.value)
      );
      
      if (options.length > 1) {
        await page.select(element.selector, options[1]); // Skip first (usually placeholder)
      }
    }
  }

  /**
   * Execute a scroll interaction
   */
  private async executeScroll(page: Page, position?: { x: number; y: number }): Promise<void> {
    if (position) {
      await page.evaluate((x, y) => {
        window.scrollTo(x, y);
      }, position.x, position.y);
    } else {
      // Scroll down by viewport height
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
    }
    
    // Wait for scroll to complete
    await page.waitForTimeout(300);
  }

  /**
   * Execute a double-click interaction
   */
  private async executeDoubleClick(page: Page, element: InteractableElement): Promise<void> {
    const elementHandle = await page.$(element.selector);
    if (!elementHandle) {
      throw new Error(`Element not found: ${element.selector}`);
    }

    await elementHandle.scrollIntoViewIfNeeded();
    await elementHandle.click({ clickCount: 2 });
  }

  /**
   * Execute a right-click interaction
   */
  private async executeRightClick(page: Page, element: InteractableElement): Promise<void> {
    const elementHandle = await page.$(element.selector);
    if (!elementHandle) {
      throw new Error(`Element not found: ${element.selector}`);
    }

    await elementHandle.scrollIntoViewIfNeeded();
    await elementHandle.click({ button: 'right' });
  }

  /**
   * Execute a focus interaction
   */
  private async executeFocus(page: Page, element: InteractableElement): Promise<void> {
    await page.focus(element.selector);
  }

  /**
   * Execute a blur interaction
   */
  private async executeBlur(page: Page, element: InteractableElement): Promise<void> {
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el && el instanceof HTMLElement) {
        el.blur();
      }
    }, element.selector);
  }

  /**
   * Execute a key press
   */
  private async executeKeyPress(page: Page, key: string): Promise<void> {
    await page.keyboard.press(key);
  }

  /**
   * Execute a drag interaction
   */
  private async executeDrag(
    page: Page, 
    element: InteractableElement, 
    path?: Array<{ x: number; y: number }>
  ): Promise<void> {
    const elementHandle = await page.$(element.selector);
    if (!elementHandle) {
      throw new Error(`Element not found: ${element.selector}`);
    }

    const box = await elementHandle.boundingBox();
    if (!box) {
      throw new Error('Could not get element bounds');
    }

    // Start drag from center of element
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    
    if (path && path.length > 0) {
      // Follow specified path
      for (const point of path) {
        await page.mouse.move(point.x, point.y, { steps: 10 });
        if (this.config.simulateUserBehavior) {
          await page.waitForTimeout(this.randomDelay(50, 100));
        }
      }
    } else {
      // Default: drag 100px to the right
      await page.mouse.move(startX + 100, startY, { steps: 10 });
    }
    
    await page.mouse.up();
  }

  /**
   * Execute a wait
   */
  private async executeWait(duration: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Simulate human-like delay
   */
  private async simulateHumanDelay(): Promise<void> {
    const delay = this.randomDelay(100, 500);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate random delay between min and max
   */
  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Check if element is still interactable
   */
  async isInteractable(page: Page, element: InteractableElement): Promise<boolean> {
    try {
      const elementHandle = await page.$(element.selector);
      if (!elementHandle) return false;

      const isVisible = await elementHandle.isIntersectingViewport();
      const isEnabled = await page.evaluate(
        (selector) => {
          const el = document.querySelector(selector);
          return el && !(el as any).disabled;
        },
        element.selector
      );

      return isVisible && isEnabled;
    } catch {
      return false;
    }
  }
}