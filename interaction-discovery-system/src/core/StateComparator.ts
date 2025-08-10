/**
 * State Comparator
 * Compares website states using visual and structural analysis
 */

import { WebsiteState, StateComparison, StateDifference } from '../types';
import { createHash } from 'crypto';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { Page } from 'puppeteer';
import { logger } from '../utils/logger';

export class StateComparator {
  private enableVisualDiff: boolean;
  private visualThreshold: number;
  private structuralThreshold: number;

  constructor(enableVisualDiff: boolean = true) {
    this.enableVisualDiff = enableVisualDiff;
    this.visualThreshold = 0.95; // 95% similarity threshold
    this.structuralThreshold = 0.90; // 90% similarity threshold
  }

  /**
   * Compare two website states
   */
  compare(state1: WebsiteState, state2: WebsiteState): StateComparison {
    const differences: StateDifference[] = [];
    
    // Quick check: if hashes match exactly, states are identical
    if (state1.visualHash === state2.visualHash && 
        state1.structuralHash === state2.structuralHash) {
      return {
        visualSimilarity: 1.0,
        structuralSimilarity: 1.0,
        isIdentical: true,
        differences: []
      };
    }

    // Calculate visual similarity
    let visualSimilarity = 0;
    if (this.enableVisualDiff && state1.screenshot && state2.screenshot) {
      visualSimilarity = this.calculateVisualSimilarity(
        state1.screenshot, 
        state2.screenshot
      );
      
      if (visualSimilarity < this.visualThreshold) {
        differences.push({
          type: 'visual',
          description: `Visual similarity ${(visualSimilarity * 100).toFixed(1)}% below threshold`,
          severity: visualSimilarity < 0.5 ? 'critical' : 'major'
        });
      }
    } else {
      // Fallback to hash comparison
      visualSimilarity = state1.visualHash === state2.visualHash ? 1.0 : 0.0;
    }

    // Calculate structural similarity
    const structuralSimilarity = this.calculateStructuralSimilarity(state1, state2);
    
    if (structuralSimilarity < this.structuralThreshold) {
      differences.push({
        type: 'structural',
        description: `Structural similarity ${(structuralSimilarity * 100).toFixed(1)}% below threshold`,
        severity: structuralSimilarity < 0.5 ? 'critical' : 'major'
      });
    }

    // Check URL changes
    if (state1.url !== state2.url) {
      differences.push({
        type: 'content',
        description: `URL changed from ${state1.url} to ${state2.url}`,
        severity: 'major'
      });
    }

    // Check title changes
    if (state1.title !== state2.title) {
      differences.push({
        type: 'content',
        description: `Title changed from "${state1.title}" to "${state2.title}"`,
        severity: 'minor'
      });
    }

    // Check interactive element changes
    const elementDiff = Math.abs(
      state1.interactableElements.length - state2.interactableElements.length
    );
    if (elementDiff > 0) {
      differences.push({
        type: 'interaction',
        description: `Interactive element count changed by ${elementDiff}`,
        severity: elementDiff > 5 ? 'major' : 'minor'
      });
    }

    // Determine if states are identical
    const isIdentical = visualSimilarity >= this.visualThreshold &&
                       structuralSimilarity >= this.structuralThreshold &&
                       differences.length === 0;

    return {
      visualSimilarity,
      structuralSimilarity,
      isIdentical,
      differences
    };
  }

