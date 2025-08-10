/**
 * PropertyExtractor - Extracts visual properties from element images
 * 
 * This class analyzes element crops to extract:
 * - Color palettes
 * - Typography information
 * - Spacing and layout properties
 * - Visual effects (shadows, borders, etc.)
 */

import * as sharp from 'sharp';
import * as colorThief from 'color-thief-node';
import {
  DetectedElement,
  PropertyExtractionResult,
  ColorPalette,
  Color,
  Typography,
  Spacing,
  BoxModel,
  BorderInfo,
  ShadowInfo,
  LayoutInfo,
  StyleInfo,
  VisualFeatures
} from '../types';
import { createModuleLogger, logPerformance } from '../utils/logger';

const logger = createModuleLogger('PropertyExtractor');

export class PropertyExtractor {
  // Analysis thresholds
  private readonly EDGE_DETECTION_THRESHOLD = 50;
  private readonly COLOR_SIMILARITY_THRESHOLD = 30;
  private readonly MIN_COLOR_OCCURRENCE = 0.05; // 5% of pixels
  private readonly SHADOW_DETECTION_THRESHOLD = 0.7;

  constructor() {
    logger.info('PropertyExtractor initialized');
  }

  /**
   * Extract all visual properties from an element
   */
  async extractProperties(
    elementImage: Buffer,
    element: DetectedElement
  ): Promise<VisualFeatures> {
    const startTime = Date.now();
    logger.debug(`Extracting properties for element ${element.id}`);

    try {
      // Get image metadata
      const metadata = await sharp(elementImage).metadata();
      const { width = 0, height = 0 } = metadata;

      // Extract different property types in parallel
      const [colors, spacing, borders, shadows] = await Promise.all([
        this.extractColors(elementImage),
        this.extractSpacing(elementImage, width, height),
        this.extractBorders(elementImage, width, height),
        this.extractShadows(elementImage, width, height)
      ]);

      // Extract typography if it's a text element
      const typography = this.isTextElement(element) ? 
        await this.extractTypography(elementImage, element) : 
        undefined;

      const features: VisualFeatures = {
        colors,
        typography,
        spacing,
        borders,
        shadows: shadows.length > 0 ? shadows : undefined,
        opacity: await this.extractOpacity(elementImage)
      };

      logPerformance(`Property extraction for ${element.type}`, startTime);
      return features;

    } catch (error) {
      logger.error('Property extraction failed', { elementId: element.id, error });
      // Return default features
      return this.getDefaultFeatures();
    }
  }

  /**
   * Extract color palette from image
   */
  private async extractColors(image: Buffer): Promise<ColorPalette> {
    try {
      // Get dominant colors using color-thief
      const palette = await colorThief.getPalette(image, 5);
      
      // Convert to our Color format
      const colors = palette.map(rgb => this.rgbToColor(rgb));
      
      // Analyze color roles
      const background = await this.detectBackgroundColor(image);
      const foreground = await this.detectForegroundColor(image, background);
      
      // Find primary color (most dominant non-background)
      const primary = colors.find(c => 
        this.colorDistance(c, background) > this.COLOR_SIMILARITY_THRESHOLD
      ) || colors[0];

      // Find secondary color
      const secondary = colors.find(c => 
        c !== primary && 
        this.colorDistance(c, background) > this.COLOR_SIMILARITY_THRESHOLD
      );

      // Detect gradients
      const gradient = await this.detectGradient(image);

      return {
        primary,
        secondary,
        background,
        foreground,
        accent: colors.slice(2),
        gradient
      };

    } catch (error) {
      logger.warn('Color extraction failed', { error });
      return this.getDefaultColorPalette();
    }
  }

