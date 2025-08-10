/**
 * HierarchyBuilder - Constructs element hierarchy from spatial relationships
 * 
 * This class analyzes the spatial relationships between detected elements
 * to build a hierarchical structure that represents the visual layout.
 */

import {
  DetectedElement,
  ElementHierarchy,
  BoundingBox,
  SiblingGroup,
  LayoutGrid,
  GridCell
} from '../types';
import { createModuleLogger, logPerformance } from '../utils/logger';

const logger = createModuleLogger('HierarchyBuilder');

export class HierarchyBuilder {
  // Thresholds for spatial analysis
  private readonly CONTAINMENT_THRESHOLD = 0.9; // 90% overlap for containment
  private readonly ALIGNMENT_THRESHOLD = 5; // pixels for alignment detection
  private readonly SIBLING_SPACING_THRESHOLD = 50; // max pixels between siblings
  private readonly GRID_DETECTION_THRESHOLD = 0.8; // confidence for grid detection

  constructor() {
    logger.info('HierarchyBuilder initialized');
  }

  /**
   * Build hierarchy from detected elements
   */
  async buildHierarchy(elements: DetectedElement[]): Promise<ElementHierarchy> {
    const startTime = Date.now();
    logger.info(`Building hierarchy for ${elements.length} elements`);

    try {
      // Step 1: Calculate containment relationships
      const parentChildMap = this.buildParentChildMap(elements);
      
      // Step 2: Assign depth levels
      this.assignDepthLevels(elements, parentChildMap);
      
      // Step 3: Group elements by depth
      const levels = this.groupByDepth(elements);
      
      // Step 4: Identify sibling groups
      const siblingGroups = this.identifySiblingGroups(elements, parentChildMap);
      
      // Step 5: Calculate max depth
      const maxDepth = Math.max(...elements.map(el => el.depth));

      const hierarchy: ElementHierarchy = {
        levels,
        maxDepth,
        parentChildMap,
        siblingGroups
      };

      logPerformance('Hierarchy building', startTime);
      logger.info(`Hierarchy built with ${maxDepth + 1} levels and ${siblingGroups.length} sibling groups`);

      return hierarchy;

    } catch (error) {
      logger.error('Failed to build hierarchy', { error });
      throw error;
    }
  }

  /**
   * Detect grid layout in elements
   */
  async detectLayoutGrid(elements: DetectedElement[]): Promise<LayoutGrid | undefined> {
    const startTime = Date.now();
    logger.info('Detecting layout grid...');

    try {
      // Find potential grid containers
      const containers = elements.filter(el => 
        el.type === 'container' && this.hasMultipleChildren(el, elements)
      );

      for (const container of containers) {
        const children = this.getDirectChildren(container, elements);
        const grid = this.analyzeGridLayout(children);
        
        if (grid && grid.confidence > this.GRID_DETECTION_THRESHOLD) {
          logPerformance('Grid detection', startTime);
          logger.info(`Grid detected: ${grid.columns}x${grid.rows}`);
          return grid;
        }
      }

      logger.info('No grid layout detected');
      return undefined;

    } catch (error) {
      logger.error('Grid detection failed', { error });
      return undefined;
    }
  }

  /**
   * Build parent-child relationships map
   */
  private buildParentChildMap(elements: DetectedElement[]): Map<string, string[]> {
    const parentChildMap = new Map<string, string[]>();
    
    // Sort by area (larger first) to process containers before their children
    const sortedElements = [...elements].sort((a, b) => {
      const areaA = a.boundingBox.width * a.boundingBox.height;
      const areaB = b.boundingBox.width * b.boundingBox.height;
      return areaB - areaA;
    });

    // For each element, find its immediate parent
    for (let i = 0; i < sortedElements.length; i++) {
      const child = sortedElements[i];
      let bestParent: DetectedElement | null = null;
      let smallestArea = Infinity;

      // Find the smallest container that contains this element
      for (let j = 0; j < i; j++) {
        const parent = sortedElements[j];
        
        if (this.contains(parent.boundingBox, child.boundingBox)) {
          const area = parent.boundingBox.width * parent.boundingBox.height;
          
          if (area < smallestArea) {
            smallestArea = area;
            bestParent = parent;
          }
        }
      }

      // Update parent-child relationships
      if (bestParent) {
        child.parent = bestParent.id;
        
        if (!parentChildMap.has(bestParent.id)) {
          parentChildMap.set(bestParent.id, []);
        }
        parentChildMap.get(bestParent.id)!.push(child.id);
        
        // Update children array
        if (!bestParent.children) {
          bestParent.children = [];
        }
        bestParent.children.push(child);
      }
    }

    return parentChildMap;
  }

