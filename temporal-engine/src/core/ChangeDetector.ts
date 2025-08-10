import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createLogger, logPerformance } from '../utils/logger';
import {
  ChangeMap,
  DifferenceMetrics,
  DifferenceMap,
  Region,
  ChangeType,
  ChangeDetectorConfig
} from '../types';

const logger = createLogger('ChangeDetector');

/**
 * Detects visual changes between frames using advanced computer vision techniques
 */
export class ChangeDetector {
  private config: Required<ChangeDetectorConfig>;

  constructor(config: Partial<ChangeDetectorConfig> = {}) {
    this.config = {
      pixelThreshold: config.pixelThreshold ?? 30,
      minRegionSize: config.minRegionSize ?? 100,
      useEdgeDetection: config.useEdgeDetection ?? true,
      useColorAnalysis: config.useColorAnalysis ?? true,
      detectTextChanges: config.detectTextChanges ?? true
    };

    logger.info('ChangeDetector initialized', { config: this.config });
  }

  /**
   * Detect changes between two frames
   */
  async detectChanges(frame1: Buffer, frame2: Buffer): Promise<ChangeMap> {
    const startTime = Date.now();
    logger.debug('Detecting changes between frames');

    try {
      // Convert buffers to PNG for analysis
      const [img1, img2] = await Promise.all([
        this.bufferToPNG(frame1),
        this.bufferToPNG(frame2)
      ]);

      // Ensure images have the same dimensions
      if (img1.width !== img2.width || img1.height !== img2.height) {
        throw new Error('Frame dimensions do not match');
      }

      // Calculate pixel differences
      const diffMap = this.calculateDifference(img1, img2);
      
      // Calculate metrics
      const metrics = await this.calculateMetrics(img1, img2, diffMap);
      
      // Identify change regions
      const regions = await this.identifyChangeRegions(diffMap, img1, img2);
      
      // Calculate overall statistics
      const changedPixels = this.countChangedPixels(diffMap);
      const totalPixels = img1.width * img1.height;
      const changePercentage = (changedPixels / totalPixels) * 100;
      const overallIntensity = this.calculateOverallIntensity(diffMap);

      const changeMap: ChangeMap = {
        changedPixels,
        changePercentage,
        regions,
        overallIntensity,
        metrics
      };

      logPerformance('detectChanges', startTime, {
        changedPixels,
        changePercentage,
        regionCount: regions.length
      });

      return changeMap;
    } catch (error) {
      logger.error('Error detecting changes', { error });
      throw error;
    }
  }