  /**
   * Extract spacing information
   */
  private async extractSpacing(
    image: Buffer,
    width: number,
    height: number
  ): Promise<Spacing> {
    try {
      // Detect content boundaries
      const contentBounds = await this.detectContentBounds(image, width, height);
      
      // Calculate padding (space between content and element bounds)
      const padding: BoxModel = {
        top: contentBounds.top,
        right: width - contentBounds.right,
        bottom: height - contentBounds.bottom,
        left: contentBounds.left
      };

      // Margin detection would require context from parent
      const margin: BoxModel = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      };

      return { margin, padding };

    } catch (error) {
      logger.warn('Spacing extraction failed', { error });
      return this.getDefaultSpacing();
    }
  }

  /**
   * Extract border information
   */
  private async extractBorders(
    image: Buffer,
    width: number,
    height: number
  ): Promise<BorderInfo | undefined> {
    try {
      // Detect edges
      const edges = await this.detectEdges(image);
      
      // Analyze edge patterns for borders
      const borders = await this.analyzeBorders(edges, width, height);
      
      if (!borders) return undefined;

      // Extract border color
      const borderColor = await this.extractBorderColor(image, borders);
      
      // Detect border radius
      const radius = await this.detectBorderRadius(image, width, height);

      return {
        width: borders,
        style: 'solid', // Would need more analysis for other styles
        color: borderColor,
        radius
      };

    } catch (error) {
      logger.warn('Border extraction failed', { error });
      return undefined;
    }
  }

  /**
   * Extract shadow information
   */
  private async extractShadows(
    image: Buffer,
    width: number,
    height: number
  ): Promise<ShadowInfo[]> {
    try {
      const shadows: ShadowInfo[] = [];
      
      // Detect drop shadow
      const dropShadow = await this.detectDropShadow(image, width, height);
      if (dropShadow) {
        shadows.push(dropShadow);
      }

      // Detect inner shadow
      const innerShadow = await this.detectInnerShadow(image, width, height);
      if (innerShadow) {
        shadows.push({ ...innerShadow, inset: true });
      }

      return shadows;

    } catch (error) {
      logger.warn('Shadow extraction failed', { error });
      return [];
    }
  }

  /**
   * Extract typography information
   */
  private async extractTypography(
    image: Buffer,
    element: DetectedElement
  ): Promise<Typography | undefined> {
    try {
      // Estimate font size from element height
      const metadata = await sharp(image).metadata();
      const fontSize = this.estimateFontSize(metadata.height || 0);
      
      // Detect font weight from stroke thickness
      const fontWeight = await this.detectFontWeight(image);
      
      // Detect text alignment
      const textAlign = await this.detectTextAlignment(image, metadata.width || 0);

      return {
        fontSize,
        fontWeight,
        textAlign,
        // These would require more sophisticated analysis
        fontFamily: undefined,
        lineHeight: fontSize * 1.5,
        letterSpacing: 0
      };

    } catch (error) {
      logger.warn('Typography extraction failed', { error });
      return undefined;
    }
  }

  /**
   * Extract opacity
   */
  private async extractOpacity(image: Buffer): Promise<number> {
    try {
      const metadata = await sharp(image).metadata();
      
      // Check if image has alpha channel
      if (metadata.channels === 4) {
        // Extract alpha channel
        const { data } = await sharp(image)
          .extractChannel('alpha')
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        // Calculate average alpha
        const alphaValues = new Uint8Array(data);
        const avgAlpha = alphaValues.reduce((sum, val) => sum + val, 0) / alphaValues.length;
        
        return avgAlpha / 255;
      }
      
      return 1.0;

    } catch (error) {
      logger.warn('Opacity extraction failed', { error });
      return 1.0;
    }
  }

  /**
   * Detect background color
   */
  private async detectBackgroundColor(image: Buffer): Promise<Color> {
    try {
      // Sample corners and edges
      const { data, info } = await sharp(image)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const pixels = new Uint8Array(data);
      const { width, height, channels } = info;
      
      // Sample corner pixels
      const cornerColors: Color[] = [];
      const positions = [
        { x: 0, y: 0 },                          // Top-left
        { x: width - 1, y: 0 },                  // Top-right
        { x: 0, y: height - 1 },                 // Bottom-left
        { x: width - 1, y: height - 1 }          // Bottom-right
      ];
      
      for (const pos of positions) {
        const idx = (pos.y * width + pos.x) * channels;
        cornerColors.push(this.rgbToColor([
          pixels[idx],
          pixels[idx + 1],
          pixels[idx + 2]
        ]));
      }
      
      // Find most common corner color
      return this.findMostCommonColor(cornerColors);

    } catch (error) {
      logger.warn('Background color detection failed', { error });
      return this.createColor('#FFFFFF');
    }
  }

  /**
   * Detect foreground color
   */
  private async detectForegroundColor(image: Buffer, background: Color): Promise<Color> {
    try {
      // Get all colors
      const palette = await colorThief.getPalette(image, 10);
      const colors = palette.map(rgb => this.rgbToColor(rgb));
      
      // Find color most different from background
      let maxDistance = 0;
      let foreground = this.createColor('#000000');
      
      for (const color of colors) {
        const distance = this.colorDistance(color, background);
        if (distance > maxDistance) {
          maxDistance = distance;
          foreground = color;
        }
      }
      
      return foreground;

    } catch (error) {
      logger.warn('Foreground color detection failed', { error });
      return this.createColor('#000000');
    }
  }

  /**
   * Detect gradient
   */
  private async detectGradient(image: Buffer): Promise<any> {
    try {
      const { data, info } = await sharp(image)
        .resize(10, 10) // Sample at lower resolution
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const pixels = new Uint8Array(data);
      const { width, height, channels } = info;
      
      // Sample colors at different positions
      const topColor = this.getPixelColor(pixels, width / 2, 0, width, channels);
      const bottomColor = this.getPixelColor(pixels, width / 2, height - 1, width, channels);
      const leftColor = this.getPixelColor(pixels, 0, height / 2, width, channels);
      const rightColor = this.getPixelColor(pixels, width - 1, height / 2, width, channels);
      
      // Check for vertical gradient
      const verticalDiff = this.colorDistance(topColor, bottomColor);
      const horizontalDiff = this.colorDistance(leftColor, rightColor);
      
      if (verticalDiff > this.COLOR_SIMILARITY_THRESHOLD) {
        return {
          type: 'linear',
          colors: [topColor, bottomColor],
          angle: 180
        };
      }
      
      if (horizontalDiff > this.COLOR_SIMILARITY_THRESHOLD) {
        return {
          type: 'linear',
          colors: [leftColor, rightColor],
          angle: 90
        };
      }
      
      return undefined;

    } catch (error) {
      logger.warn('Gradient detection failed', { error });
      return undefined;
    }
  }

  /**
   * Detect content bounds
   */
  private async detectContentBounds(
    image: Buffer,
    width: number,
    height: number
  ): Promise<{ top: number; right: number; bottom: number; left: number }> {
    try {
      // Convert to grayscale and get pixel data
      const { data } = await sharp(image)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const pixels = new Uint8Array(data);
      
      // Find bounds of non-background content
      let top = 0, bottom = height - 1, left = 0, right = width - 1;
      
      // Scan from top
      outer: for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (this.isContentPixel(pixels[y * width + x])) {
            top = y;
            break outer;
          }
        }
      }
      
      // Scan from bottom
      outer: for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
          if (this.isContentPixel(pixels[y * width + x])) {
            bottom = y;
            break outer;
          }
        }
      }
      
      // Scan from left
      outer: for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          if (this.isContentPixel(pixels[y * width + x])) {
            left = x;
            break outer;
          }
        }
      }
      
      // Scan from right
      outer: for (let x = width - 1; x >= 0; x--) {
        for (let y = 0; y < height; y++) {
          if (this.isContentPixel(pixels[y * width + x])) {
            right = x;
            break outer;
          }
        }
      }
      
      return { top, right, bottom, left };

    } catch (error) {
      logger.warn('Content bounds detection failed', { error });
      return { top: 0, right: width, bottom: height, left: 0 };
    }
  }

  /**
   * Detect edges in image
   */
  private async detectEdges(image: Buffer): Promise<Buffer> {
    // Apply edge detection filter (Sobel)
    return sharp(image)
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1]
      })
      .toBuffer();
  }

  /**
   * Analyze borders from edge detection
   */
  private async analyzeBorders(
    edges: Buffer,
    width: number,
    height: number
  ): Promise<BoxModel | null> {
    try {
      const { data } = await sharp(edges)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const pixels = new Uint8Array(data);
      
      // Check for continuous edges along borders
      let topBorder = 0, rightBorder = 0, bottomBorder = 0, leftBorder = 0;
      
      // Top edge
      let topEdgeCount = 0;
      for (let x = 0; x < width; x++) {
        if (pixels[x] > this.EDGE_DETECTION_THRESHOLD) topEdgeCount++;
      }
      if (topEdgeCount > width * 0.8) topBorder = 1;
      
      // Similar for other edges...
      // This is simplified - real implementation would be more sophisticated
      
      if (topBorder || rightBorder || bottomBorder || leftBorder) {
        return { top: topBorder, right: rightBorder, bottom: bottomBorder, left: leftBorder };
      }
      
      return null;

    } catch (error) {
      logger.warn('Border analysis failed', { error });
      return null;
    }
  }

  /**
   * Extract border color
   */
  private async extractBorderColor(image: Buffer, borders: BoxModel): Promise<Color> {
    // Sample pixels along detected borders
    // This is a simplified implementation
    return this.createColor('#CCCCCC');
  }

  /**
   * Detect border radius
   */
  private async detectBorderRadius(
    image: Buffer,
    width: number,
    height: number
  ): Promise<BoxModel | undefined> {
    // Check corners for rounded edges
    // This would require analyzing the curvature of corners
    // Simplified implementation
    return undefined;
  }

  /**
   * Detect drop shadow
   */
  private async detectDropShadow(
    image: Buffer,
    width: number,
    height: number
  ): Promise<ShadowInfo | null> {
    // Look for shadow patterns outside main content
    // This is a simplified implementation
    return null;
  }

  /**
   * Detect inner shadow
   */
  private async detectInnerShadow(
    image: Buffer,
    width: number,
    height: number
  ): Promise<ShadowInfo | null> {
    // Look for shadow patterns inside borders
    // This is a simplified implementation
    return null;
  }

  /**
   * Estimate font size from height
   */
  private estimateFontSize(height: number): number {
    // Rough estimation - actual font size detection would be more complex
    return Math.round(height * 0.7);
  }

  /**
   * Detect font weight
   */
  private async detectFontWeight(image: Buffer): Promise<number> {
    // Analyze stroke thickness
    // Simplified - return normal weight
    return 400;
  }

  /**
   * Detect text alignment
   */
  private async detectTextAlignment(image: Buffer, width: number): Promise<'left' | 'center' | 'right'> {
    try {
      // Find text bounds
      const bounds = await this.detectContentBounds(image, width, 1);
      
      const textStart = bounds.left;
      const textEnd = bounds.right;
      const textWidth = textEnd - textStart;
      
      const leftSpace = textStart;
      const rightSpace = width - textEnd;
      
      // Check alignment based on spacing
      if (Math.abs(leftSpace - rightSpace) < 5) {
        return 'center';
      } else if (leftSpace < rightSpace) {
        return 'left';
      } else {
        return 'right';
      }

    } catch (error) {
      return 'left';
    }
  }

  /**
   * Check if element is text-based
   */
  private isTextElement(element: DetectedElement): boolean {
    const textTypes = ['text', 'header', 'button', 'link'];
    return textTypes.includes(element.type);
  }

  /**
   * Check if pixel is content (not background)
   */
  private isContentPixel(value: number): boolean {
    // Simple threshold - could be more sophisticated
    return value < 240; // Not white/near-white
  }

  /**
   * Get pixel color at position
   */
  private getPixelColor(
    pixels: Uint8Array,
    x: number,
    y: number,
    width: number,
    channels: number
  ): Color {
    const idx = (Math.floor(y) * width + Math.floor(x)) * channels;
    return this.rgbToColor([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
  }

  /**
   * Convert RGB array to Color object
   */
  private rgbToColor(rgb: number[]): Color {
    const [r, g, b] = rgb;
    const hex = this.rgbToHex(r, g, b);
    const hsl = this.rgbToHsl(r, g, b);
    
    return {
      hex,
      rgb: { r, g, b },
      hsl,
      alpha: 1
    };
  }

  /**
   * Create color from hex
   */
  private createColor(hex: string): Color {
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    return {
      hex,
      rgb,
      hsl,
      alpha: 1
    };
  }

  /**
   * Calculate color distance
   */
  private colorDistance(c1: Color, c2: Color): number {
    // Euclidean distance in RGB space
    const dr = c1.rgb.r - c2.rgb.r;
    const dg = c1.rgb.g - c2.rgb.g;
    const db = c1.rgb.b - c2.rgb.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /**
   * Find most common color
   */
  private findMostCommonColor(colors: Color[]): Color {
    // Simple implementation - return first color
    // Could be enhanced with clustering
    return colors[0] || this.createColor('#FFFFFF');
  }

  /**
   * Convert RGB to hex
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Convert RGB to HSL
   */
  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Get default visual features
   */
  private getDefaultFeatures(): VisualFeatures {
    return {
      colors: this.getDefaultColorPalette(),
      spacing: this.getDefaultSpacing(),
      opacity: 1
    };
  }

  /**
   * Get default color palette
   */
  private getDefaultColorPalette(): ColorPalette {
    return {
      primary: this.createColor('#000000'),
      background: this.createColor('#FFFFFF')
    };
  }

  /**
   * Get default spacing
   */
  private getDefaultSpacing(): Spacing {
    return {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 }
    };
  }
}