  /**
   * Assign depth levels to elements
   */
  private assignDepthLevels(
    elements: DetectedElement[], 
    parentChildMap: Map<string, string[]>
  ): void {
    // Find root elements (no parent)
    const roots = elements.filter(el => !el.parent);
    
    // BFS to assign depths
    const queue: Array<{ element: DetectedElement; depth: number }> = 
      roots.map(el => ({ element: el, depth: 0 }));
    
    while (queue.length > 0) {
      const { element, depth } = queue.shift()!;
      element.depth = depth;
      
      // Add children to queue
      const childIds = parentChildMap.get(element.id) || [];
      for (const childId of childIds) {
        const child = elements.find(el => el.id === childId);
        if (child) {
          queue.push({ element: child, depth: depth + 1 });
        }
      }
    }
  }

  /**
   * Group elements by depth level
   */
  private groupByDepth(elements: DetectedElement[]): Map<number, DetectedElement[]> {
    const levels = new Map<number, DetectedElement[]>();
    
    for (const element of elements) {
      if (!levels.has(element.depth)) {
        levels.set(element.depth, []);
      }
      levels.get(element.depth)!.push(element);
    }
    
    return levels;
  }

  /**
   * Identify sibling groups
   */
  private identifySiblingGroups(
    elements: DetectedElement[],
    parentChildMap: Map<string, string[]>
  ): SiblingGroup[] {
    const siblingGroups: SiblingGroup[] = [];
    
    // Process each parent's children
    for (const [parentId, childIds] of parentChildMap) {
      if (childIds.length < 2) continue;
      
      const children = childIds
        .map(id => elements.find(el => el.id === id))
        .filter(el => el !== undefined) as DetectedElement[];
      
      // Analyze layout pattern
      const groups = this.groupSiblings(children);
      
      for (const group of groups) {
        if (group.elements.length >= 2) {
          siblingGroups.push({
            parentId,
            elements: group.elements,
            layout: group.layout,
            spacing: group.spacing,
            alignment: group.alignment
          });
        }
      }
    }
    
    return siblingGroups;
  }

  /**
   * Group siblings by layout pattern
   */
  private groupSiblings(elements: DetectedElement[]): SiblingGroup[] {
    const groups: SiblingGroup[] = [];
    
    // Try horizontal grouping
    const horizontalGroups = this.groupHorizontally(elements);
    groups.push(...horizontalGroups);
    
    // Try vertical grouping
    const verticalGroups = this.groupVertically(elements);
    groups.push(...verticalGroups);
    
    // Try grid grouping
    const gridGroup = this.groupAsGrid(elements);
    if (gridGroup) {
      groups.push(gridGroup);
    }
    
    // Return the best grouping (most elements grouped)
    return groups.sort((a, b) => b.elements.length - a.elements.length);
  }

  /**
   * Group elements horizontally
   */
  private groupHorizontally(elements: DetectedElement[]): SiblingGroup[] {
    const groups: SiblingGroup[] = [];
    const used = new Set<string>();
    
    // Sort by x position
    const sorted = [...elements].sort((a, b) => a.boundingBox.x - b.boundingBox.x);
    
    for (const element of sorted) {
      if (used.has(element.id)) continue;
      
      const group: DetectedElement[] = [element];
      used.add(element.id);
      
      // Find aligned elements to the right
      for (const other of sorted) {
        if (used.has(other.id)) continue;
        
        if (this.areHorizontallyAligned(element, other) &&
            this.getHorizontalSpacing(group[group.length - 1], other) < this.SIBLING_SPACING_THRESHOLD) {
          group.push(other);
          used.add(other.id);
        }
      }
      
      if (group.length >= 2) {
        groups.push({
          parentId: element.parent || '',
          elements: group,
          layout: 'horizontal',
          spacing: this.calculateAverageSpacing(group, 'horizontal'),
          alignment: this.detectAlignment(group)
        });
      }
    }
    
    return groups;
  }

