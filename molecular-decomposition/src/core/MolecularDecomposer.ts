/**
 * MolecularDecomposer - Main orchestrator for computer vision-based element decomposition
 * 
 * This class coordinates the entire molecular decomposition process:
 * 1. Element detection using computer vision
 * 2. Hierarchy building from spatial relationships
 * 3. Visual property extraction
 * 4. Behavioral hint inference
 */

import { VisionModel } from './VisionModel';
import { HierarchyBuilder } from './HierarchyBuilder';
import { PropertyExtractor } from './PropertyExtractor';
import {
  DetectedElement,
  MolecularStructure,
  DecompositionResult,
  MolecularDecompositionConfig,
  BoundingBox,
  ElementType,
  BehavioralHint,
  ElementRelationship
} from '../types';
import { createModuleLogger, logPerformance, logElementDetection } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

const logger = createModuleLogger('MolecularDecomposer');

export class MolecularDecomposer {
  private visionModel: VisionModel;
  private hierarchyBuilder: HierarchyBuilder;
  private propertyExtractor: PropertyExtractor;
  private config: Required<MolecularDecompositionConfig>;

  constructor(
    visionModel: VisionModel,
    hierarchyBuilder: HierarchyBuilder,
    propertyExtractor: PropertyExtractor,
    config: MolecularDecompositionConfig = {}
  ) {
    this.visionModel = visionModel;
    this.hierarchyBuilder = hierarchyBuilder;
    this.propertyExtractor = propertyExtractor;
    
    // Apply default configuration
    this.config = {
      modelPath: config.modelPath || './models/element-detection-model',
      confidenceThreshold: config.confidenceThreshold || 0.5,
      maxElements: config.maxElements || 1000,
      enableOCR: config.enableOCR !== false,
      enableDepthAnalysis: config.enableDepthAnalysis !== false,
      enableBehaviorInference: config.enableBehaviorInference !== false,
      gpuAcceleration: config.gpuAcceleration !== false
    };

    logger.info('MolecularDecomposer initialized', { config: this.config });
  }

  /**
   * Initialize the decomposer and load models
   */
  async initialize(): Promise<void> {
    logger.info('Initializing MolecularDecomposer...');
    
    try {
      // Load the vision model
      await this.visionModel.loadModel(this.config.modelPath);
      logger.info('Vision model loaded successfully');
      
      // Initialize other components if needed
      // await this.hierarchyBuilder.initialize();
      // await this.propertyExtractor.initialize();
      
      logger.info('MolecularDecomposer initialization complete');
    } catch (error) {
      logger.error('Failed to initialize MolecularDecomposer', { error });
      throw error;
    }
  }

  /**
   * Decompose a screenshot into molecular structure
   */
  async decompose(screenshot: Buffer): Promise<DecompositionResult> {
    const startTime = Date.now();
    logger.info('Starting molecular decomposition');

    try {
      // Get image metadata
      const metadata = await sharp(screenshot).metadata();
      const imageSize = { width: metadata.width!, height: metadata.height! };
      
      // Step 1: Detect elements
      logger.info('Detecting elements...');
      const elements = await this.detectElements(screenshot);
      logElementDetection(elements.length, Date.now() - startTime, imageSize);

      // Step 2: Build hierarchy
      logger.info('Building element hierarchy...');
      const hierarchy = await this.hierarchyBuilder.buildHierarchy(elements);
      
      // Step 3: Extract properties for each element
      logger.info('Extracting visual properties...');
      const properties = new Map();
      
      for (const element of elements) {
        const crop = await this.cropElement(screenshot, element.boundingBox, imageSize);
        const props = await this.propertyExtractor.extractProperties(crop, element);
        properties.set(element.id, props);
        
        // Update element with extracted properties
        element.visualFeatures = props;
      }

      // Step 4: Infer behavioral hints
      let behavioralHints: BehavioralHint[] = [];
      if (this.config.enableBehaviorInference) {
        logger.info('Inferring behavioral hints...');
        behavioralHints = await this.inferBehavioralHints(elements, hierarchy);
      }

      // Step 5: Build molecular structure
      const structure: MolecularStructure = {
        root: this.findRootElement(elements),
        elements: new Map(elements.map(el => [el.id, el])),
        hierarchy,
        relationships: this.extractRelationships(elements, hierarchy),
        layoutGrid: await this.hierarchyBuilder.detectLayoutGrid(elements),
        behavioralHints
      };

      // Calculate confidence score
      const confidence = this.calculateOverallConfidence(elements);
      
      const processingTime = Date.now() - startTime;
      logPerformance('Molecular decomposition', startTime);

      const result: DecompositionResult = {
        structure,
        elements,
        properties,
        confidence,
        processingTime,
        warnings: this.collectWarnings(elements, structure)
      };

      logger.info('Molecular decomposition completed', {
        elementCount: elements.length,
        confidence: `${(confidence * 100).toFixed(2)}%`,
        processingTime: `${processingTime}ms`
      });

      return result;

    } catch (error) {
      logger.error('Molecular decomposition failed', { error });
      throw error;
    }
  }

