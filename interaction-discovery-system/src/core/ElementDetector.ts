/**
 * Element Detector
 * Uses visual and behavioral analysis to detect interactive elements
 */

import { Page } from 'puppeteer';
import { InteractableElement, ElementType, ElementBounds, DiscoveryConfig } from '../types';
import { logger } from '../utils/logger';

export class ElementDetector {
  private config: DiscoveryConfig;
  
  // CSS selectors for common interactive elements
  private readonly interactiveSelectors = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[onclick]',
    '[ng-click]',
    '[data-click]',
    '[data-action]',
    '.btn',
    '.button',
    '.clickable',
    '[tabindex]:not([tabindex="-1"])'
  ];

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  /**
   * Detect all interactable elements on the page
   */
  async detect(page: Page): Promise<InteractableElement[]> {
    try {
      // Inject detection script into page
      const elements = await page.evaluate(
        this.detectElementsInPage,
        this.interactiveSelectors,
        this.config.detectHiddenElements || false
      );

      // Filter and enhance elements
      const enhanced = await this.enhanceElements(page, elements);
      
      // Sort by visual prominence
      const sorted = this.sortByImportance(enhanced);
      
      logger.debug(`Detected ${sorted.length} interactive elements`);
      
      return sorted;
    } catch (error) {
      logger.error('Element detection failed', error);
      return [];
    }
  }

  /**
   * Detection script that runs in the browser context
   */
  private detectElementsInPage = (
    selectors: string[],
    detectHidden: boolean
  ): any[] => {
    const elements: any[] = [];
    const processedElements = new Set<Element>();

    // Helper to check if element is visible
    const isVisible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        (detectHidden || (
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0
        ))
      );
    };

    // Helper to get element type
    const getElementType = (el: Element): string => {
      const tagName = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const type = el.getAttribute('type');

      if (tagName === 'button' || role === 'button') return 'button';
      if (tagName === 'a') return 'link';
      if (tagName === 'input') {
        switch (type) {
          case 'checkbox': return 'checkbox';
          case 'radio': return 'radio';
          case 'submit': return 'button';
          case 'button': return 'button';
          default: return 'input';
        }
      }
      if (tagName === 'select') return 'select';
      if (tagName === 'textarea') return 'textarea';
      if (tagName === 'canvas') return 'canvas';
      if (tagName === 'video') return 'video';
      
      return 'custom';
    };

    // Helper to generate unique selector
    const generateSelector = (el: Element): string => {
      if (el.id) {
        return `#${el.id}`;
      }
      
      let path = [];
      let current: Element | null = el;
      
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        
        if (current.className) {
          const classes = Array.from(current.classList)
            .filter(c => !c.includes(':'))
            .join('.');
          if (classes) {
            selector += `.${classes}`;
          }
        }
        
        const siblings = current.parentNode ? 
          Array.from(current.parentNode.children).filter(
            child => child.nodeName === current!.nodeName
          ) : [];
          
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
        
        path.unshift(selector);
        current = current.parentElement;
      }
      
      return path.join(' > ');
    };

    // Helper to calculate interaction confidence
    const calculateConfidence = (el: Element): number => {
      let confidence = 0.5;
      
      // Increase confidence for standard interactive elements
      const tagName = el.tagName.toLowerCase();
      if (['button', 'a', 'input', 'select'].includes(tagName)) {
        confidence += 0.3;
      }
      
      // Check for interaction attributes
      if (el.hasAttribute('onclick') || 
          el.hasAttribute('href') || 
          el.hasAttribute('role')) {
        confidence += 0.1;
      }
      
      // Check for cursor style
      const style = window.getComputedStyle(el);
      if (style.cursor === 'pointer') {
        confidence += 0.1;
      }
      
      return Math.min(confidence, 1.0);
    };

    // Process all selectors
    selectors.forEach(selector => {
      try {
        const matched = document.querySelectorAll(selector);
        matched.forEach(el => {
          if (!processedElements.has(el) && (detectHidden || isVisible(el))) {
            processedElements.add(el);
            
            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);
            
            elements.push({
              selector: generateSelector(el),
              type: getElementType(el),
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left
              },
              attributes: {
                id: el.id || '',
                class: el.className || '',
                href: el.getAttribute('href') || '',
                text: (el.textContent || '').trim().substring(0, 100),
                ariaLabel: el.getAttribute('aria-label') || '',
                role: el.getAttribute('role') || '',
                type: el.getAttribute('type') || '',
                name: el.getAttribute('name') || '',
                value: (el as HTMLInputElement).value || ''
              },
              computedStyles: {
                display: styles.display,
                visibility: styles.visibility,
                opacity: styles.opacity,
                cursor: styles.cursor,
                backgroundColor: styles.backgroundColor,
                color: styles.color,
                fontSize: styles.fontSize,
                zIndex: styles.zIndex
              },
              isVisible: isVisible(el),
              isEnabled: !(el as HTMLInputElement).disabled,
              confidence: calculateConfidence(el)
            });
          }
        });
      } catch (e) {
        console.error(`Failed to process selector ${selector}:`, e);
      }
    });

    // Also detect elements with event listeners (experimental)
    if (detectHidden) {
      // This would require more sophisticated detection
      // For now, we rely on the selectors above
    }

    return elements;
  };

  /**
   * Enhance elements with additional information
   */
  private async enhanceElements(
    page: Page, 
    elements: any[]
  ): Promise<InteractableElement[]> {
    const enhanced: InteractableElement[] = [];
    
    for (const el of elements) {
      try {
        // Generate unique ID
        const id = `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create enhanced element
        const element: InteractableElement = {
          id,
          selector: el.selector,
          type: el.type as ElementType,
          bounds: el.bounds,
          attributes: el.attributes,
          computedStyles: el.computedStyles,
          isVisible: el.isVisible,
          isEnabled: el.isEnabled,
          confidence: el.confidence
        };
        
        // Add visual signature if screenshots are enabled
        if (this.config.captureScreenshots && el.isVisible) {
          try {
            const elementHandle = await page.$(el.selector);
            if (elementHandle) {
              const screenshot = await elementHandle.screenshot({ encoding: 'base64' });
              element.visualSignature = screenshot as string;
            }
          } catch (e) {
            // Screenshot failed, continue without it
          }
        }
        
        enhanced.push(element);
      } catch (error) {
        logger.warn('Failed to enhance element', { selector: el.selector, error });
      }
    }
    
    return enhanced;
  }

  /**
   * Sort elements by importance/prominence
   */
  private sortByImportance(elements: InteractableElement[]): InteractableElement[] {
    return elements.sort((a, b) => {
      // First, sort by confidence
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Then by visibility
      if (a.isVisible !== b.isVisible) {
        return a.isVisible ? -1 : 1;
      }
      
      // Then by type priority
      const typePriority: Record<string, number> = {
        'button': 10,
        'link': 9,
        'input': 8,
        'select': 7,
        'checkbox': 6,
        'radio': 5,
        'textarea': 4,
        'custom': 1
      };
      
      const aPriority = typePriority[a.type] || 0;
      const bPriority = typePriority[b.type] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // Finally by position (top to bottom, left to right)
      if (a.bounds.top !== b.bounds.top) {
        return a.bounds.top - b.bounds.top;
      }
      
      return a.bounds.left - b.bounds.left;
    });
  }

  /**
   * Detect elements that might be revealed by interactions
   */
  async detectHiddenElements(page: Page): Promise<InteractableElement[]> {
    // This would implement more sophisticated detection for:
    // - Dropdown menus
    // - Modal triggers
    // - Hover-revealed elements
    // - Dynamically loaded content
    
    // For now, return empty array
    return [];
  }

  /**
   * Use AI/ML to detect non-standard interactive elements
   */
  async detectWithAI(page: Page): Promise<InteractableElement[]> {
    // This would use computer vision / ML models to detect:
    // - Custom interactive elements
    // - Canvas-based UI
    // - WebGL interfaces
    // - Non-standard patterns
    
    // Placeholder for future implementation
    return [];
  }
}