  /**
   * Group elements vertically
   */
  private groupVertically(elements: DetectedElement[]): SiblingGroup[] {
    const groups: SiblingGroup[] = [];
    const used = new Set<string>();
    
    // Sort by y position
    const sorted = [...elements].sort((a, b) => a.boundingBox.y - b.boundingBox.y);
    
    for (const element of sorted) {
      if (used.has(element.id)) continue;
      
      const group: DetectedElement[] = [element];
      used.add(element.id);
      
      // Find aligned elements below
      for (const other of sorted) {
        if (used.has(other.id)) continue;
        
        if (this.areVerticallyAligned(element, other) &&
            this.getVerticalSpacing(group[group.length - 1], other) < this.SIBLING_SPACING_THRESHOLD) {
          group.push(other);
          used.add(other.id);
        }
      }
      
      if (group.length >= 2) {
        groups.push({
          parentId: element.parent || '',
          elements: group,
          layout: 'vertical',
          spacing: this.calculateAverageSpacing(group, 'vertical'),
          alignment: this.detectAlignment(group)
        });
      }
    }
    
    return groups;
  }

  /**
   * Try to group elements as a grid
   */
  private groupAsGrid(elements: DetectedElement[]): SiblingGroup | null {
    if (elements.length < 4) return null;
    
    const grid = this.analyzeGridLayout(elements);
    if (!grid || grid.confidence < this.GRID_DETECTION_THRESHOLD) return null;
    
    return {
      parentId: elements[0].parent || '',
      elements,
      layout: 'grid',
      spacing: Math.min(grid.gutterWidth, grid.gutterHeight),
      alignment: 'grid'
    };
  }