  /**
   * Detect elements in the screenshot
   */
  private async detectElements(screenshot: Buffer): Promise<DetectedElement[]> {
    const startTime = Date.now();
    
    // Get bounding boxes from vision model
    const boundingBoxes = await this.visionModel.detectElements(screenshot);
    
    // Filter by confidence threshold
    const filteredBoxes = boundingBoxes.filter(box => 
      (box as any).confidence >= this.config.confidenceThreshold
    );

    // Convert to DetectedElement format
    const elements: DetectedElement[] = [];
    
    for (const box of filteredBoxes.slice(0, this.config.maxElements)) {
      const element = await this.createDetectedElement(screenshot, box);
      elements.push(element);
    }

    // Sort by area (larger elements first, likely containers)
    elements.sort((a, b) => {
      const areaA = a.boundingBox.width * a.boundingBox.height;
      const areaB = b.boundingBox.width * b.boundingBox.height;
      return areaB - areaA;
    });

    logPerformance('Element detection', startTime);
    return elements;
  }

  /**
   * Create a DetectedElement from a bounding box
   */
  private async createDetectedElement(
    screenshot: Buffer, 
    box: BoundingBox
  ): Promise<DetectedElement> {
    const id = uuidv4();
    
    // Crop the element area
    const crop = await this.cropElement(screenshot, box, 
      await sharp(screenshot).metadata() as any);
    
    // Classify the element type
    const classification = await this.visionModel.classifyElement(crop);
    
    // Extract text if applicable
    let text: string | undefined;
    if (this.config.enableOCR && this.shouldExtractText(classification.type)) {
      try {
        text = await this.visionModel.extractText(crop);
      } catch (error) {
        logger.warn('Text extraction failed', { elementId: id, error });
      }
    }

    const element: DetectedElement = {
      id,
      boundingBox: {
        ...box,
        center: {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2
        }
      },
      type: classification.type,
      confidence: classification.confidence,
      visualFeatures: {
        colors: {
          primary: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 }, hsl: { h: 0, s: 0, l: 0 }, alpha: 1 },
          background: { hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, hsl: { h: 0, s: 0, l: 100 }, alpha: 1 }
        },
        spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        opacity: 1
      },
      depth: 0 // Will be updated by hierarchy builder
    };

    return element;
  }

  /**
   * Crop element from screenshot
   */
  private async cropElement(
    screenshot: Buffer,
    box: BoundingBox,
    imageSize: { width: number; height: number }
  ): Promise<Buffer> {
    // Ensure box is within image bounds
    const x = Math.max(0, Math.floor(box.x));
    const y = Math.max(0, Math.floor(box.y));
    const width = Math.min(Math.floor(box.width), imageSize.width - x);
    const height = Math.min(Math.floor(box.height), imageSize.height - y);

    return sharp(screenshot)
      .extract({ left: x, top: y, width, height })
      .toBuffer();
  }

  /**
   * Find the root element (usually the largest container)
   */
  private findRootElement(elements: DetectedElement[]): DetectedElement {
    if (elements.length === 0) {
      throw new Error('No elements detected');
    }

    // Find the element with the largest area that contains others
    let rootCandidate = elements[0];
    let maxContainedElements = 0;

    for (const element of elements) {
      let containedCount = 0;
      
      for (const other of elements) {
        if (element.id !== other.id && this.contains(element.boundingBox, other.boundingBox)) {
          containedCount++;
        }
      }

      if (containedCount > maxContainedElements) {
        maxContainedElements = containedCount;
        rootCandidate = element;
      }
    }

    return rootCandidate;
  }

  /**
   * Check if box1 contains box2
   */
  private contains(box1: BoundingBox, box2: BoundingBox): boolean {
    return box1.x <= box2.x &&
           box1.y <= box2.y &&
           box1.x + box1.width >= box2.x + box2.width &&
           box1.y + box1.height >= box2.y + box2.height;
  }

  /**
   * Extract relationships between elements
   */
  private extractRelationships(
    elements: DetectedElement[],
    hierarchy: any
  ): ElementRelationship[] {
    const relationships: ElementRelationship[] = [];

    // Add parent-child relationships
    for (const [parentId, childIds] of hierarchy.parentChildMap) {
      for (const childId of childIds) {
        relationships.push({
          type: 'contains',
          source: parentId,
          target: childId,
          confidence: 1.0
        });
      }
    }

    // Add sibling relationships
    for (const group of hierarchy.siblingGroups) {
      for (let i = 0; i < group.elements.length - 1; i++) {
        relationships.push({
          type: 'siblings',
          source: group.elements[i].id,
          target: group.elements[i + 1].id,
          confidence: 0.9,
          metadata: { layout: group.layout }
        });
      }
    }

    return relationships;
  }

  /**
   * Infer behavioral hints from visual appearance
   */
  private async inferBehavioralHints(
    elements: DetectedElement[],
    hierarchy: any
  ): Promise<BehavioralHint[]> {
    const hints: BehavioralHint[] = [];

    for (const element of elements) {
      // Clickable hints
      if (this.looksClickable(element)) {
        hints.push({
          elementId: element.id,
          type: 'clickable',
          confidence: 0.8,
          evidence: ['Element type suggests interactivity', 'Visual styling indicates button-like appearance']
        });
      }

      // Editable hints
      if (element.type === 'input' || element.type === 'textarea') {
        hints.push({
          elementId: element.id,
          type: 'editable',
          confidence: 0.95,
          evidence: ['Element type is input field']
        });
      }

      // Hoverable hints
      if (this.hasHoverableCharacteristics(element)) {
        hints.push({
          elementId: element.id,
          type: 'hoverable',
          confidence: 0.7,
          evidence: ['Element has hover-like visual characteristics']
        });
      }

      // Scrollable hints
      if (this.mightBeScrollable(element, hierarchy)) {
        hints.push({
          elementId: element.id,
          type: 'scrollable',
          confidence: 0.6,
          evidence: ['Container size suggests scrollable content']
        });
      }
    }

    return hints;
  }

  /**
   * Check if element looks clickable
   */
  private looksClickable(element: DetectedElement): boolean {
    const clickableTypes: ElementType[] = ['button', 'link', 'icon', 'menu'];
    return clickableTypes.includes(element.type);
  }

  /**
   * Check if element has hoverable characteristics
   */
  private hasHoverableCharacteristics(element: DetectedElement): boolean {
    // Simple heuristic - can be enhanced with more visual analysis
    return element.type === 'link' || 
           element.type === 'button' ||
           element.type === 'menu';
  }

  /**
   * Check if element might be scrollable
   */
  private mightBeScrollable(element: DetectedElement, hierarchy: any): boolean {
    // Check if it's a container with many children
    const childCount = hierarchy.parentChildMap.get(element.id)?.length || 0;
    return element.type === 'container' && childCount > 5;
  }

  /**
   * Determine if text should be extracted for this element type
   */
  private shouldExtractText(type: ElementType): boolean {
    const textTypes: ElementType[] = ['text', 'button', 'link', 'header', 'input'];
    return textTypes.includes(type);
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(elements: DetectedElement[]): number {
    if (elements.length === 0) return 0;
    
    const totalConfidence = elements.reduce((sum, el) => sum + el.confidence, 0);
    return totalConfidence / elements.length;
  }

  /**
   * Collect warnings about the decomposition
   */
  private collectWarnings(elements: DetectedElement[], structure: MolecularStructure): string[] {
    const warnings: string[] = [];

    // Check for low confidence elements
    const lowConfidenceCount = elements.filter(el => el.confidence < 0.6).length;
    if (lowConfidenceCount > 0) {
      warnings.push(`${lowConfidenceCount} elements detected with low confidence (<60%)`);
    }

    // Check for overlapping elements
    const overlappingPairs = this.findOverlappingElements(elements);
    if (overlappingPairs > 0) {
      warnings.push(`${overlappingPairs} pairs of overlapping elements detected`);
    }

    // Check for elements outside viewport
    const outsideViewport = elements.filter(el => 
      el.boundingBox.x < 0 || el.boundingBox.y < 0
    ).length;
    if (outsideViewport > 0) {
      warnings.push(`${outsideViewport} elements detected outside viewport`);
    }

    return warnings;
  }

  /**
   * Find overlapping elements
   */
  private findOverlappingElements(elements: DetectedElement[]): number {
    let overlappingCount = 0;
    
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        if (this.overlaps(elements[i].boundingBox, elements[j].boundingBox)) {
          overlappingCount++;
        }
      }
    }
    
    return overlappingCount;
  }

  /**
   * Check if two bounding boxes overlap
   */
  private overlaps(box1: BoundingBox, box2: BoundingBox): boolean {
    return !(box1.x + box1.width < box2.x ||
             box2.x + box2.width < box1.x ||
             box1.y + box1.height < box2.y ||
             box2.y + box2.height < box1.y);
  }
}