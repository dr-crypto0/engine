/**
 * VisionModel - AI/ML integration for element detection and classification
 * 
 * This class provides the computer vision capabilities:
 * - Element detection using object detection models (YOLO/Detectron2)
 * - Element classification using CNNs
 * - Text extraction using OCR
 * - Visual feature extraction
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import * as ort from 'onnxruntime-node';
import Tesseract from 'tesseract.js';
import * as sharp from 'sharp';
import {
  VisionModel as IVisionModel,
  BoundingBox,
  ElementType,
  VisualFeatures,
  Color
} from '../types';
import { createModuleLogger, logModelMetrics, logPerformance } from '../utils/logger';

const logger = createModuleLogger('VisionModel');

export class VisionModel implements IVisionModel {
  private detectionModel: tf.GraphModel | ort.InferenceSession | null = null;
  private classificationModel: tf.LayersModel | null = null;
  private modelPath: string;
  private useONNX: boolean = false;
  private tesseractWorker: Tesseract.Worker | null = null;
  
  // Model configuration
  private readonly INPUT_SIZE = 640; // Standard YOLO input size
  private readonly CONFIDENCE_THRESHOLD = 0.5;
  private readonly NMS_THRESHOLD = 0.4;
  private readonly MAX_DETECTIONS = 100;

  constructor(modelPath?: string) {
    this.modelPath = modelPath || './models/element-detection';
    logger.info('VisionModel initialized', { modelPath: this.modelPath });
  }

  /**
   * Load the vision models
   */
  async loadModel(modelPath: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Loading vision models...', { modelPath });

    try {
      // Try to load ONNX model first (better performance)
      if (await this.checkONNXModel(modelPath)) {
        await this.loadONNXModel(modelPath);
        this.useONNX = true;
      } else {
        // Fall back to TensorFlow.js
        await this.loadTensorFlowModel(modelPath);
      }

      // Load classification model
      await this.loadClassificationModel(`${modelPath}/classification`);

      // Initialize OCR
      await this.initializeOCR();

      logPerformance('Model loading', startTime);
      logger.info('Vision models loaded successfully');

    } catch (error) {
      logger.error('Failed to load vision models', { error });
      throw error;
    }
  }

  /**
   * Detect elements in an image
   */
  async detectElements(image: Buffer | tf.Tensor3D): Promise<BoundingBox[]> {
    const startTime = Date.now();
    
    try {
      // Convert image to tensor if needed
      const tensor = image instanceof Buffer ? 
        await this.imageToTensor(image) : image;

      // Run detection
      const detections = this.useONNX ? 
        await this.detectWithONNX(tensor) :
        await this.detectWithTensorFlow(tensor);

      // Apply NMS (Non-Maximum Suppression)
      const nmsResults = await this.applyNMS(detections);

      // Convert to BoundingBox format
      const boundingBoxes = nmsResults.map(detection => ({
        x: detection.x,
        y: detection.y,
        width: detection.width,
        height: detection.height,
        center: {
          x: detection.x + detection.width / 2,
          y: detection.y + detection.height / 2
        },
        confidence: detection.confidence
      }));

      logPerformance('Element detection', startTime);
      logger.debug(`Detected ${boundingBoxes.length} elements`);

      return boundingBoxes;

    } catch (error) {
      logger.error('Element detection failed', { error });
      throw error;
    }
  }

  /**
   * Classify an element crop
   */
  async classifyElement(crop: Buffer | tf.Tensor3D): Promise<{ type: ElementType; confidence: number }> {
    const startTime = Date.now();

    try {
      if (!this.classificationModel) {
        throw new Error('Classification model not loaded');
      }

      // Prepare input
      const tensor = crop instanceof Buffer ? 
        await this.imageToTensor(crop, 224) : // Standard classification size
        tf.image.resizeBilinear(crop as tf.Tensor3D, [224, 224]);

      // Normalize
      const normalized = tf.div(tensor, 255.0);
      const batched = normalized.expandDims(0);

      // Run classification
      const predictions = this.classificationModel.predict(batched) as tf.Tensor;
      const probabilities = await predictions.data();
      
      // Get top prediction
      const topIndex = this.argMax(Array.from(probabilities));
      const confidence = probabilities[topIndex];

      // Map to ElementType
      const elementType = this.indexToElementType(topIndex);

      // Cleanup
      normalized.dispose();
      batched.dispose();
      predictions.dispose();
      if (crop instanceof Buffer) {
        tensor.dispose();
      }

      logPerformance('Element classification', startTime);

      return { type: elementType, confidence };

    } catch (error) {
      logger.error('Element classification failed', { error });
      return { type: 'unknown', confidence: 0 };
    }
  }

  /**
   * Extract text from an image crop
   */
  async extractText(crop: Buffer | tf.Tensor3D): Promise<string> {
    const startTime = Date.now();

    try {
      // Convert tensor to buffer if needed
      const imageBuffer = crop instanceof Buffer ? 
        crop : 
        await this.tensorToBuffer(crop as tf.Tensor3D);

      // Preprocess for OCR (enhance contrast, denoise)
      const processed = await this.preprocessForOCR(imageBuffer);

      // Run OCR
      if (!this.tesseractWorker) {
        await this.initializeOCR();
      }

      const result = await this.tesseractWorker!.recognize(processed);
      const text = result.data.text.trim();

      logPerformance('Text extraction', startTime);
      logger.debug(`Extracted text: "${text.substring(0, 50)}..."`);

      return text;

    } catch (error) {
      logger.error('Text extraction failed', { error });
      return '';
    }
  }

  /**
   * Extract visual features from an element
   */
  async extractFeatures(crop: Buffer | tf.Tensor3D): Promise<VisualFeatures> {
    const startTime = Date.now();

    try {
      // Convert to buffer for processing
      const imageBuffer = crop instanceof Buffer ? 
        crop : 
        await this.tensorToBuffer(crop as tf.Tensor3D);

      // Extract colors
      const colors = await this.extractColors(imageBuffer);
      
      // Extract other features
      const opacity = await this.estimateOpacity(imageBuffer);
      
      // Basic spacing (would need more context for accurate spacing)
      const spacing = {
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 }
      };

      logPerformance('Feature extraction', startTime);

      return {
        colors,
        spacing,
        opacity
      };

    } catch (error) {
      logger.error('Feature extraction failed', { error });
      // Return default features
      return {
        colors: {
          primary: this.createColor('#000000'),
          background: this.createColor('#FFFFFF')
        },
        spacing: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        opacity: 1
      };
    }
  }

  /**
   * Check if ONNX model exists
   */
  private async checkONNXModel(modelPath: string): Promise<boolean> {
    try {
      // Check if ONNX file exists
      const fs = await import('fs/promises');
      await fs.access(`${modelPath}/model.onnx`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load ONNX model
   */
  private async loadONNXModel(modelPath: string): Promise<void> {
    logger.info('Loading ONNX model...');
    this.detectionModel = await ort.InferenceSession.create(
      `${modelPath}/model.onnx`,
      {
        executionProviders: ['cuda', 'cpu'], // Use GPU if available
        graphOptimizationLevel: 'all'
      }
    );
  }

  /**
   * Load TensorFlow model
   */
  private async loadTensorFlowModel(modelPath: string): Promise<void> {
    logger.info('Loading TensorFlow model...');
    this.detectionModel = await tf.loadGraphModel(`file://${modelPath}/model.json`);
  }

  /**
   * Load classification model
   */
  private async loadClassificationModel(modelPath: string): Promise<void> {
    try {
      this.classificationModel = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      logger.info('Classification model loaded');
    } catch (error) {
      logger.warn('Classification model not found, using heuristics', { error });
    }
  }

  /**
   * Initialize OCR worker
   */
  private async initializeOCR(): Promise<void> {
    logger.info('Initializing OCR...');
    this.tesseractWorker = await Tesseract.createWorker({
      logger: m => logger.debug('OCR', m)
    });
    await this.tesseractWorker.loadLanguage('eng');
    await this.tesseractWorker.initialize('eng');
  }

  /**
   * Convert image buffer to tensor
   */
  private async imageToTensor(image: Buffer, size: number = this.INPUT_SIZE): Promise<tf.Tensor3D> {
    // Resize and convert to tensor
    const resized = await sharp(image)
      .resize(size, size)
      .raw()
      .toBuffer();

    // Create tensor from buffer
    const tensor = tf.tensor3d(
      new Uint8Array(resized), 
      [size, size, 3]
    );

    return tensor;
  }

  /**
   * Convert tensor to buffer
   */
  private async tensorToBuffer(tensor: tf.Tensor3D): Promise<Buffer> {
    const [height, width] = tensor.shape;
    const data = await tensor.data();
    
    // Convert to sharp-compatible format
    const buffer = Buffer.from(data);
    
    return sharp(buffer, {
      raw: {
        width,
        height,
        channels: 3
      }
    }).png().toBuffer();
  }

  /**
   * Detect elements with ONNX
   */
  private async detectWithONNX(tensor: tf.Tensor3D): Promise<any[]> {
    if (!this.detectionModel || !('run' in this.detectionModel)) {
      throw new Error('ONNX model not loaded');
    }

    // Prepare input
    const inputData = await tensor.data();
    const inputTensor = new ort.Tensor('float32', inputData, [1, 3, this.INPUT_SIZE, this.INPUT_SIZE]);

    // Run inference
    const results = await this.detectionModel.run({ images: inputTensor });
    
    // Parse results (format depends on model)
    return this.parseONNXResults(results);
  }

  /**
   * Detect elements with TensorFlow
   */
  private async detectWithTensorFlow(tensor: tf.Tensor3D): Promise<any[]> {
    if (!this.detectionModel || !('predict' in this.detectionModel)) {
      throw new Error('TensorFlow model not loaded');
    }

    // Prepare input
    const normalized = tf.div(tensor, 255.0);
    const batched = normalized.expandDims(0);

    // Run inference
    const predictions = await this.detectionModel.predict(batched) as tf.Tensor;
    
    // Parse results
    const results = await this.parseTensorFlowResults(predictions);

    // Cleanup
    normalized.dispose();
    batched.dispose();
    predictions.dispose();

    return results;
  }

  /**
   * Parse ONNX results
   */
  private parseONNXResults(results: ort.InferenceSession.OnnxValueMapType): any[] {
    // This depends on the model output format
    // Assuming YOLO-style output
    const output = results.output || results.detection;
    if (!output) return [];

    const data = output.data as Float32Array;
    const detections = [];

    // Parse detections (format: [x, y, w, h, confidence, ...class_probs])
    for (let i = 0; i < data.length; i += 85) { // 85 = 5 + 80 classes
      const confidence = data[i + 4];
      if (confidence > this.CONFIDENCE_THRESHOLD) {
        detections.push({
          x: data[i] - data[i + 2] / 2,
          y: data[i + 1] - data[i + 3] / 2,
          width: data[i + 2],
          height: data[i + 3],
          confidence
        });
      }
    }

    return detections;
  }

  /**
   * Parse TensorFlow results
   */
  private async parseTensorFlowResults(predictions: tf.Tensor): Promise<any[]> {
    const [boxes, scores, classes, numDetections] = await Promise.all([
      predictions.gather([0]).data(),
      predictions.gather([1]).data(),
      predictions.gather([2]).data(),
      predictions.gather([3]).data()
    ]);

    const detections = [];
    const num = numDetections[0];

    for (let i = 0; i < num && i < this.MAX_DETECTIONS; i++) {
      if (scores[i] > this.CONFIDENCE_THRESHOLD) {
        detections.push({
          x: boxes[i * 4] * this.INPUT_SIZE,
          y: boxes[i * 4 + 1] * this.INPUT_SIZE,
          width: (boxes[i * 4 + 2] - boxes[i * 4]) * this.INPUT_SIZE,
          height: (boxes[i * 4 + 3] - boxes[i * 4 + 1]) * this.INPUT_SIZE,
          confidence: scores[i],
          class: classes[i]
        });
      }
    }

    return detections;
  }

  /**
   * Apply Non-Maximum Suppression
   */
  private async applyNMS(detections: any[]): Promise<any[]> {
    if (detections.length === 0) return [];

    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);

    const selected = [];
    const used = new Set<number>();

    for (let i = 0; i < detections.length; i++) {
      if (used.has(i)) continue;

      selected.push(detections[i]);
      used.add(i);

      // Suppress overlapping boxes
      for (let j = i + 1; j < detections.length; j++) {
        if (used.has(j)) continue;

        const iou = this.calculateIOU(detections[i], detections[j]);
        if (iou > this.NMS_THRESHOLD) {
          used.add(j);
        }
      }
    }

    return selected;
  }

  /**
   * Calculate Intersection over Union
   */
  private calculateIOU(box1: any, box2: any): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;

    return intersection / union;
  }

  /**
   * Get argmax of array
   */
  private argMax(array: number[]): number {
    return array.reduce((maxIdx, val, idx, arr) => 
      val > arr[maxIdx] ? idx : maxIdx, 0);
  }

  /**
   * Map class index to ElementType
   */
  private indexToElementType(index: number): ElementType {
    // This mapping depends on how the model was trained
    const typeMap: ElementType[] = [
      'button', 'text', 'image', 'input', 'link',
      'container', 'navigation', 'header', 'footer',
      'sidebar', 'card', 'list', 'table', 'video',
      'icon', 'logo', 'menu', 'form', 'textarea',
      'select', 'checkbox', 'radio', 'unknown'
    ];

    return typeMap[index] || 'unknown';
  }

  /**
   * Preprocess image for OCR
   */
  private async preprocessForOCR(image: Buffer): Promise<Buffer> {
    return sharp(image)
      .grayscale()
      .normalize()
      .sharpen()
      .toBuffer();
  }

  /**
   * Extract dominant colors from image
   */
  private async extractColors(image: Buffer): Promise<any> {
    const { dominant } = await sharp(image).stats();
    
    return {
      primary: this.createColor(this.rgbToHex(dominant)),
      background: this.createColor('#FFFFFF'), // Would need more analysis
      foreground: this.createColor('#000000')  // Would need more analysis
    };
  }

  /**
   * Estimate opacity from image
   */
  private async estimateOpacity(image: Buffer): Promise<number> {
    // Check if image has alpha channel
    const metadata = await sharp(image).metadata();
    if (metadata.channels === 4) {
      // Would need to analyze alpha channel
      return 1.0;
    }
    return 1.0;
  }

  /**
   * Create Color object
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
   * Convert RGB to hex
   */
  private rgbToHex(rgb: any): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
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
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
    }
    
    if (this.detectionModel) {
      if ('dispose' in this.detectionModel) {
        this.detectionModel.dispose();
      }
    }
    
    if (this.classificationModel) {
      this.classificationModel.dispose();
    }
    
    logger.info('VisionModel cleaned up');
  }
}