  /**
   * Calculate visual similarity between two screenshots
   */
  private calculateVisualSimilarity(screenshot1: Buffer, screenshot2: Buffer): number {
    try {
      const img1 = PNG.sync.read(screenshot1);
      const img2 = PNG.sync.read(screenshot2);

      // Images must have same dimensions
      if (img1.width !== img2.width || img1.height !== img2.height) {
        return 0;
      }

      const diff = new PNG({ width: img1.width, height: img1.height });
      
      // Calculate pixel differences
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        img1.width,
        img1.height,
        { threshold: 0.1 } // 10% pixel difference threshold
      );

      const totalPixels = img1.width * img1.height;
      const similarity = 1 - (numDiffPixels / totalPixels);

      return similarity;
    } catch (error) {
      logger.error('Visual comparison failed', error);
      return 0;
    }
  }

  /**
   * Calculate structural similarity based on element composition
   */
  private calculateStructuralSimilarity(state1: WebsiteState, state2: WebsiteState): number {
    // Compare interactive elements
    const elements1 = new Set(
      state1.interactableElements.map(el => `${el.type}:${el.selector}`)
    );
    const elements2 = new Set(
      state2.interactableElements.map(el => `${el.type}:${el.selector}`)
    );

    // Calculate Jaccard similarity
    const intersection = new Set([...elements1].filter(x => elements2.has(x)));
    const union = new Set([...elements1, ...elements2]);

    if (union.size === 0) return 1.0; // Both empty

    const elementSimilarity = intersection.size / union.size;

    // Compare viewport (weight: 20%)
    const viewportSimilarity = 
      (state1.viewport.scrollX === state2.viewport.scrollX &&
       state1.viewport.scrollY === state2.viewport.scrollY) ? 1.0 : 0.8;

    // Compare storage (weight: 10%)
    const storageSimilarity = this.compareStorage(state1, state2);

    // Weighted average
    return (elementSimilarity * 0.7) + 
           (viewportSimilarity * 0.2) + 
           (storageSimilarity * 0.1);
  }

  /**
   * Compare storage between states
   */
  private compareStorage(state1: WebsiteState, state2: WebsiteState): number {
    const keys1 = new Set(Object.keys(state1.localStorage));
    const keys2 = new Set(Object.keys(state2.localStorage));

    if (keys1.size === 0 && keys2.size === 0) return 1.0;

    const commonKeys = new Set([...keys1].filter(k => keys2.has(k)));
    const allKeys = new Set([...keys1, ...keys2]);

    return commonKeys.size / allKeys.size;
  }

  /**
   * Compute visual hash from screenshot
   */
  async computeVisualHash(screenshot: Buffer): Promise<string> {
    try {
      // For now, use simple hash of the image data
      // In production, use perceptual hashing (pHash, dHash, etc.)
      return createHash('sha256').update(screenshot).digest('hex');
    } catch (error) {
      logger.error('Failed to compute visual hash', error);
      return '';
    }
  }

  /**
   * Compute structural hash from page
   */
  async computeStructuralHash(page: Page): Promise<string> {
    try {
      // Extract structural information
      const structure = await page.evaluate(() => {
        const extractStructure = (element: Element): any => {
          const children = Array.from(element.children)
            .filter(child => {
              const style = window.getComputedStyle(child);
              return style.display !== 'none' && style.visibility !== 'hidden';
            })
            .map(child => extractStructure(child));

          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || undefined,
            classes: Array.from(element.classList).sort(),
            children: children.length > 0 ? children : undefined
          };
        };

        return extractStructure(document.body);
      });

      // Create hash from structure
      const structureString = JSON.stringify(structure);
      return createHash('sha256').update(structureString).digest('hex');
    } catch (error) {
      logger.error('Failed to compute structural hash', error);
      return '';
    }
  }

  /**
   * Find visual differences between screenshots
   */
  async findVisualDifferences(
    screenshot1: Buffer, 
    screenshot2: Buffer
  ): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
    try {
      const img1 = PNG.sync.read(screenshot1);
      const img2 = PNG.sync.read(screenshot2);

      if (img1.width !== img2.width || img1.height !== img2.height) {
        return [];
      }

      const diff = new PNG({ width: img1.width, height: img1.height });
      
      pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        img1.width,
        img1.height,
        { threshold: 0.1, includeAA: true }
      );

      // Find bounding boxes of changed regions
      const regions = this.findChangedRegions(diff);
      
      return regions;
    } catch (error) {
      logger.error('Failed to find visual differences', error);
      return [];
    }
  }

  /**
   * Find bounding boxes of changed regions in diff image
   */
  private findChangedRegions(
    diff: PNG
  ): Array<{ x: number; y: number; width: number; height: number }> {
    const regions: Array<{ x: number; y: number; width: number; height: number }> = [];
    const width = diff.width;
    const height = diff.height;
    const visited = new Set<string>();

    // Simple flood fill to find connected regions
    const floodFill = (startX: number, startY: number): { minX: number; minY: number; maxX: number; maxY: number } => {
      const stack = [[startX, startY]];
      let minX = startX, maxX = startX;
      let minY = startY, maxY = startY;

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const key = `${x},${y}`;

        if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
          continue;
        }

        const idx = (width * y + x) << 2;
        const r = diff.data[idx];
        const g = diff.data[idx + 1];
        const b = diff.data[idx + 2];

        // Check if pixel is different (not black)
        if (r === 0 && g === 0 && b === 0) {
          continue;
        }

        visited.add(key);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        // Add neighbors
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      return { minX, minY, maxX, maxY };
    };

    // Scan for changed pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        const idx = (width * y + x) << 2;
        const r = diff.data[idx];
        const g = diff.data[idx + 1];
        const b = diff.data[idx + 2];

        if (r !== 0 || g !== 0 || b !== 0) {
          const bounds = floodFill(x, y);
          regions.push({
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.maxX - bounds.minX + 1,
            height: bounds.maxY - bounds.minY + 1
          });
        }
      }
    }

    // Merge overlapping regions
    return this.mergeRegions(regions);
  }

  /**
   * Merge overlapping regions
   */
  private mergeRegions(
    regions: Array<{ x: number; y: number; width: number; height: number }>
  ): Array<{ x: number; y: number; width: number; height: number }> {
    if (regions.length <= 1) return regions;

    const merged: Array<{ x: number; y: number; width: number; height: number }> = [];
    const used = new Set<number>();

    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;

      let current = { ...regions[i] };
      let changed = true;

      while (changed) {
        changed = false;
        for (let j = 0; j < regions.length; j++) {
          if (i === j || used.has(j)) continue;

          const other = regions[j];
          if (this.regionsOverlap(current, other)) {
            // Merge regions
            const minX = Math.min(current.x, other.x);
            const minY = Math.min(current.y, other.y);
            const maxX = Math.max(current.x + current.width, other.x + other.width);
            const maxY = Math.max(current.y + current.height, other.y + other.height);

            current = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY
            };

            used.add(j);
            changed = true;
          }
        }
      }

      merged.push(current);
    }

    return merged;
  }

  /**
   * Check if two regions overlap
   */
  private regionsOverlap(
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(r1.x + r1.width < r2.x || 
             r2.x + r2.width < r1.x || 
             r1.y + r1.height < r2.y || 
             r2.y + r2.height < r1.y);
  }
}