  /**
   * Analyze if elements form a grid
   */
  private analyzeGridLayout(elements: DetectedElement[]): LayoutGrid & { confidence: number } | null {
    // Sort by position
    const sorted = [...elements].sort((a, b) => {
      const yDiff = a.boundingBox.y - b.boundingBox.y;
      if (Math.abs(yDiff) > this.ALIGNMENT_THRESHOLD) return yDiff;
      return a.boundingBox.x - b.boundingBox.x;
    });
    
    // Detect rows
    const rows: DetectedElement[][] = [];
    let currentRow: DetectedElement[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (this.areHorizontallyAligned(currentRow[0], sorted[i])) {
        currentRow.push(sorted[i]);
      } else {
        rows.push(currentRow);
        currentRow = [sorted[i]];
      }
    }
    rows.push(currentRow);
    
    // Check if all rows have same number of columns
    const columnCounts = rows.map(row => row.length);
    const columns = columnCounts[0];
    
    if (!columnCounts.every(count => count === columns)) {
      return null;
    }
    
    // Calculate gutters
    const gutterWidths: number[] = [];
    const gutterHeights: number[] = [];
    
    // Horizontal gutters
    for (const row of rows) {
      for (let i = 1; i < row.length; i++) {
        gutterWidths.push(this.getHorizontalSpacing(row[i - 1], row[i]));
      }
    }
    
    // Vertical gutters
    for (let i = 1; i < rows.length; i++) {
      gutterHeights.push(this.getVerticalSpacing(rows[i - 1][0], rows[i][0]));
    }
    
    // Check consistency
    const avgGutterWidth = gutterWidths.reduce((a, b) => a + b, 0) / gutterWidths.length;
    const avgGutterHeight = gutterHeights.reduce((a, b) => a + b, 0) / gutterHeights.length;
    
    const widthVariance = this.calculateVariance(gutterWidths);
    const heightVariance = this.calculateVariance(gutterHeights);
    
    // Low variance indicates consistent grid
    const confidence = 1 - (widthVariance + heightVariance) / 2;
    
    // Build grid cells
    const cells: GridCell[] = [];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < columns; c++) {
        cells.push({
          row: r,
          column: c,
          rowSpan: 1,
          columnSpan: 1,
          elementId: rows[r][c]?.id
        });
      }
    }
    
    return {
      columns,
      rows: rows.length,
      gutterWidth: avgGutterWidth,
      gutterHeight: avgGutterHeight,
      cells,
      confidence
    };
  }

  /**
   * Check if one box contains another
   */
  private contains(parent: BoundingBox, child: BoundingBox): boolean {
    const overlap = this.calculateOverlap(parent, child);
    const childArea = child.width * child.height;
    return overlap / childArea >= this.CONTAINMENT_THRESHOLD;
  }

  /**
   * Calculate overlap area between two boxes
   */
  private calculateOverlap(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 < x1 || y2 < y1) return 0;
    
    return (x2 - x1) * (y2 - y1);
  }

  /**
   * Check if elements are horizontally aligned
   */
  private areHorizontallyAligned(el1: DetectedElement, el2: DetectedElement): boolean {
    const y1 = el1.boundingBox.center.y;
    const y2 = el2.boundingBox.center.y;
    return Math.abs(y1 - y2) < this.ALIGNMENT_THRESHOLD;
  }

  /**
   * Check if elements are vertically aligned
   */
  private areVerticallyAligned(el1: DetectedElement, el2: DetectedElement): boolean {
    const x1 = el1.boundingBox.center.x;
    const x2 = el2.boundingBox.center.x;
    return Math.abs(x1 - x2) < this.ALIGNMENT_THRESHOLD;
  }

  /**
   * Get horizontal spacing between elements
   */
  private getHorizontalSpacing(el1: DetectedElement, el2: DetectedElement): number {
    const box1 = el1.boundingBox;
    const box2 = el2.boundingBox;
    return Math.max(0, box2.x - (box1.x + box1.width));
  }

  /**
   * Get vertical spacing between elements
   */
  private getVerticalSpacing(el1: DetectedElement, el2: DetectedElement): number {
    const box1 = el1.boundingBox;
    const box2 = el2.boundingBox;
    return Math.max(0, box2.y - (box1.y + box1.height));
  }

  /**
   * Calculate average spacing in a group
   */
  private calculateAverageSpacing(
    elements: DetectedElement[], 
    direction: 'horizontal' | 'vertical'
  ): number {
    if (elements.length < 2) return 0;
    
    const spacings: number[] = [];
    
    for (let i = 1; i < elements.length; i++) {
      const spacing = direction === 'horizontal' ?
        this.getHorizontalSpacing(elements[i - 1], elements[i]) :
        this.getVerticalSpacing(elements[i - 1], elements[i]);
      spacings.push(spacing);
    }
    
    return spacings.reduce((a, b) => a + b, 0) / spacings.length;
  }

  /**
   * Detect alignment pattern in a group
   */
  private detectAlignment(elements: DetectedElement[]): string {
    // Check for left alignment
    const leftX = elements.map(el => el.boundingBox.x);
    if (this.areAligned(leftX)) return 'left';
    
    // Check for right alignment
    const rightX = elements.map(el => el.boundingBox.x + el.boundingBox.width);
    if (this.areAligned(rightX)) return 'right';
    
    // Check for center alignment
    const centerX = elements.map(el => el.boundingBox.center.x);
    if (this.areAligned(centerX)) return 'center';
    
    // Check for top alignment
    const topY = elements.map(el => el.boundingBox.y);
    if (this.areAligned(topY)) return 'top';
    
    // Check for bottom alignment
    const bottomY = elements.map(el => el.boundingBox.y + el.boundingBox.height);
    if (this.areAligned(bottomY)) return 'bottom';
    
    return 'mixed';
  }

  /**
   * Check if values are aligned
   */
  private areAligned(values: number[]): boolean {
    if (values.length < 2) return true;
    
    const variance = this.calculateVariance(values);
    return variance < this.ALIGNMENT_THRESHOLD;
  }

  /**
   * Calculate variance of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Check if element has multiple children
   */
  private hasMultipleChildren(element: DetectedElement, allElements: DetectedElement[]): boolean {
    const childCount = allElements.filter(el => el.parent === element.id).length;
    return childCount >= 2;
  }

  /**
   * Get direct children of an element
   */
  private getDirectChildren(parent: DetectedElement, allElements: DetectedElement[]): DetectedElement[] {
    return allElements.filter(el => el.parent === parent.id);
  }
}