  /**
   * Calculate pixel-level differences between frames
   */
  calculateDifference(img1: PNG, img2: PNG): DifferenceMap {
    const width = img1.width;
    const height = img1.height;
    const diff = new PNG({ width, height });

    // Use pixelmatch for efficient difference calculation
    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold: this.config.pixelThreshold / 255 }
    );

    // Calculate difference statistics
    let maxDiff = 0;
    let totalDiff = 0;
    const diffData = new Uint8Array(width * height);

    for (let i = 0; i < diff.data.length; i += 4) {
      const r = diff.data[i];
      const g = diff.data[i + 1];
      const b = diff.data[i + 2];
      const pixelDiff = (r + g + b) / 3;
      
      diffData[i / 4] = pixelDiff;
      maxDiff = Math.max(maxDiff, pixelDiff);
      totalDiff += pixelDiff;
    }

    const avgDifference = totalDiff / (width * height);

    return {
      width,
      height,
      data: diffData,
      maxDifference: maxDiff,
      avgDifference
    };
  }

  /**
   * Calculate comprehensive difference metrics
   */
  async calculateMetrics(img1: PNG, img2: PNG, diffMap: DifferenceMap): Promise<DifferenceMetrics> {
    const startTime = Date.now();

    // Mean Squared Error
    const mse = this.calculateMSE(img1.data, img2.data);
    
    // Peak Signal-to-Noise Ratio
    const psnr = this.calculatePSNR(mse);
    
    // Structural Similarity Index (simplified version)
    const ssim = await this.calculateSSIM(img1, img2);
    
    // Histogram difference
    const histogramDiff = this.calculateHistogramDifference(img1, img2);
    
    // Edge difference (if enabled)
    const edgeDiff = this.config.useEdgeDetection ? 
      await this.calculateEdgeDifference(img1, img2) : 0;
    
    // Color distribution difference (if enabled)
    const colorDiff = this.config.useColorAnalysis ?
      this.calculateColorDifference(img1, img2) : 0;

    logPerformance('calculateMetrics', startTime);

    return {
      mse,
      psnr,
      ssim,
      histogramDiff,
      edgeDiff,
      colorDiff
    };
  }

  /**
   * Identify distinct regions of change
   */
  async identifyChangeRegions(diffMap: DifferenceMap, img1: PNG, img2: PNG): Promise<Region[]> {
    const startTime = Date.now();
    const regions: Region[] = [];
    
    // Use connected component analysis to find regions
    const labels = this.connectedComponentAnalysis(diffMap);
    const regionMap = new Map<number, { pixels: Array<{x: number, y: number}>, intensity: number }>();

    // Group pixels by region
    for (let y = 0; y < diffMap.height; y++) {
      for (let x = 0; x < diffMap.width; x++) {
        const idx = y * diffMap.width + x;
        const label = labels[idx];
        
        if (label > 0) {
          if (!regionMap.has(label)) {
            regionMap.set(label, { pixels: [], intensity: 0 });
          }
          
          const region = regionMap.get(label)!;
          region.pixels.push({ x, y });
          region.intensity += diffMap.data[idx];
        }
      }
    }

    // Process each region
    for (const [label, regionData] of regionMap) {
      if (regionData.pixels.length < this.config.minRegionSize) {
        continue; // Skip small regions
      }

      // Calculate bounding box
      const bounds = this.calculateBoundingBox(regionData.pixels);
      
      // Determine change type
      const changeType = await this.classifyChangeType(
        bounds,
        img1,
        img2,
        regionData.pixels
      );

      // Calculate average intensity
      const avgIntensity = regionData.intensity / regionData.pixels.length / 255;

      regions.push({
        bounds,
        changeType,
        confidence: this.calculateRegionConfidence(regionData, avgIntensity),
        intensity: avgIntensity,
        properties: await this.extractRegionProperties(bounds, img1, img2, changeType)
      });
    }

    logPerformance('identifyChangeRegions', startTime, { regionCount: regions.length });
    return regions;
  }

  /**
   * Classify the type of change in a region
   */
  async classifyChangeType(
    bounds: Region['bounds'],
    img1: PNG,
    img2: PNG,
    pixels: Array<{x: number, y: number}>
  ): Promise<ChangeType> {
    // Extract region data from both images
    const region1 = this.extractRegion(img1, bounds);
    const region2 = this.extractRegion(img2, bounds);

    // Check for appearance/disappearance
    const isEmpty1 = this.isRegionEmpty(region1);
    const isEmpty2 = this.isRegionEmpty(region2);

    if (isEmpty1 && !isEmpty2) return ChangeType.APPEARANCE;
    if (!isEmpty1 && isEmpty2) return ChangeType.DISAPPEARANCE;

    // Check for movement
    const movement = await this.detectMovement(region1, region2, img1, img2, bounds);
    if (movement) return ChangeType.MOVEMENT;

    // Check for transformation
    const transformation = this.detectTransformation(region1, region2);
    if (transformation) return ChangeType.TRANSFORMATION;

    // Check for style changes
    const styleChange = this.detectStyleChange(region1, region2);
    if (styleChange) return ChangeType.STYLE_CHANGE;

    // Check for text changes
    if (this.config.detectTextChanges) {
      const textChange = await this.detectTextChange(region1, region2);
      if (textChange) return ChangeType.TEXT_CHANGE;
    }

    // Check for animation
    const animation = this.detectAnimation(pixels, bounds);
    if (animation) return ChangeType.ANIMATION;

    // Default to complex if multiple changes detected
    return ChangeType.COMPLEX;
  }

  /**
   * Convert buffer to PNG for processing
   */
  private async bufferToPNG(buffer: Buffer): Promise<PNG> {
    return new Promise((resolve, reject) => {
      const png = new PNG();
      png.parse(buffer, (error, data) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  }

  /**
   * Count the number of changed pixels
   */
  private countChangedPixels(diffMap: DifferenceMap): number {
    let count = 0;
    for (const value of diffMap.data) {
      if (value > 0) count++;
    }
    return count;
  }

  /**
   * Calculate overall change intensity
   */
  private calculateOverallIntensity(diffMap: DifferenceMap): number {
    let totalIntensity = 0;
    let changedPixels = 0;

    for (const value of diffMap.data) {
      if (value > 0) {
        totalIntensity += value;
        changedPixels++;
      }
    }

    return changedPixels > 0 ? (totalIntensity / changedPixels) / 255 : 0;
  }

  /**
   * Calculate Mean Squared Error
   */
  private calculateMSE(data1: Uint8Array, data2: Uint8Array): number {
    let sum = 0;
    const pixelCount = data1.length / 4;

    for (let i = 0; i < data1.length; i += 4) {
      const r1 = data1[i], g1 = data1[i + 1], b1 = data1[i + 2];
      const r2 = data2[i], g2 = data2[i + 1], b2 = data2[i + 2];
      
      sum += Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2);
    }

    return sum / (pixelCount * 3);
  }

  /**
   * Calculate Peak Signal-to-Noise Ratio
   */
  private calculatePSNR(mse: number): number {
    if (mse === 0) return Infinity;
    return 10 * Math.log10((255 * 255) / mse);
  }

  /**
   * Calculate Structural Similarity Index (simplified)
   */
  private async calculateSSIM(img1: PNG, img2: PNG): Promise<number> {
    // Simplified SSIM calculation
    // In production, use a proper SSIM implementation
    const mse = this.calculateMSE(img1.data, img2.data);
    return 1 - (mse / (255 * 255));
  }

  /**
   * Calculate histogram difference
   */
  private calculateHistogramDifference(img1: PNG, img2: PNG): number {
    const hist1 = this.calculateHistogram(img1.data);
    const hist2 = this.calculateHistogram(img2.data);
    
    let diff = 0;
    for (let i = 0; i < 256; i++) {
      diff += Math.abs(hist1[i] - hist2[i]);
    }
    
    return diff / (img1.width * img1.height * 3);
  }

  /**
   * Calculate histogram for image data
   */
  private calculateHistogram(data: Uint8Array): number[] {
    const histogram = new Array(256).fill(0);
    
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;     // R
      histogram[data[i + 1]]++; // G
      histogram[data[i + 2]]++; // B
    }
    
    return histogram;
  }

  /**
   * Calculate edge difference using Sobel operator
   */
  private async calculateEdgeDifference(img1: PNG, img2: PNG): Promise<number> {
    // Simplified edge detection
    // In production, use proper edge detection algorithms
    const edges1 = this.detectEdges(img1);
    const edges2 = this.detectEdges(img2);
    
    let diff = 0;
    for (let i = 0; i < edges1.length; i++) {
      diff += Math.abs(edges1[i] - edges2[i]);
    }
    
    return diff / edges1.length;
  }

  /**
   * Simple edge detection
   */
  private detectEdges(img: PNG): Uint8Array {
    const width = img.width;
    const height = img.height;
    const edges = new Uint8Array(width * height);
    
    // Simplified Sobel operator
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Get surrounding pixels
        const tl = img.data[((y - 1) * width + (x - 1)) * 4];
        const tm = img.data[((y - 1) * width + x) * 4];
        const tr = img.data[((y - 1) * width + (x + 1)) * 4];
        const ml = img.data[(y * width + (x - 1)) * 4];
        const mr = img.data[(y * width + (x + 1)) * 4];
        const bl = img.data[((y + 1) * width + (x - 1)) * 4];
        const bm = img.data[((y + 1) * width + x) * 4];
        const br = img.data[((y + 1) * width + (x + 1)) * 4];
        
        // Sobel X
        const sobelX = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        // Sobel Y
        const sobelY = (bl + 2 * bm + br) - (tl + 2 * tm + tr);
        
        edges[y * width + x] = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
      }
    }
    
    return edges;
  }

  /**
   * Calculate color distribution difference
   */
  private calculateColorDifference(img1: PNG, img2: PNG): number {
    const colors1 = this.extractDominantColors(img1);
    const colors2 = this.extractDominantColors(img2);
    
    let totalDiff = 0;
    for (let i = 0; i < colors1.length; i++) {
      const c1 = colors1[i];
      const c2 = colors2[i];
      totalDiff += Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
      );
    }
    
    return totalDiff / (colors1.length * Math.sqrt(3 * 255 * 255));
  }

  /**
   * Extract dominant colors (simplified k-means)
   */
  private extractDominantColors(img: PNG, k: number = 5): Array<{r: number, g: number, b: number}> {
    // Simplified color extraction
    // In production, use proper k-means clustering
    const colors: Array<{r: number, g: number, b: number}> = [];
    const step = Math.floor(img.data.length / (k * 4));
    
    for (let i = 0; i < k; i++) {
      const idx = i * step * 4;
      colors.push({
        r: img.data[idx],
        g: img.data[idx + 1],
        b: img.data[idx + 2]
      });
    }
    
    return colors;
  }

  /**
   * Connected component analysis for region detection
   */
  private connectedComponentAnalysis(diffMap: DifferenceMap): Uint32Array {
    const width = diffMap.width;
    const height = diffMap.height;
    const labels = new Uint32Array(width * height);
    let currentLabel = 1;

    // First pass: assign initial labels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (diffMap.data[idx] > this.config.pixelThreshold) {
          const neighbors = this.getNeighborLabels(labels, x, y, width);
          
          if (neighbors.length === 0) {
            labels[idx] = currentLabel++;
          } else {
            labels[idx] = Math.min(...neighbors);
          }
        }
      }
    }

    // Second pass: merge equivalent labels
    this.mergeEquivalentLabels(labels, width, height);

    return labels;
  }

  /**
   * Get labels of neighboring pixels
   */
  private getNeighborLabels(labels: Uint32Array, x: number, y: number, width: number): number[] {
    const neighbors: number[] = [];
    
    // Check 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0) {
          const label = labels[ny * width + nx];
          if (label > 0) neighbors.push(label);
        }
      }
    }
    
    return [...new Set(neighbors)];
  }

  /**
   * Merge equivalent labels in connected components
   */
  private mergeEquivalentLabels(labels: Uint32Array, width: number, height: number): void {
    const equivalences = new Map<number, number>();
    
    // Find equivalences
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const label = labels[idx];
        
        if (label > 0) {
          const neighbors = this.getNeighborLabels(labels, x, y, width);
          const minNeighbor = Math.min(...neighbors, label);
          
          if (minNeighbor < label) {
            equivalences.set(label, minNeighbor);
          }
        }
      }
    }
    
    // Apply equivalences
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] > 0) {
        let finalLabel = labels[i];
        while (equivalences.has(finalLabel)) {
          finalLabel = equivalences.get(finalLabel)!;
        }
        labels[i] = finalLabel;
      }
    }
  }

  /**
   * Calculate bounding box for a set of pixels
   */
  private calculateBoundingBox(pixels: Array<{x: number, y: number}>): Region['bounds'] {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pixel of pixels) {
      minX = Math.min(minX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxX = Math.max(maxX, pixel.x);
      maxY = Math.max(maxY, pixel.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  /**
   * Extract a region from an image
   */
  private extractRegion(img: PNG, bounds: Region['bounds']): Uint8Array {
    const regionData = new Uint8Array(bounds.width * bounds.height * 4);
    
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const srcIdx = ((bounds.y + y) * img.width + (bounds.x + x)) * 4;
        const dstIdx = (y * bounds.width + x) * 4;
        
        regionData[dstIdx] = img.data[srcIdx];
        regionData[dstIdx + 1] = img.data[srcIdx + 1];
        regionData[dstIdx + 2] = img.data[srcIdx + 2];
        regionData[dstIdx + 3] = img.data[srcIdx + 3];
      }
    }
    
    return regionData;
  }

  /**
   * Check if a region is empty (all transparent or black)
   */
  private isRegionEmpty(regionData: Uint8Array): boolean {
    for (let i = 0; i < regionData.length; i += 4) {
      if (regionData[i] > 10 || regionData[i + 1] > 10 || regionData[i + 2] > 10) {
        return false;
      }
    }
    return true;
  }

  /**
   * Detect if a region has moved
   */
  private async detectMovement(
    region1: Uint8Array,
    region2: Uint8Array,
    img1: PNG,
    img2: PNG,
    bounds: Region['bounds']
  ): Promise<boolean> {
    // Search for similar region in surrounding area
    const searchRadius = 50;
    const threshold = 0.9;
    
    for (let dy = -searchRadius; dy <= searchRadius; dy += 5) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += 5) {
        if (dx === 0 && dy === 0) continue;
        
        const newBounds = {
          x: bounds.x + dx,
          y: bounds.y + dy,
          width: bounds.width,
          height: bounds.height
        };
        
        if (newBounds.x >= 0 && newBounds.y >= 0 &&
            newBounds.x + newBounds.width <= img2.width &&
            newBounds.y + newBounds.height <= img2.height) {
          
          const candidateRegion = this.extractRegion(img2, newBounds);
          const similarity = this.calculateRegionSimilarity(region1, candidateRegion);
          
          if (similarity > threshold) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Calculate similarity between two regions
   */
  private calculateRegionSimilarity(region1: Uint8Array, region2: Uint8Array): number {
    let matchingPixels = 0;
    const totalPixels = region1.length / 4;
    
    for (let i = 0; i < region1.length; i += 4) {
      const diff = Math.abs(region1[i] - region2[i]) +
                   Math.abs(region1[i + 1] - region2[i + 1]) +
                   Math.abs(region1[i + 2] - region2[i + 2]);
      
      if (diff < 30) matchingPixels++;
    }
    
    return matchingPixels / totalPixels;
  }

  /**
   * Detect transformation (scaling, rotation)
   */
  private detectTransformation(region1: Uint8Array, region2: Uint8Array): boolean {
    // Simplified transformation detection
    // In production, use feature matching or template matching
    const size1 = this.calculateRegionSize(region1);
    const size2 = this.calculateRegionSize(region2);
    
    const sizeRatio = size2 / size1;
    return sizeRatio < 0.8 || sizeRatio > 1.2;
  }

  /**
   * Calculate non-empty size of a region
   */
  private calculateRegionSize(regionData: Uint8Array): number {
    let nonEmptyPixels = 0;
    
    for (let i = 0; i < regionData.length; i += 4) {
      if (regionData[i] > 10 || regionData[i + 1] > 10 || regionData[i + 2] > 10) {
        nonEmptyPixels++;
      }
    }
    
    return nonEmptyPixels;
  }

  /**
   * Detect style changes (color, opacity)
   */
  private detectStyleChange(region1: Uint8Array, region2: Uint8Array): boolean {
    const avgColor1 = this.calculateAverageColor(region1);
    const avgColor2 = this.calculateAverageColor(region2);
    
    const colorDiff = Math.sqrt(
      Math.pow(avgColor1.r - avgColor2.r, 2) +
      Math.pow(avgColor1.g - avgColor2.g, 2) +
      Math.pow(avgColor1.b - avgColor2.b, 2)
    );
    
    return colorDiff > 50;
  }

  /**
   * Calculate average color of a region
   */
  private calculateAverageColor(regionData: Uint8Array): {r: number, g: number, b: number} {
    let r = 0, g = 0, b = 0, count = 0;
    
    for (let i = 0; i < regionData.length; i += 4) {
      if (regionData[i + 3] > 0) { // Only count non-transparent pixels
        r += regionData[i];
        g += regionData[i + 1];
        b += regionData[i + 2];
        count++;
      }
    }
    
    return {
      r: count > 0 ? r / count : 0,
      g: count > 0 ? g / count : 0,
      b: count > 0 ? b / count : 0
    };
  }

  /**
   * Detect text changes (simplified)
   */
  private async detectTextChange(region1: Uint8Array, region2: Uint8Array): Promise<boolean> {
    // In production, use OCR to detect actual text changes
    // For now, use pattern analysis
    const pattern1 = this.analyzeTextPattern(region1);
    const pattern2 = this.analyzeTextPattern(region2);
    
    return Math.abs(pattern1 - pattern2) > 0.2;
  }

  /**
   * Analyze text-like patterns in a region
   */
  private analyzeTextPattern(regionData: Uint8Array): number {
    // Look for horizontal lines (text characteristics)
    let transitions = 0;
    const width = Math.sqrt(regionData.length / 4);
    
    for (let y = 0; y < width; y++) {
      let lastValue = 0;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const value = regionData[idx] > 128 ? 1 : 0;
        
        if (value !== lastValue) {
          transitions++;
          lastValue = value;
        }
      }
    }
    
    return transitions / (width * width);
  }

  /**
   * Detect animation patterns
   */
  private detectAnimation(pixels: Array<{x: number, y: number}>, bounds: Region['bounds']): boolean {
    // Check if change follows animation patterns
    // (smooth transitions, easing curves, etc.)
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    let radialPattern = 0;
    for (const pixel of pixels) {
      const distance = Math.sqrt(
        Math.pow(pixel.x - centerX, 2) +
        Math.pow(pixel.y - centerY, 2)
      );
      radialPattern += distance;
    }
    
    const avgDistance = radialPattern / pixels.length;
    const expectedRadius = Math.sqrt(bounds.width * bounds.height) / 2;
    
    return Math.abs(avgDistance - expectedRadius) < expectedRadius * 0.3;
  }

  /**
   * Calculate confidence score for a region
   */
  private calculateRegionConfidence(
    regionData: { pixels: Array<{x: number, y: number}>, intensity: number },
    avgIntensity: number
  ): number {
    // Base confidence on region size and intensity
    const sizeScore = Math.min(regionData.pixels.length / 1000, 1);
    const intensityScore = avgIntensity;
    
    return (sizeScore + intensityScore) / 2;
  }

  /**
   * Extract additional properties for a region
   */
  private async extractRegionProperties(
    bounds: Region['bounds'],
    img1: PNG,
    img2: PNG,
    changeType: ChangeType
  ): Promise<Region['properties']> {
    const properties: Region['properties'] = {};
    
    if (changeType === ChangeType.STYLE_CHANGE) {
      const region1 = this.extractRegion(img1, bounds);
      const region2 = this.extractRegion(img2, bounds);
      
      const color1 = this.calculateAverageColor(region1);
      const color2 = this.calculateAverageColor(region2);
      
      properties.previousColor = `rgb(${Math.round(color1.r)},${Math.round(color1.g)},${Math.round(color1.b)})`;
      properties.newColor = `rgb(${Math.round(color2.r)},${Math.round(color2.g)},${Math.round(color2.b)})`;
    }
    
    if (changeType === ChangeType.MOVEMENT) {
      // In production, calculate actual movement vector
      properties.movementVector = { x: 0, y: 0 };
    }
    
    return properties;
  }
}